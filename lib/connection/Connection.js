// Licensed to Elasticsearch B.V under one or more agreements.
// Elasticsearch B.V licenses this file to you under the Apache 2.0 License.
// See the LICENSE file in the project root for more information

'use strict'

const BaseConnection = require('./BaseConnection')
const http = require('http')
const https = require('https')
const debug = require('debug')('elasticsearch')
const decompressResponse = require('decompress-response')
const pump = require('pump')
const INVALID_PATH_REGEX = /[^\u0021-\u00ff]/
const {
  ConnectionError,
  RequestAbortedError,
  TimeoutError
} = require('../errors')

class Connection extends BaseConnection {
  constructor (opts = {}) {
    super(opts)
    if (typeof opts.agent === 'function') {
      this.agent = opts.agent()
    } else {
      const keepAliveFalse = opts.agent && opts.agent.keepAlive === false
      const agentOptions = Object.assign({}, {
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: keepAliveFalse ? Infinity : 256,
        maxFreeSockets: 256
      }, opts.agent)
      this.agent = this.url.protocol === 'http:'
        ? new http.Agent(agentOptions)
        : new https.Agent(Object.assign({}, agentOptions, this.ssl))
    }

    this.makeRequest = this.url.protocol === 'http:'
      ? http.request
      : https.request
  }

  request (params, callback) {
    this._openRequests++
    var ended = false

    const requestParams = this.buildRequestObject(params)
    // https://github.com/nodejs/node/commit/b961d9fd83
    if (INVALID_PATH_REGEX.test(requestParams.path) === true) {
      callback(new TypeError(`ERR_UNESCAPED_CHARACTERS: ${requestParams.path}`), null)
      return { abort: () => {} }
    }

    debug('Starting a new request', params)
    const request = this.makeRequest(requestParams)

    // listen for the response event
    // TODO: handle redirects?
    request.on('response', response => {
      if (ended === false) {
        ended = true
        this._openRequests--

        if (params.asStream === true) {
          callback(null, response)
        } else {
          callback(null, decompressResponse(response))
        }
      }
    })

    // handles request timeout
    request.on('timeout', () => {
      if (ended === false) {
        ended = true
        this._openRequests--
        request.abort()
        callback(new TimeoutError('Request timed out', params), null)
      }
    })

    // handles request error
    request.on('error', err => {
      if (ended === false) {
        ended = true
        this._openRequests--
        callback(new ConnectionError(err.message), null)
      }
    })

    // updates the ended state
    request.on('abort', () => {
      debug('Request aborted', params)
      if (ended === false) {
        ended = true
        this._openRequests--
        callback(new RequestAbortedError(), null)
      }
    })

    // Disables the Nagle algorithm
    request.setNoDelay(true)

    // starts the request
    if (isStream(params.body) === true) {
      pump(params.body, request, err => {
        /* istanbul ignore if  */
        if (err != null && ended === false) {
          ended = true
          this._openRequests--
          callback(err, null)
        }
      })
    } else {
      request.end(params.body)
    }

    return request
  }

  // TODO: write a better closing logic
  close (callback = () => {}) {
    debug('Closing connection', this.id)
    if (this._openRequests > 0) {
      setTimeout(() => this.close(callback), 1000)
    } else {
      this.agent.destroy()
      callback()
    }
  }
}

function isStream (obj) {
  return obj != null && typeof obj.pipe === 'function'
}

module.exports = Connection
