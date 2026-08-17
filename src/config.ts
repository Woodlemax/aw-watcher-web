const config = {
  isDevelopment: import.meta.env.DEV,
  requireConsent: import.meta.env.VITE_TARGET_BROWSER === 'firefox',
  heartbeat: {
    alarmName: 'heartbeat',
    intervalInSeconds: 60,
  },
  focusGuard: {
    enabled: import.meta.env.VITE_TARGET_BROWSER === 'chrome',
    endpoint: 'http://127.0.0.1:8765/',
    intervalInSeconds: 5,
    allowedUrlPatterns: ['*://*.yadro.com/*', '*://*.github.com/*'],
  },
}

export default config
