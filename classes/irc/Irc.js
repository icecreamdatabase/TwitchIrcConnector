"use strict"
//CLASSES
const Logger = require('../helper/Logger')
const IrcConnectionPool = require('./IrcConnectionPool')
const Queue = require('./Queue.js')

const ChatLimit = require("../../ENUMS/ChatLimit")

//update channels every 120 seconds (2 minutes)
const UPDATE_ALL_CHANNELS_INTERVAL = 120000 //ms

class Irc {
  /**
   * @param {TwitchIrcConnector} bot
   */
  constructor (bot) {
    this._bot = bot

    /**
     * @type {Queue}
     * @private
     */
    this._queue = undefined

    Logger.info(`Setting up bot: ${this.bot.userId} (${this.bot.userName})`)

    this.rateLimitUser = ChatLimit.NORMAL
    this.rateLimitModerator = ChatLimit.NORMAL_MOD

    /**
     * @type IrcConnectionPool
     * @private
     */
    this._ircConnectionPool = undefined
    /**
     * @type {SqlChannelObj[]}
     */
    this.channels = []

    this.updateBotRatelimits().then(this.setupIrc.bind(this))
  }

  /**
   * @return {Bot}
   */
  get bot () {
    return this._bot
  }

  /**
   * @return {Queue}
   */
  get queue () {
    return this._queue
  }

  /**
   * @return {IrcConnectionPool}
   */
  get ircConnectionPool () {
    return this._ircConnectionPool
  }

  async setupIrc () {
    Logger.info(`### Connecting: ${this.bot.userId} (${this.bot.userName})`)

    this._ircConnectionPool = new IrcConnectionPool(this.bot)

    this._queue = new Queue(this.bot)

    await this.bot.userIdLoginCache.prefetchFromDatabase()

    //OnX modules
    this._privMsg = new PrivMsg(this.bot)
    this._userNotice = new UserNotice(this.bot)
    this._clearChat = new ClearChat(this.bot)
    this._clearMsg = new ClearMsg(this.bot)
    this._userState = new UserState(this.bot)

    await this.updateBotChannels()
    Logger.info("### Connected: " + this.bot.userId + " (" + this.bot.userName + ")")
    await this.bot.userIdLoginCache.checkNameChanges()
    setInterval(this.updateBotChannels.bind(this), UPDATE_ALL_CHANNELS_INTERVAL)

    Logger.info("### Fully setup: " + this.bot.userId + " (" + this.bot.userName + ")")
  }

  /**
   * Update and sync this.channels object from database
   * @returns {Promise<void>} "All channels updated promise"
   */
  async updateBotChannels () {
    let allChannelData = await SqlChannels.getChannelData(this.bot.userId)

    //remove unused channels
    for (let channelId in this.channels) {
      if (Object.prototype.hasOwnProperty.call(this.channels, channelId)) {
        //check
        let contains = false
        for (let currentChannelId in allChannelData) {
          if (Object.prototype.hasOwnProperty.call(allChannelData, currentChannelId)) {
            if (allChannelData[currentChannelId].channelID === this.channels[channelId].channelID) {
              if (allChannelData[currentChannelId].channelName !== this.channels[channelId].channelName) {
                //user has changed their name. Leave the old channel and join the new one.
                this.ircConnectionPool.leaveChannel(this.channels[channelId].channelName)
                await this.ircConnectionPool.joinChannel(allChannelData[currentChannelId].channelName)
              }
              contains = true
            }
          }
        }
        //part
        if (!contains) {
          let channelName = await this.bot.userIdLoginCache.idToName(channelId)
          if (channelName) {
            this.ircConnectionPool.leaveChannel(channelName)
            Logger.info(this.bot.userName + " Parted: #" + channelName)
          }
        }
      }
    }
    //add new channels
    for (let channelId in allChannelData) {
      if (Object.prototype.hasOwnProperty.call(allChannelData, channelId)) {
        //check
        let contains = false
        for (let currentChannelId in this.channels) {
          if (Object.prototype.hasOwnProperty.call(this.channels, currentChannelId)) {
            if (this.channels[currentChannelId].channelID === allChannelData[channelId].channelID) {
              contains = true
              // Don't reset these 3 values. Copy them over instead.
              allChannelData[channelId].botStatus = this.channels[currentChannelId].botStatus || null
              allChannelData[channelId].lastMessage = this.channels[currentChannelId].lastMessage || ""
              allChannelData[channelId].lastMessageTimeMillis = this.channels[currentChannelId].lastMessageTimeMillis || 0
            }
          }
        }
        //join
        if (!contains) {
          let channelName = await this.bot.userIdLoginCache.idToName(channelId)
          if (channelName) {
            await this.ircConnectionPool.joinChannel(channelName)
            Logger.info(this.bot.userName + " Joined: #" + channelName)
          }
          allChannelData[channelId].botStatus = null
          allChannelData[channelId].lastMessage = ""
          allChannelData[channelId].lastMessageTimeMillis = 0
        }
      }
    }
    //save changes to bot array
    this.channels = allChannelData
  }

  async updateBotRatelimits () {
    let userInfo = await this.bot.api.kraken.userInfo(this.bot.userId)

    if (userInfo["is_verified_bot"]) {
      this.rateLimitUser = ChatLimit.VERIFIED
      this.rateLimitModerator = ChatLimit.VERIFIED_MOD
    } else if (userInfo["is_known_bot"]) {
      this.rateLimitUser = ChatLimit.KNOWN
      this.rateLimitModerator = ChatLimit.KNOWN_MOD
    } else {
      this.rateLimitUser = ChatLimit.NORMAL
      this.rateLimitModerator = ChatLimit.NORMAL_MOD
    }
  }
}

module.exports = Irc
