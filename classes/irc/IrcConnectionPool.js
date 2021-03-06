"use strict"
const TwitchIrcConnection = require('./TwitchIrcConnection')
const ChatLimit = require('./../../ENUMS/ChatLimit')
const Logger = require('./../helper/Logger')
const BasicBucket = require('./BasicBucket')

const maxChannelsPerConnection = 50

const SEND_CONNECTION_COUNT_VERIFIED = 5
const SEND_CONNECTION_COUNT_ELSE = 2

class IrcConnectionPool {
  /**
   * @param {IrcClient} ircClient
   */
  constructor (ircClient) {
    this._ircClient = ircClient
    /**
     * @type {TwitchIrcConnection[]}
     */
    this.sendConnections = []
    this.sendConnectionLastIndex = 0
    /**
     * @type {TwitchIrcConnection[]}
     */
    this.receiveConnections = []
    /**
     * @type {{event:string, fn:function(string), context:any}[]}
     */
    this.events = []

    /**
     * @type {Set<string>}
     */
    this.channelsInJoinQueue = new Set()

    this.connectSendConnections()
  }

  /**
   * @returns {IrcClient}
   */
  get ircClient () {
    return this._ircClient
  }

  get channels () {
    let channels = []
    for (const receiveConnection of this.receiveConnections) {
      channels.push(...receiveConnection.channels)
    }
    return channels
  }

  /**
   * Returns average pings of all connections rounded to two decimal places.
   * NaN if no connection exists.
   * @return {number}
   */
  get averagePing () {
    const pings = this.allPingDurations
    return Math.round(pings.reduce((a, b) => a + b, 0) / pings.length * 100) / 100
  }

  /**
   * Returns max ping of all connections rounded to two decimal places.
   * -Infinity if no connection exists.
   * @return {number}
   */
  get maxPing () {
    return Math.round(Math.max(...this.allPingDurations) * 100) / 100
  }

  /**
   * Returns min ping of all connections rounded to two decimal places.
   * Infinity if no connection exists.
   * @return {number}
   */
  get minPing () {
    return Math.round(Math.min(...this.allPingDurations) * 100 / 100)
  }

  /**
   * @return {number[]}
   */
  get allPingDurations () {
    let pings = []
    for (let connection of this.receiveConnections) {
      pings.push(connection.lastPingDuration)
    }
    for (let connection of this.sendConnections) {
      pings.push(connection.lastPingDuration)
    }
    return pings
  }

  connectSendConnections () {
    let connectionsSendCount = this.ircClient.rateLimitModerator === ChatLimit.VERIFIED_MOD
      ? SEND_CONNECTION_COUNT_VERIFIED
      : SEND_CONNECTION_COUNT_ELSE

    for (let i = 0; i < connectionsSendCount; i++) {
      let connection = new TwitchIrcConnection(this.ircClient)
      connection.connect().then(() => {
        this.sendConnections.push(connection)
      })
    }
  }

  say (channel, message, useSameSendConnectionAsPrevious = false, replyParentMessage) {
    if (this.sendConnections.length > 0) {
      if (!useSameSendConnectionAsPrevious) {
        this.sendConnectionLastIndex = ++this.sendConnectionLastIndex % this.sendConnections.length
      }
      this.sendConnections[this.sendConnectionLastIndex].say(channel, message, replyParentMessage)
    } else {
      Logger.warn(`${this.ircClient.applicationId} No send connection yet`)
    }
  }

  on (event, fn, context) {
    this.events.push({event, fn, context})
    for (let receiveConnection of this.receiveConnections) {
      receiveConnection.on(event, fn, context)
    }
  }

  /**
   * @param {string|string[]} channels
   */
  async joinChannel (channels) {
    if (!Array.isArray(channels)) {
      channels = [channels]
    }

    let channelsNotYetAdded = []

    for (let channel of channels) {
      if (!this.getConnectionByChannel(channel)
        && !this.channelsInJoinQueue.has(channel)) {
        this.channelsInJoinQueue.add(channel)
        channelsNotYetAdded.push(channel)
      }
    }

    while (channelsNotYetAdded.length > 0) {
      let channelPart = channelsNotYetAdded.splice(0, maxChannelsPerConnection)
      let connection = await this.getFreeConnection(channelPart.length)
      if (connection) {
        connection.joinListWithRatelimit(channelPart,
          chJoined => this.channelsInJoinQueue.delete(chJoined)
        ).then(() => Logger.log(`{${this.ircClient.applicationId}} Finished joining channels...`))
        await (ms => new Promise(resolve => setTimeout(resolve, ms)))(2500)
      } else {
        throw Error(`Couldn't get free irc connection for channelPart with length: ${channelPart.length}`)
      }
    }
  }

  /**
   * @param {string|string[]} channels
   */
  leaveChannel (channels) {
    if (!Array.isArray(channels)) {
      channels = [channels]
    }

    for (let channel of channels) {
      let connection = this.getConnectionByChannel(channel)
      if (connection) {
        connection.leave(channel)
      }
    }
  }

  /**
   * @param {string|string[]} channels
   */
  async rejoinChannel (channels) {
    this.leaveChannel(channels)
    await this.joinChannel(channels)
  }

  /**
   * @param {string} channel
   * @return {undefined|TwitchIrcConnection}
   */
  getConnectionByChannel (channel) {
    for (let connection of this.receiveConnections) {
      if (connection.channels.includes(channel)) {
        return connection
      }
    }
    return undefined
  }

  /**
   * @param requiredJoinSlots How many slots are required.
   * @return {Promise<TwitchIrcConnection>}
   */
  async getFreeConnection (requiredJoinSlots) {
    for (let connection of this.receiveConnections) {
      if (connection.channels.length + requiredJoinSlots < maxChannelsPerConnection) {
        return connection
      }
    }
    return await this.addConnectionToPool()
  }

  /**
   * @return {Promise<TwitchIrcConnection>}
   */
  async addConnectionToPool () {
    let newConnection = new TwitchIrcConnection(this.ircClient)
    await newConnection.connect()
    for (let event of this.events) {
      newConnection.on(event.event, event.fn, event.context)
    }
    this.receiveConnections.push(newConnection)
    Logger.debug(`{${this.ircClient.applicationId}} ${this.ircClient.userId} (${this.ircClient.userName}) ~~~ New pool count: ${this.receiveConnections.length}`)
    return newConnection
  }
}

module.exports = IrcConnectionPool
