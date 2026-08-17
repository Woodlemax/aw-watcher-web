# Pomodoro Chrome integration

The extension complements the background Pomodoro service in `aw-notify`:

- active tab, URL/title, and focused-window changes schedule a heartbeat after
  a 250 ms debounce;
- a serialized sender prevents overlapping heartbeats during rapid navigation;
- Chrome polls the loopback notification queue every second while its offscreen
  document is running, with a 30-second alarm as a fallback;
- the persisted queue cursor includes the `aw-notify` instance ID, so a service
  restart cannot hide new low-numbered events;
- notification actions are sent back to `aw-notify`, which validates the exact
  session, phase, pause reason, or distraction sequence;
- closing Chrome does not affect the timer because the timer remains owned by
  `aw-notify`.

## Chrome action layout

Chrome supports at most two visible notification action buttons. A distraction
warning therefore exposes all three required actions as follows:

- click the notification body: Continue;
- first button: Pause;
- second button: Stop.

Phase-complete and paused notifications use Continue/Start and Stop as their two
buttons. Chrome notifications are silent because `aw-notify` owns the single
sound signal and prevents duplicate audio when Windows and Chrome channels are
both enabled.

## Development build

```sh
npm ci
npx vitest run
VITE_TARGET_BROWSER=chrome npx vite build
```

Load the generated `build` directory through `chrome://extensions` with
Developer mode enabled.

## Manual check

1. Start ActivityWatch with the Pomodoro-enabled `aw-notify` service.
2. Load the unpacked `build` directory and keep Chrome notifications enabled in
   the Pomodoro settings.
3. Start a short work phase for one selected category.
4. Navigate to a URL classified outside that category and confirm that the new
   web event reaches ActivityWatch immediately instead of waiting for the
   minute alarm.
5. Wait for the distraction timeout and verify the notification-body Continue
   action, Pause button, and Stop button in separate sessions.
6. Complete a short phase and start the next phase from its Chrome notification.
7. Close Chrome during a running phase and confirm in ActivityWatch after
   reopening it that the background timer continued.
