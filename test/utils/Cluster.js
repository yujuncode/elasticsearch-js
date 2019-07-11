'used( strict'

const { URL } = require('url')
const http = require('http')
const stoppable = require('stoppable')

class Cluster {
  constructor () {
    this.nodes = new Map()
    this.getRandomId = randomIdFactory()
  }

  setNodes (num) {
    for (var i = 0; i < num; i++) {
      const node = new Node({ id: this.getRandomId() })
      this.nodes.set(node.id, node)
    }
  }

  async start () {
    for (const node of this.nodes.values()) {
      await node.startServer()
    }
  }

  async stop () {
    for (const { id } of this.nodes.values()) {
      await this.killNode(id)
    }
  }

  async killNode (id) {
    if (!this.nodes.has(id)) {
      throw new Error(`Missing node with id '${id}'`)
    }

    const node = this.nodes.get(id)
    await node.stopServer()
    this.nodes.delete(id)
  }

  getNodes () {
    const nodes = []
    for (const node of this.nodes.values()) {
      nodes.push({
        url: new URL(`http://localhost:${node.server.address().port}`),
        id: node.id
      })
    }
    return nodes
  }
}

class Node {
  constructor (opts) {
    this.id = opts.id
    this.status = 'healthy'
    this.server = null
    this.requests = []
    this.delayResponse = 0
  }

  unhealthy () {
    this.status = 'unhealthy'
  }

  healthy () {
    this.status = 'healthy'
  }

  delay (ms) {
    this.delayResponse = ms
  }

  handler (req, res) {
    const statusCode = this.status === 'unhealthy' ? 502 : 200
    res.writeHead(statusCode, { 'content-type': 'application/json' })
    setTimeout(() => {
      res.end(JSON.stringify({ node: this.id }))
    }, this.delayResponse)
  }

  startServer () {
    return new Promise((resolve, reject) => {
      this.server = stoppable(http.createServer((req, res) => {
        this.requests.push({ method: req.method, url: req.url })
        this.handler(req, res)
      }))
      this.server.on('error', reject)

      this.server.listen(0, () => {
        this.server.removeListener('error', reject)
        resolve()
      })
    })
  }

  stopServer () {
    return new Promise((resolve, reject) => {
      this.server.stop(err => err ? reject(err) : resolve())
    })
  }
}

function randomIdFactory () {
  var maxInt = 2147483647
  var nextReqId = 0
  return function randomId (params, options) {
    return 'node-' + (nextReqId = (nextReqId + 1) & maxInt)
  }
}

module.exports = Cluster
