"use strict"
const TwitchIrcConnector = require('classes/TwitchIrcConnector')
const DiscordLog = require('./classes/helper/DiscordLog')
const Logger = require('./classes/helper/Logger')

const config = require('./config.json')


// Logging setup
function hookStderr (callback) {
  let oldWrite = process.stderr.write

  process.stderr.write = (write => function (string, encoding, fd) {
    write.apply(process.stderr, arguments)
    callback(string, encoding, fd)
  })(process.stderr.write)

  return function () {
    process.stderr.write = oldWrite
  }
}

if (config.logDiscord) {
  // noinspection JSUnusedLocalSymbols
  const unhook = hookStderr((string, encoding, fd) => {
    DiscordLog.error(string)
  })

  process.on('unhandledRejection', (reason, p) => {
    Logger.warn('Unhandled Rejection at promise:\n\n' + util.inspect(p) + '\n\nreason:\n' + util.inspect(reason))
  })
}

const twitchIrcConnector = new TwitchIrcConnector()
