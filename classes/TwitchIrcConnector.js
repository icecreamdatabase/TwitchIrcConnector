"use strict"
const WebSocketServer = new (require('./WsServer')) // singleton
const IrcClient = require('./IrcClient')
const WsCmds = require('../ENUMS/WsCmds')
const Logger = require('./helper/Logger')


class TwitchIrcConnector {
  constructor () {
    /**
     * @type {Object.<number|string,IrcClient>}
     * @private
     */
    this._clients = {}
    WebSocketServer.on(WsCmds.AUTH, this.onAuth.bind(this))
    WebSocketServer.on(WsCmds.REMOVE_BOT, this.onRemove.bind(this))
    Logger.info(`Listening for auth...`)
  }

  /**
   * @param {WsDataAuth} data
   */
  onAuth (data) {
    if (Object.prototype.hasOwnProperty.call(this._clients, data.userId)) {
      this._clients[data.userId].updateAuth(data)
    } else {
      Logger.info(`First time auth for: ${data.userId} (${data.userName})`)
      this._clients[data.userId] = new IrcClient(data)
    }
  }

  /**
   * @param {WsDataRemoveBot} data
   */
  onRemove (data) {
    delete data[data.userId]
  }


}

module.exports = TwitchIrcConnector

