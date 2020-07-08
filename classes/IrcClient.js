"use strict"
const WebSocketServer = new (require('./WsServer')) // singleton
const Queue = require('./irc/Queue')
const IrcConnectionPool = require('./irc/IrcConnectionPool')
const WsCmds = require('../ENUMS/WsCmds')
const Logger = require('./helper/Logger')

class IrcClient {
  /**
   * @param {WsDataReceiveAuth} data
   */
  constructor (data) {
    this.updateAuth(data)

    //TODO maxMessageLength and botStatus have to come from somewhere!
    /**
     * @type {Object.<number,{
     *   maxMessageLength: number,
     *   botStatus: UserLevel,
     *   lastMessageTimeMillis: number,
     *   lastMessage: string
     * }>}
     */
    this.channels = {}

    WebSocketServer.on(WsCmds.JOIN, this.onJoin.bind(this))
    WebSocketServer.on(WsCmds.PART, this.onPart.bind(this))
    WebSocketServer.on(WsCmds.SEND, this.onSend.bind(this))
    WebSocketServer.on(WsCmds.SET_CHANNELS, this.onSetChannels.bind(this))

    this.queue = new Queue(this)
    this.ircConnectionPool = new IrcConnectionPool(this)

    this.ircConnectionPool.on('*', data => WebSocketServer.sendToAllClientForBotUserId(this.userId, WsCmds.RECEIVE, data))
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

  get rateLimitModerator () {
    return this._rateLimitModerator
  }

  get rateLimitUser () {
    return this._rateLimitUser
  }

  /**
   * @param {WsDataReceiveAuth} data
   */
  updateAuth (data) {
    Logger.info(`Auth for: ${data.userId} (${data.userName})`)
    this._userId = data.userId
    this._userName = data.userName
    this._accessToken = data.accessToken
    this._rateLimitModerator = data.rateLimitModerator
    this._rateLimitUser = data.rateLimitUser
  }

  /**
   * @param {WsDataReceiveJoinAndPart} data
   */
  async onJoin (data) {
    Logger.info(`Joining: ${data.channelNames}`)
    await this.ircConnectionPool.joinChannel(data.channelNames)
  }

  /**
   * @param {WsDataReceiveJoinAndPart} data
   */
  async onPart (data) {
    Logger.info(`Parting: ${data.channelNames}`)
    await this.ircConnectionPool.leaveChannel(data.channelNames)
  }

  /**
   * @param {WsDataReceiveSend} data
   */
  onSend (data) {
    this.queue.sayWithWsDataReceiveSendObj(data)
  }

  /**
   * @param {WsDataReceiveRemoveBot} data
   */
  async onSetChannels (data) {
    console.log(data)
  }
}

module.exports = IrcClient

