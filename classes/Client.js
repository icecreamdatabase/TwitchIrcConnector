"use strict"
const WebSocketServer = new (require('./WsServer')) // singleton
const IrcConnectionPool = require('./irc/IrcConnectionPool')
const WsCmds = require('../ENUMS/WsCmds')

class Client {
  /**
   * @param {WsDataReceiveAuth} data
   */
  constructor (data) {
    this._userId = data.userId
    this._userName = data.userName
    this._accessToken = data.accessToken

    WebSocketServer.on(WsCmds.JOIN, this.onJoin.bind(this))
    WebSocketServer.on(WsCmds.PART, this.onPart.bind(this))
    WebSocketServer.on(WsCmds.SEND, this.onSend.bind(this))
    WebSocketServer.on(WsCmds.SET_CHANNELS, this.onSetChannels.bind(this))
  }

  get userId () {
    return this._userId
  }

  get userName () {
    return this._userName
  }

  get accessToken () {
    return this._accessToken
  }

  /**
   * @param {WsDataReceiveAuth} data
   */
  updateAuth (data) {
    this._userId = data.userId
    this._userName = data.userName
    this._accessToken = data.accessToken
  }

  /**
   * @param {WsDataReceiveJoinAndPart} data
   */
  onJoin (data) {

  }

  /**
   * @param {WsDataReceiveJoinAndPart} data
   */
  onPart (data) {

  }

  /**
   * @param {WsDataReceiveSend} data
   */
  onSend (data) {

  }

  /**
   * @param {WsDataReceiveRemoveBot} data
   */
  onSetChannels (data) {

  }
}

module.exports = Client

