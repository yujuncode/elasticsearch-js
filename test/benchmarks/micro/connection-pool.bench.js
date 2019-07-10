'use strict'

const assert = require('assert')
const { URL } = require('url')
const { bench } = require('../suite')()
const { ConnectionPool, WeightedConnectionPool } = require('../../../index')
const { connection } = require('../../utils')

const options = {
  warmup: 50,
  measure: 50,
  iterations: 1000
}

const percentageOfDeadNodes = 20
const timesDead = 3

bench(`ConnectionPool.getConnection - 3 connections ${percentageOfDeadNodes}% dead nodes`, options, async b => {
  const pool = generatePool(3)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`WeightedConnectionPool.getConnection - 3 connections ${percentageOfDeadNodes}% dead nodes ${timesDead} times`, options, async b => {
  const pool = generateWeightedPool(3)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`ConnectionPool.getConnection - 10 connections ${percentageOfDeadNodes}% dead nodes`, options, async b => {
  const pool = generatePool(10)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`WeightedConnectionPool.getConnection - 10 connections ${percentageOfDeadNodes}% dead nodes ${timesDead} times`, options, async b => {
  const pool = generateWeightedPool(10)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`ConnectionPool.getConnection - 50 connections ${percentageOfDeadNodes}% dead nodes`, options, async b => {
  const pool = generatePool(50)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`WeightedConnectionPool.getConnection - 50 connections ${percentageOfDeadNodes}% dead nodes ${timesDead} times`, options, async b => {
  const pool = generateWeightedPool(50)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`ConnectionPool.getConnection - 100 connections ${percentageOfDeadNodes}% dead nodes`, options, async b => {
  const pool = generatePool(100)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`WeightedConnectionPool.getConnection - 100 connections ${percentageOfDeadNodes}% dead nodes ${timesDead} times`, options, async b => {
  const pool = generateWeightedPool(100)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`ConnectionPool.getConnection - 500 connections ${percentageOfDeadNodes}% dead nodes`, options, async b => {
  const pool = generatePool(500)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`WeightedConnectionPool.getConnection - 500 connections ${percentageOfDeadNodes}% dead nodes ${timesDead} times`, options, async b => {
  const pool = generateWeightedPool(500)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`ConnectionPool.getConnection - 1000 connections ${percentageOfDeadNodes}% dead nodes`, options, async b => {
  const pool = generatePool(1000)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

bench(`WeightedConnectionPool.getConnection - 1000 connections ${percentageOfDeadNodes}% dead nodes ${timesDead} times`, options, async b => {
  const pool = generateWeightedPool(1000)

  b.start()
  for (var i = 0; i < b.iterations; i++) {
    pool.getConnection()
  }
  b.end()
})

function getPercentage (tot, per) {
  return Math.round((per / 100) * tot)
}

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

function generateWeightedPool (nodes) {
  const pool = new WeightedConnectionPool({ Connection: connection.MockConnection })
  const connections = []
  for (let i = 0; i < nodes; i++) {
    connections.push({ url: new URL(`http://localhost:${i}`), id: `node-${i}` })
  }
  pool.update(connections)

  assert.strictEqual(pool.size, nodes)

  const deadNodes = []
  const totDeadNodes = getPercentage(nodes, percentageOfDeadNodes)
  while (true) {
    if (deadNodes.length === totDeadNodes) break
    const random = getRandomInt(0, nodes)
    if (deadNodes.includes(random)) continue
    deadNodes.push(random)
    const connection = pool.connections[random]
    for (let i = 0; i < timesDead; i++) {
      pool.markDead(connection)
    }
  }

  return pool
}

function generatePool (nodes) {
  const pool = new ConnectionPool({ Connection: connection.MockConnection })
  for (let i = 0; i < nodes; i++) {
    pool.addConnection({ url: new URL(`http://localhost:${i}`), id: `node-${i}` })
  }

  assert.strictEqual(pool.connections.size, nodes)

  const deadNodes = []
  const totDeadNodes = getPercentage(nodes, percentageOfDeadNodes)
  while (true) {
    if (deadNodes.length === totDeadNodes) break
    const random = getRandomInt(0, nodes)
    if (deadNodes.includes(random)) continue
    deadNodes.push(random)
    const connection = pool.connections.get(`node-${random}`)
    pool.markDead(connection)
  }

  return pool
}
