import browser from 'webextension-polyfill'
import config from './config'

// Periodically message the background to keep the Service Worker alive.
function keepAlive() {
  browser.runtime.sendMessage({ type: 'KEEP_ALIVE' }).catch(() => {
    // Expected during reload
  })
}

setInterval(keepAlive, config.focusGuard.intervalInSeconds * 1000)
keepAlive()
