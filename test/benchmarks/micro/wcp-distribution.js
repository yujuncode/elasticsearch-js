'use strict'

const assert = require('assert')
const { URL } = require('url')
const { WeightedConnectionPool } = require('../../../index')
const { connection } = require('../../utils')

generateGradualDistribution({
  nodes: 2,
  deadNodes: ['node-1']
})

generateGradualDistribution({
  nodes: 10,
  deadNodes: ['node-1']
})

generateGradualDistribution({
  nodes: 20,
  deadNodes: ['node-1']
})

generateGradualDistribution({
  nodes: 50,
  deadNodes: ['node-1']
})

generateGradualDistribution({
  nodes: 100,
  deadNodes: ['node-1']
})

generateGradualDistribution({
  nodes: 1000,
  deadNodes: ['node-1']
})

function generateGradualDistribution (opts) {
  const pool = generateWeightedPool(opts.nodes)
  console.log(`\nGradual distribution with ${opts.nodes} nodes`)

  const distribution = []
  for (let i = 0; i < 10000; i++) {
    const connection = pool.getConnection()
    if (opts.deadNodes.includes(connection.id)) {
      const beforeWeight = connection.weight
      pool.markDead(connection)
      distribution.push({ cycle: i, beforeWeight, afterWeight: connection.weight })
    }
  }

  console.log(distribution)
}

function generateWeightedPool (nodes, deadNodes = []) {
  const pool = new WeightedConnectionPool({ Connection: connection.MockConnection })
  const connections = []
  for (let i = 0; i < nodes; i++) {
    connections.push({ url: new URL(`http://localhost:${i}`), id: `node-${i}` })
  }
  pool.update(connections)

  assert.strictEqual(pool.size, nodes)

  deadNodes.forEach(node => {
    const connection = pool.connections[node.index]
    for (let i = 0; i < node.timesDead; i++) {
      pool.markDead(connection)
    }
  })

  return pool
}
