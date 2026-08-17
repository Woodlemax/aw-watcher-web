const config = {
  isDevelopment: import.meta.env.DEV,
  requireConsent: import.meta.env.VITE_TARGET_BROWSER === 'firefox',
  heartbeat: {
    alarmName: 'heartbeat',
    intervalInSeconds: 60,
    activityChangeDebounceMilliseconds: 250,
  },
  pomodoro: {
    alarmName: 'pomodoro-notifications',
    apiBaseUrl: 'http://127.0.0.1:5667/pomodoro',
    pollIntervalMilliseconds: 1000,
  },
}

export default config
