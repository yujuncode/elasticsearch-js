'use strict'

const assert = require('assert')
const { Given, When, Then, After } = require('cucumber')
const { Client, Connection, errors } = require('../../../index')
const Cluster = require('../../utils/Cluster')

Given('a cluster with {int} nodes', async function (int) {
  this.cluster = new Cluster()
  this.cluster.setNodes(int)
  await this.cluster.start()
})

Given('nodes {int} to {int} are unhealthy', function (int, int2) {
  var count = 1
  for (const node of this.cluster.nodes.values()) {
    if (count >= int && count <= int2) {
      node.unhealthy()
    }
    count++
  }
})

Given('node {int} is healthy', function (int) {
  // nodes are healthy by default
})

Given('client configuration specifies {int} nodes', function (int) {
  this.clientConfig = {
    nodes: this.cluster.getNodes(),
    maxRetries: 5,
    nodeSelector: roundRobinSelector()
  }
})

Given('pings are disabled', function () {
  // this configuration is not currently supported
})

Given('{int} maximum retries', function (int) {
  this.clientConfig.maxRetries = int
})

When('the client is created', function () {
  this.client = new Client(this.clientConfig)
})

When('client makes an API call', async function () {
  try {
    this.response = await this.client.info()
  } catch (err) {
    this.error = err
  }
})

Then('an API request is made to node {int}', function (int) {
  const node = getNode.call(this, int)
  assert.strictEqual(node.requests.length, 1)
})

Then('an unhealthy API response is received from node {int}', function (int) {
  // how can we test this?
})

Then('node {int} is removed from the connection pool', function (int) {
  const { id } = getNode.call(this, int)
  const connection = this.client.connectionPool.connections.get(id)
  assert.strictEqual(connection.status, Connection.statuses.DEAD)
})

Then('a healthy API response is received from node {int}', function (int) {
  const { id } = getNode.call(this, int)
  assert.strictEqual(this.response.body.node, id)
})

Then('the client indicates maximum retries reached', function () {
  assert(this.error instanceof errors.ResponseError)
  assert.strictEqual(
    this.error.meta.meta.attempts,
    this.clientConfig.maxRetries
  )
})

After(async function () {
  await this.cluster.stop()
})

function getNode (int) {
  var count = 1
  for (const node of this.cluster.nodes.values()) {
    if (count++ === int) return node
  }
  throw new Error(`Missing node at index ${int}`)
}

// the internal round robin does not track changes
// in the connection pool length
function roundRobinSelector () {
  var current = -1
  var length = -1
  return function _roundRobinSelector (connections) {
    if (length !== -1 && length !== connections.length) current--
    length = connections.length
    if (++current >= connections.length) {
      current = 0
    }
    return connections[current]
  }
}
