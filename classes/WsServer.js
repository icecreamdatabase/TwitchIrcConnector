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
   * @typedef {object} WebSocket.data
   * @property {number|string} applicationId
   * @property {number|string} userId
   */

  /**
   * @typedef {Object} WsDataMain
   * @property {string} cmd
   * @property {WsDataAuth|WsDataJoinPartSet|WsDataSend|WsDataReceive|WsDataRemoveBot} data
   * @property {string} version
   * @property {number|string} applicationId
   */

  /**
   * @typedef {Object} WsDataAuth
   * @property {number|string} userId
   * @property {string} userName
   * @property {string} accessToken
   * @property {number} rateLimitModerator
   * @property {number} rateLimitUser
   */

  /**
   * @typedef {Object} WsDataJoinPartSet
   * @property {number|string} botUserId
   * @property {string[]} channelNames
   */

  /**
   * Send to TwitchIrcConnector to send it twitch.
   * @typedef {Object} WsDataSend
   * @property {number|string} botUserId
   * @property {string} channelName
   * @property {string} message
   * @property {number|string} [userId]
   * @property {UserLevel} botStatus
   * @property {boolean} [useSameSendConnectionAsPrevious] undefined = automatic detection based on message splitting.
   * @property {number} [maxMessageLength]
   * @property {string} [replyParentMessage]
   *
   */

  /**
   * Receive from twitch to send to the clients.
   * @typedef {Object[]} WsDataReceive
   */

  /**
   * @typedef {Object} WsDataRemoveBot
   * @property {number|string} userId
   */

  /**
   * @typedef {Object} WsDataRequestIrcStates
   * @property {number|string} botUserId
   */

  /**
   * @return {WsServer}
   * @emits Events of WsCmds ENUM. All functions in format: (applicationId, data).
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

    Logger.info(`WebSocket Server running...`)

    return this
  }

  get WS_VERSION () {
    return "1.0.0"
  }

  /**
   * @param {WebSocketServer} wss
   * @param {WebSocket} ws
   * @param {IncomingMessage} req http.IncomingMessage
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
       * @type {WsDataMain}
       */
      let parsedMsg = JSON.parse(message)
      if (parsedMsg.version === this.WS_VERSION) {

        if (parsedMsg.cmd === WsCmds.AUTH) {
          // noinspection JSUndefinedPropertyAssignment
          ws.data = {applicationId: parsedMsg.applicationId, userId: parsedMsg.data.userId}
        }
        this.emit(parsedMsg.cmd, parsedMsg.applicationId, parsedMsg.data)
      } else {
        //TODO: tell the client that it's on the wrong version
        //ws.send()
      }

    } catch (e) {
      Logger.error(`Websocket bad json: ${message}`)
    }
  }

  sendToAllClientForId (applicationId, userId, cmd, data = undefined) {
    if (!Array.isArray(data)) {
      data = [data]
    }
    this.sendToWebsocket(cmd,
      data,
      function (clientData) { // Don't use arrow function! Else userId is not accessible!
        return clientData.applicationId === applicationId && clientData.userId === userId
      })
  }

  /**
   * Send data to all open websocket clients based on a includeClientChecker function.
   * @param {string} cmd
   * @param {object[]} data
   * @param {function(WebSocket.data): boolean} includeClientChecker
   * @return {number} How many clients has the message been sent to.
   */
  sendToWebsocket (cmd, data = undefined, includeClientChecker = () => true) {
    let clientsSentTo = 0
    this.wss.clients.forEach((client) => {
        if (client.readyState === Ws.OPEN
          && Object.prototype.hasOwnProperty.call(client, "data") //this check is for "a client has connected but not sent any signup / connect data yet".
          && includeClientChecker(client.data)) {
          try {
            clientsSentTo++
            /*
            if (data.length > 0
              && Object.prototype.hasOwnProperty.call(data[0], "command")
              && data[0].command !== "PRIVMSG") {
              Logger.debug(`°° WS sent:     ${JSON.stringify({
                cmd: cmd.toLowerCase(),
                data: data,
                version: this.WS_VERSION
              })}`)
            }
            */
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
