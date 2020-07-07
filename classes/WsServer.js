"use strict"
const Ws = require('ws')
const EventEmitter = require('eventemitter3')
//CLASSES
const util = require('util')
const Logger = require('./helper/Logger')
const DiscordLog = require('./helper/DiscordLog')
const config = require('./../config.json')
const WsCmds = require('../ENUMS/WsCmds')

const WEBSOCKETPINGINTERVAL = 15000

class WsServer extends EventEmitter {
  /**
   * @typedef {Object} WsDataReceive
   * @property {string} cmd
   * @property {object} data
   * @property {string} version
   */

  /**
   * @typedef {Object} WsDataReceiveAuth
   * @property {number|string} userId
   * @property {string} userName
   * @property {string} accessToken
   * @property {number} rateLimitModerator
   * @property {number} rateLimitUser
   */

  /**
   * @typedef {Object} WsDataReceiveJoinAndPart
   * @property {number|string} botUserId
   * @property {string} channelName
   */

  /**
   * @typedef {Object} WsDataReceiveSetChannels
   * @property {number|string} botUserId
   * @property {string[]} channelNames
   */

  /**
   * @typedef {Object} WsDataReceiveSend
   * @property {number|string} botUserId
   * @property {string} channelName
   */

  /**
   * @typedef {Object} WsDataReceiveReceive
   * @property {number|string} botUserId
   * @property {string} channelName
   */

  /**
   * @typedef {Object} WsDataReceiveRemoveBot
   * @property {number|string} userId
   */

  /**
   * @return {WsServer}
   */
  constructor () {
    if (WsServer.instance) {
      return WsServer.instance
    }
    super()
    WsServer.instance = this

    this.wss = new Ws.Server({port: config.wsPort})
    this.wss.on('connection', (ws, req) => this.newConnection(this.wss, ws, req))
    setInterval(() => {
      this.wss.clients.forEach(function each (client) {
        if (client.readyState === Ws.OPEN) {
          try {
            client.ping()
          } catch (e) {
            Logger.error(__filename + "\nping failed\n" + e)
          }
        }
      })
    }, WEBSOCKETPINGINTERVAL)

    return this
  }

  get WS_VERSION () {
    return "1.0.0"
  }

  /**
   * @param {WebSocketServer} wss
   * @param {WebSocket} ws
   * @param {IncomingMessage} req
   */
  newConnection (wss, ws, req) {
    Logger.log(`°° WS connected. Current connections: ${ws._socket.server["_connections"]}`)
    // req.connection.remoteAddress
    ws.ping(undefined, undefined, undefined)
    ws.on('message', message => this.newMessage(ws, message))
  }

  /**
   * @param {WebSocket} ws
   * @param {string} message
   */
  newMessage (ws, message) {
    Logger.log(`°° WS received: ${message}`)
    try {
      /**
       * @type {WsDataReceive}
       */
      let parsedMsg = JSON.parse(message)
      if (parsedMsg.version === this.WS_VERSION) {

        if (parsedMsg.cmd === WsCmds.AUTH) {
          // noinspection JSUndefinedPropertyAssignment
          ws.data = parsedMsg.data
        }
        this.emit(parsedMsg.cmd, parsedMsg.data)
      } else {
        //TODO: tell the client that it's on the wrong version
        //ws.send()
      }

    } catch (e) {
      Logger.error(`Websocket bad json: ${message}`)
    }
  }

  /**
   * Send data to all open websocket clients based on a includeChannelChecker function.
   * @param {string} cmd
   * @param {object} data
   * @param {function(WsDataReceive): boolean} includeChannelChecker
   * @return {number} How many clients has the message been sent to.
   */
  sendToWebsocket (cmd, data = undefined, includeChannelChecker = () => true) {
    let clientsSentTo = 0
    this.wss.clients.forEach((client) => {
        if (client.readyState === Ws.OPEN
          && Object.prototype.hasOwnProperty.call(client, "data") //this check is for "a client has connected but not sent any signup / connect data yet".
          && includeChannelChecker(client.data)) {
          try {
            clientsSentTo++
            client.send(JSON.stringify({cmd: cmd.toLowerCase(), data: data, version: this.WS_VERSION}))
          } catch (e) {
            Logger.error(__filename + "\nsend failed\n" + e)
          }
        }
      }
    )
    return clientsSentTo
  }

  /**
   * Current number of connected websocket clients that have registered a channel.
   * @param {string} cmd
   * @returns {number}
   */
  getWebsocketClientCount (cmd) {
    let currentWebsocketClientCount = 0
    this.wss.clients.forEach(function each (client) {
      if (client.readyState === Ws.OPEN
        && Object.prototype.hasOwnProperty.call(client.data, "cmd")
        && client.data.cmd === cmd.toLowerCase()) {
        currentWebsocketClientCount++
      }
    })
    return currentWebsocketClientCount
  }
}

/**
 * Version should be in MAJOR.MINOR.PATCH --> [MAJOR, MINOR, PATCH] format.
 * @param versionStr
 * @return {number[]} [MAJOR, MINOR, PATCH] format.
 */
function versionStrToArray (versionStr) {
  return versionStr.split('.').map(x => parseInt(x))
}

module.exports = WsServer
