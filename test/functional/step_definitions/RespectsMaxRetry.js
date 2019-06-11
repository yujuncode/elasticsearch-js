'use strict'

// const assert = require('assert')
const { URL } = require('url')
const { Given, When, Then } = require('cucumber')
const { connection } = require('../../utils')
const { Client } = require('../../../index')

Given('a cluster with {int} nodes', async function (int) {
  this.cluster = []
  for (var i = 0; i < int; i++) {
    this.cluster.push({
      url: new URL(`http://localhost:${9200 + i}`),
      id: `node-${i}`
    })
  }
})

Given('nodes {int} to {int} are unhealthy', function (int, int2) {
  for (var i = 0; i < int; i++) {
    if (i >= int && i <= int2) {
      this.cluster[i].Connection = connection.MockConnectionError
    } else {
      this.cluster[i].Connection = connection.MockConnection
    }
  }
})

Given('the client is created', function (int, int2) {
  this.client = new Client({ nodes: this.cluster })
})

When('the client makes an API call', function () {
})

Then('an API request is made to node {int}', function (int) {
})

Then('an unhealthy API response is received from node {int}', function (int) {
})

Then('node {int} is removed from the connection pool', function (int) {
})

Then('an API request is made to node {int}', function (int) {
})

Then('an unhealthy API response is received from node {int}', function (int) {
})

Then('node {int} is removed from the connection pool', function (int) {
})

Then('an API request is made to node {int}', function (int) {
})

Then('an unhealthy API response is received from node {int}', function (int) {
})

Then('node {int} is removed from the connection pool', function (int) {
})

Then('an API request is made to node {int}', function (int) {
})

Then('an unhealthy API response is received from node {int}', function (int) {
})

Then('node {int} is removed from the connection pool', function (int) {
})

Then('an API request is made to node {int}', function (int) {
})

Then('a healthy API response is received from node {int}', function (int) {
})
