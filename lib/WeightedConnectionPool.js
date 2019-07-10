/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

'use strict'

const { URL } = require('url')
const debug = require('debug')('elasticsearch')
const Connection = require('./Connection')
const noop = () => {}
const noFilter = () => true

class WeightedConnectionPool {
  constructor (opts) {
    // list of nodes and weights
    this.connections = []
    // how many nodes we have in our scheduler
    this.size = this.connections.length
    // index choosen last time
    this.index = -1
    // max weight of all nodes
    this.maxWeight = 0
    // greatest common divisor of all nodes weights
    this.greatestCommonDivisor = 0
    // current weight in scheduling
    this.currentWeight = 0

    this.Connection = opts.Connection
    this.emit = opts.emit || noop
    this._auth = null
    this._ssl = opts.ssl
    this._agent = opts.agent
  }

  /**
   * Returns a connection, even if the connection might be dead.
   *
   * @param {object} options (filter)
   * @returns {object|null} connection
   */
  getConnection (opts = {}) {
    const filter = opts.filter || noFilter
    // we should be able to find the next node in 1 array scan,
    // if we don't, it means that we are in an infinite loop
    var counter = 0
    while (counter++ < this.size) {
      // 0 <= index < size
      this.index = (this.index + 1) % this.size
      if (this.index === 0) {
        this.currentWeight = this.currentWeight - this.greatestCommonDivisor
        if (this.currentWeight <= 0) {
          this.currentWeight = this.maxWeight
          if (this.currentWeight === 0) {
            return null
          }
        }
      }
      const connection = this.connections[this.index]
      if (connection.weight >= this.currentWeight && filter(connection) === true) {
        return connection
      }
    }
    return null
  }

  /**
   * Set the weight of a connection to the maximum value.
   * If sniffing is not enabled and there is only
   * one node, this method is a noop.
   *
   * @param {object} connection
   */
  markAlive (connection) {
    if (this.size === 1 || connection.status === Connection.statuses.ALIVE) return this

    connection.status = Connection.statuses.ALIVE
    connection.deadCount = 0
    connection.weight = Math.round(1000 / this.size)
    // connection.weight = 10

    this.maxWeight = Math.max(...(this.connections.map(c => c.weight)))
    this.greatestCommonDivisor = this.connections.map(c => c.weight).reduce(getGreatestCommonDivisor, 0)

    return this
  }

  /**
   * Decreases the connection weight.
   * If sniffing is not enabled and there is only
   * one node, this method is a noop.
   *
   * @param {object} connection
   */
  markDead (connection) {
    if (this.size === 1) return this

    connection.status = Connection.statuses.DEAD
    connection.deadCount++
    // connection.weight = 1
    // connection.weight = Math.round(connection.weight / 2)
    // connection.weight = Math.round(connection.weight / this.size)
    // connection.weight = Math.round(connection.weight / Math.pow(2, this.size))
    // connection.weight = Math.round(connection.weight / Math.pow(2, connection.deadCount))
    // connection.weight -= Math.round(Math.pow(Math.log2(connection.weight), this.size))
    connection.weight -= Math.round(Math.pow(Math.log2(connection.weight), connection.deadCount))
    // connection.weight -= Math.round(Math.pow(Math.log2(connection.weight), 2))
    // connection.weight -= Math.pow(connection.deadCount, connection.deadCount + 1)
    // connection.weight = Math.round(Math.sqrt(connection.weight))
    // connection.weight -= Math.round(Math.sqrt(connection.weight))

    if (connection.weight <= 0) connection.weight = 1

    this.maxWeight = Math.max(...(this.connections.map(c => c.weight)))
    this.greatestCommonDivisor = this.connections.map(c => c.weight).reduce(getGreatestCommonDivisor, 0)

    return this
  }

  /**
   * This connection pool does not try to resurrect connection,
   * but instead changes their weight. This means that the
   * resurrection strategy is a part of the standard flow.
   */
  resurrect () {}

  /**
   * Creates a new connection instance.
   */
  createConnection (opts) {
    if (typeof opts === 'string') {
      opts = this.urlToHost(opts)
    }
    // if a given node has auth data we store it in the connection pool,
    // so if we add new nodes without auth data (after a sniff for example)
    // we can add it to them once the connection instance has been created
    if (opts.url.username !== '' && opts.url.password !== '') {
      this._auth = {
        username: decodeURIComponent(opts.url.username),
        password: decodeURIComponent(opts.url.password)
      }
      opts.auth = this._auth
    }

    if (this._auth != null) {
      if (opts.auth == null || (opts.auth.username == null && opts.auth.password == null)) {
        opts.auth = this._auth
        opts.url.username = this._auth.username
        opts.url.password = this._auth.password
      }
    }

    if (opts.ssl == null) opts.ssl = this._ssl
    if (opts.agent == null) opts.agent = this._agent

    const connection = new this.Connection(opts)

    for (const conn of this.connections) {
      if (conn.id === connection.id) {
        throw new Error(`Connection with id '${connection.id}' is already present`)
      }
    }

    return connection
  }

  /**
   * Adds a new connection to the pool.
   *
   * @param {object|string} host
   * @returns {ConnectionPool}
   */
  addConnection (opts) {
    if (Array.isArray(opts)) {
      return opts.forEach(o => this.addConnection(o))
    }

    if (typeof opts === 'string') {
      opts = this.urlToHost(opts)
    }

    const connectionById = this.connections.find(c => c.id === opts.id)
    const connectionByUrl = this.connections.find(c => c.id === opts.url.href)

    if (connectionById || connectionByUrl) {
      throw new Error(`Connection with id '${opts.id || opts.url.href}' is already present`)
    }

    this.update([...this.connections, opts])
    return this.connections[this.size - 1]
  }

  /**
   * Removes a new connection to the pool.
   *
   * @param {object} connection
   * @returns {ConnectionPool}
   */
  removeConnection (connection) {
    debug('Removing connection', connection)
    return this.update(this.connections.filter(c => c.id !== connection.id))
  }

  /**
   * Empties the connection pool.
   *
   * @returns {ConnectionPool}
   */
  empty (callback) {
    debug('Emptying the connection pool')
    var openConnections = this.size
    this.connections.forEach(connection => {
      connection.close(() => {
        if (--openConnections === 0) {
          this.connections = []
          this.size = this.connections.length
          this.maxWeight = 0
          this.greatestCommonDivisor = 0
          this.index = -1
          this.currentWeight = 0
          callback()
        }
      })
    })
  }

  /**
   * Update the ConnectionPool with new connections.
   *
   * @param {array} array of connections
   * @returns {ConnectionPool}
   */
  update (nodes) {
    debug('Updating the connection pool')
    const newConnections = []
    const oldConnections = []

    for (const node of nodes) {
      // if we already have a given connection in the pool
      // we mark it as alive and we do not close the connection
      // to avoid socket issues
      const connectionById = this.connections.find(c => c.id === node.id)
      const connectionByUrl = this.connections.find(c => c.id === node.url.href)
      if (connectionById) {
        debug(`The connection with id '${node.id}' is already present`)
        this.markAlive(connectionById)
        newConnections.push(connectionById)
      // in case the user has passed a single url (or an array of urls),
      // the connection id will be the full href; to avoid closing valid connections
      // because are not present in the pool, we check also the node url,
      // and if is already present we update its id with the ES provided one.
      } else if (connectionByUrl) {
        connectionByUrl.id = node.id
        this.markAlive(connectionByUrl)
        newConnections.push(connectionByUrl)
      } else {
        newConnections.push(this.createConnection(node))
      }
    }

    const ids = nodes.map(c => c.id)
    // remove all the dead connections and old connections
    for (const connection of this.connections) {
      if (ids.indexOf(connection.id) === -1) {
        oldConnections.push(connection)
      }
    }

    // close old connections
    oldConnections.forEach(connection => connection.close())
    // set the weight of the new connections
    newConnections.forEach(connection => {
      connection.weight = Math.round(1000 / newConnections.length) // + Math.floor(newConnections.length / 2)
      // connection.weight = 500
    })

    this.connections = newConnections
    this.size = this.connections.length
    this.maxWeight = Math.max(...(this.connections.map(c => c.weight)))
    this.greatestCommonDivisor = this.connections.map(c => c.weight).reduce(getGreatestCommonDivisor, 0)
    this.index = -1
    this.currentWeight = 0

    return this
  }

  /**
   * Transforms the nodes objects to a host object.
   *
   * @param {object} nodes
   * @returns {array} hosts
   */
  nodesToHost (nodes, protocol) {
    const ids = Object.keys(nodes)
    const hosts = []

    for (var i = 0, len = ids.length; i < len; i++) {
      const node = nodes[ids[i]]
      // If there is no protocol in
      // the `publish_address` new URL will throw
      // the publish_address can have two forms:
      //   - ip:port
      //   - hostname/ip:port
      // if we encounter the second case, we should
      // use the hostname instead of the ip
      var address = node.http.publish_address
      const parts = address.split('/')
      // the url is in the form of hostname/ip:port
      if (parts.length > 1) {
        const hostname = parts[0]
        const port = parts[1].match(/((?::))(?:[0-9]+)$/g)[0].slice(1)
        address = `${hostname}:${port}`
      }

      address = address.slice(0, 4) === 'http'
        ? address
        : `${protocol}//${address}`
      const roles = node.roles.reduce((acc, role) => {
        acc[role] = true
        return acc
      }, {})

      hosts.push({
        url: new URL(address),
        id: ids[i],
        roles: Object.assign({
          [Connection.roles.MASTER]: true,
          [Connection.roles.DATA]: true,
          [Connection.roles.INGEST]: true,
          [Connection.roles.ML]: false
        }, roles)
      })
    }

    return hosts
  }

  /**
   * Transforms an url string to a host object
   *
   * @param {string} url
   * @returns {object} host
   */
  urlToHost (url) {
    return {
      url: new URL(url)
    }
  }
}

function getGreatestCommonDivisor (a, b) {
  if (b === 0) return a
  return getGreatestCommonDivisor(b, a % b)
}

module.exports = WeightedConnectionPool
