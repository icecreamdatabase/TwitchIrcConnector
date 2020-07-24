"use strict"
const WebSocketServer = new (require('./WsServer')) // singleton
const Queue = require('./irc/Queue')
const IrcConnectionPool = require('./irc/IrcConnectionPool')
const WsCmds = require('../ENUMS/WsCmds')
const Logger = require('./helper/Logger')

class IrcClient {
  /**
   * @typedef {Object} ChannelData
   * @property {number} lastMessageTimeMillis
   * @property {string} lastMessage
   */

  /**
   * @param {number|string} applicationId
   * @param {WsDataAuth} data
   */
  constructor (applicationId, data) {
    this.updateAuth(applicationId, data)

    //TODO maxMessageLength and botStatus have to come from somewhere!
    /**
     * Key is the channelname without a #
     * @type {Object.<string,ChannelData>}
     */
    this.channels = {}

    WebSocketServer.on(WsCmds.JOIN, this.onJoin.bind(this))
    WebSocketServer.on(WsCmds.PART, this.onPart.bind(this))
    WebSocketServer.on(WsCmds.SEND, this.onSend.bind(this))
    WebSocketServer.on(WsCmds.SET_CHANNELS, this.onSetChannels.bind(this))
    WebSocketServer.on(WsCmds.GET_IRC_STATES, this.OnGetIrcStates.bind(this))

    this.queue = new Queue(this)
    this.ircConnectionPool = new IrcConnectionPool(this)

    this.lastUserStates = {}
    this.lastRoomStates = {}
    this.ircConnectionPool.on('*', this.onIrcEvent.bind(this))

  }

  onIrcEvent (data) {
    WebSocketServer.sendToAllClientForId(this.applicationId, this.userId, WsCmds.RECEIVE, data)
    if (Object.prototype.hasOwnProperty.call(data, "command")) {
      switch (data.command) {
        case "USERSTATE":
          this.lastUserStates[data.param.sub(1)] = data
          break
        case "ROOMSTATE":
          this.lastRoomStates[data.param.sub(1)] = data
          break
      }
    }
  }

  get applicationId () {
    return this._applicationId
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
   * @param {number|string} applicationId
   * @param {WsDataAuth} data
   */
  updateAuth (applicationId, data) {
    Logger.info(`{${applicationId}} Auth for: ${data.userId} (${data.userName})`)
    this._applicationId = applicationId
    this._userId = data.userId
    this._userName = data.userName
    this._accessToken = data.accessToken
    this._rateLimitModerator = data.rateLimitModerator
    this._rateLimitUser = data.rateLimitUser
  }

  /**
   * @param {number|string} applicationId
   * @param {WsDataSend} data
   */
  onSend (applicationId, data) {
    if (this.userId === data.botUserId) {
      if (data.channelName.charAt(0) === '#') {
        data.channelName = data.channelName.substr(1)
      }
      this.queue.sayWithWsDataReceiveSendObj(data)
    }
  }

  /**
   * @param {number|string} applicationId
   * @param {WsDataJoinPartSet} data
   */
  async onJoin (applicationId, data) {
    if (this.userId === data.botUserId) {
      await this.joinListOfNames(data.channelNames)
    }
  }

  /**
   * @param {number|string} applicationId
   * @param {WsDataJoinPartSet} data
   */
  async onPart (applicationId, data) {
    if (this.userId === data.botUserId) {
      await this.partListOfNames(data.channelNames)
    }
  }

  /**
   * @param {number|string} applicationId
   * @param {WsDataJoinPartSet} data
   */
  async onSetChannels (applicationId, data) {
    if (this.userId === data.botUserId) {
      let channelsToPart = this.ircConnectionPool.channels.filter(x => !data.channelNames.includes(x))
      let channelsToJoin = data.channelNames.filter(x => !this.ircConnectionPool.channels.includes(x))
      await this.partListOfNames(channelsToPart)
      await this.joinListOfNames(channelsToJoin)
    }
  }

  /**
   * @param {number|string} applicationId
   * @param {WsDataRequestIrcStates} data
   * @returns {Promise<void>}
   */
  async OnGetIrcStates (applicationId, data) {
    let dataArray = Object.values(this.lastUserStates).concat(Object.values(this.lastRoomStates))
    WebSocketServer.sendToAllClientForId(this.applicationId, this.userId, WsCmds.RECEIVE, dataArray)
  }

  async joinListOfNames (channelNames) {
    channelNames = channelNames.map(x => x.charAt(0) === '#' ? x.substr(0) : x)

    if (channelNames.length > 0) {
      Logger.info(`{${this.applicationId}} Joining: ${channelNames}`)
      for (const channelName of channelNames) {
        if (!Object.prototype.hasOwnProperty.call(this.channels, channelName)) {
          this.channels[channelName] = {lastMessage: "", lastMessageTimeMillis: 0}
        }
      }
      await this.ircConnectionPool.joinChannel(channelNames)
    }
  }

  async partListOfNames (channelNames) {
    if (channelNames.length > 0) {
      Logger.info(`{${this.applicationId}} Parting: ${channelNames}`)
      for (const channelName of channelNames) {
        if (!Object.prototype.hasOwnProperty.call(this.channels, channelName)) {
          delete this.channels[channelName]
        }
      }
      await this.ircConnectionPool.leaveChannel(channelNames)
    }
  }
}

module.exports = IrcClient

