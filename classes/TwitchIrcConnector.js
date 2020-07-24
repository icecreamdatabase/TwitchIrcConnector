"use strict"
const WebSocketServer = new (require('./WsServer')) // singleton
const IrcClient = require('./IrcClient')
const WsCmds = require('../ENUMS/WsCmds')
const Logger = require('./helper/Logger')


class TwitchIrcConnector {
  constructor () {
    /**
     * Key is build like "applicationId;botUserId".
     * @type {Object.<string,IrcClient>}
     * @private
     */
    this._clients = {}
    WebSocketServer.on(WsCmds.AUTH, this.onAuth.bind(this))
    WebSocketServer.on(WsCmds.REMOVE_BOT, this.onRemove.bind(this))
    Logger.info(`Listening for auth...`)
  }

  /**
   * @param {number|string} applicationId
   * @param {WsDataAuth} data
   */
  onAuth (applicationId, data) {
    if (Object.prototype.hasOwnProperty.call(this._clients, `${applicationId};${data.userId}`)) {
      this._clients[`${applicationId};${data.userId}`].updateAuth(applicationId, data)
    } else {
      Logger.info(`{${applicationId}} First time auth for: ${data.userId} (${data.userName})`)
      this._clients[`${applicationId};${data.userId}`] = new IrcClient(applicationId, data)
    }
  }

  /**
   * @param {number|string} applicationId
   * @param {WsDataRemoveBot} data
   */
  onRemove (applicationId, data) {
    delete data[`${applicationId};${data.userId}`]
  }


}

module.exports = TwitchIrcConnector

