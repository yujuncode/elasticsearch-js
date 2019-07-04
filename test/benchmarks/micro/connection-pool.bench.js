'use strict'

const assert = require('assert')
const { bench } = require('../suite')()
const { ConnectionPool, WeightedConnectionPool } = require('../../../index')
const { connection } = require('../../utils')

const options = {
  warmup: 50,
  measure: 50,
  iterations: 1000
}

bench('ConnectionPool.getConnection - 10 connections', options, async b => {
  const pool = new ConnectionPool({ Connection: connection.MockConnection })
  for (var port = 9200; port < 9210; port++) {
    pool.addConnection(`http://localhost:${port}`)
  }
  assert.strictEqual(pool.connections.size, 10)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench('WeightedConnectionPool.getConnection - 10 connections', options, async b => {
  const pool = new WeightedConnectionPool({ Connection: connection.MockConnection })
  for (var port = 9200; port < 9210; port++) {
    pool.addConnection(`http://localhost:${port}`)
  }
  assert.strictEqual(pool.size, 10)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench('ConnectionPool.getConnection - 100 connections', options, async b => {
  const pool = new ConnectionPool({ Connection: connection.MockConnection })
  for (var port = 9200; port < 9300; port++) {
    pool.addConnection(`http://localhost:${port}`)
  }
  assert.strictEqual(pool.connections.size, 100)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench('WeightedConnectionPool.getConnection - 100 connections', options, async b => {
  const pool = new WeightedConnectionPool({ Connection: connection.MockConnection })
  for (var port = 9200; port < 9300; port++) {
    pool.addConnection(`http://localhost:${port}`)
  }
  assert.strictEqual(pool.size, 100)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench('ConnectionPool.getConnection - 500 connections', options, async b => {
  const pool = new ConnectionPool({ Connection: connection.MockConnection })
  for (var port = 9200; port < 9700; port++) {
    pool.addConnection(`http://localhost:${port}`)
  }
  assert.strictEqual(pool.connections.size, 500)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench('WeightedConnectionPool.getConnection - 500 connections', options, async b => {
  const pool = new WeightedConnectionPool({ Connection: connection.MockConnection })
  for (var port = 9200; port < 9700; port++) {
    pool.addConnection(`http://localhost:${port}`)
  }
  assert.strictEqual(pool.size, 500)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench('ConnectionPool.getConnection - 1000 connections', options, async b => {
  const pool = new ConnectionPool({ Connection: connection.MockConnection })
  for (var port = 9200; port < 10200; port++) {
    pool.addConnection(`http://localhost:${port}`)
  }
  assert.strictEqual(pool.connections.size, 1000)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench('WeightedConnectionPool.getConnection - 1000 connections', options, async b => {
  const pool = new WeightedConnectionPool({ Connection: connection.MockConnection })
  for (var port = 9200; port < 10200; port++) {
    pool.addConnection(`http://localhost:${port}`)
  }
  assert.strictEqual(pool.size, 1000)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})
