import browser from 'webextension-polyfill'
import config from './config'

// Send a message to the background every 20 seconds to keep the Service Worker alive
function keepAlive() {
  browser.runtime.sendMessage({ type: 'KEEP_ALIVE' }).catch(() => {
    // Expected during reload
  })
}

setInterval(keepAlive, 20 * 1000)
keepAlive()

function pollPomodoroNotifications() {
  browser.runtime.sendMessage({ type: 'POMODORO_POLL' }).catch(() => {
    // Expected during reload
  })
}

setInterval(pollPomodoroNotifications, config.pomodoro.pollIntervalMilliseconds)
pollPomodoroNotifications()
