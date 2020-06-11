// Licensed to Elasticsearch B.V under one or more agreements.
// Elasticsearch B.V licenses this file to you under the Apache 2.0 License.
// See the LICENSE file in the project root for more information

'use strict'

const EventEmitter = require('events')
const BaseConnection = require('./BaseConnection')
const undici = require('undici')
const debug = require('debug')('elasticsearch')
const decompressResponse = require('decompress-response')
const INVALID_PATH_REGEX = /[^\u0021-\u00ff]/
const kEmitter = Symbol('elasticsearch-emitter')
const {
  ConnectionError,
  RequestAbortedError,
  TimeoutError
} = require('../errors')

class UndiciConnection extends BaseConnection {
  constructor (opts = {}) {
    super(opts)
    this.pool = undici(this.url.origin, {
      connections: 100,
      pipelining: 1,
      requestTimeout: opts.requestTimeout
    })
    this[kEmitter] = new EventEmitter()
  }

  request (params, callback) {
    this._openRequests += 1

    const emitter = this[kEmitter]
    const requestParams = this.buildRequestObject(params)
    requestParams.idempotent = false
    requestParams.requestTimeout = params.timeout
    requestParams.signal = emitter
    // https://github.com/nodejs/node/commit/b961d9fd83
    if (INVALID_PATH_REGEX.test(requestParams.path) === true) {
      callback(new TypeError(`ERR_UNESCAPED_CHARACTERS: ${requestParams.path}`), null)
      return { abort: () => {} }
    }

    debug('Starting a new request', params)
    this.pool.request(requestParams, (err, response) => {
      this._openRequests -= 1
      if (err) {
        if (err.code === 'UND_ERR_REQUEST_TIMEOUT') {
          return callback(new TimeoutError('Request timed out', params), null)
        } else if (err.code === 'UND_ERR_ABORTED') {
          return callback(new RequestAbortedError(), null)
        } else {
          return callback(new ConnectionError(err.message), null)
        }
      }

      const stream = response.body
      stream.statusCode = response.statusCode
      stream.headers = response.headers

      if (params.asStream === true) {
        callback(null, stream)
      } else {
        callback(null, decompressResponse(stream))
      }
    })

    return {
      abort () {
        emitter.emit('abort')
      }
    }
  }

  close (callback = () => {}) {
    debug('Closing connection', this.id)
    this.pool.close(callback)
  }
}

module.exports = UndiciConnection
