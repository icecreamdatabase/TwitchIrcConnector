"use strict"
const WebSocketServer = new (require('./WsServer')) // singleton
const Client = require('./Client')
const WsCmds = require('../ENUMS/WsCmds')


class TwitchIrcConnector {
  constructor () {
    /**
     * @type {Object.<number|string,Client>}
     * @private
     */
    this._clients = {}
    WebSocketServer.on(WsCmds.AUTH, this.onAuth.bind(this))
    WebSocketServer.on(WsCmds.REMOVE_BOT, this.onRemove.bind(this))
  }

  /**
   * @param {WsDataReceiveAuth} data
   */
  onAuth (data) {
    if (Object.prototype.hasOwnProperty.call(this._clients, data.userId)) {
      this._clients[data.userId].updateAuth(data)
    } else {
      this._clients[data.userId] = new Client(data)
    }
  }

  /**
   * @param {WsDataReceiveRemoveBot} data
   */
  onRemove (data) {
    delete data[data.userId]
  }


}

module.exports = TwitchIrcConnector

