import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('webextension-polyfill', () => ({
  default: {
    i18n: { getUILanguage: () => 'ru-RU' },
    notifications: {
      create: vi.fn(),
      clear: vi.fn(),
    },
    runtime: { getURL: (path: string) => path },
  },
}))

vi.mock('../storage', () => ({
  getPomodoroNotificationCursor: vi.fn(),
  setPomodoroNotificationCursor: vi.fn(),
}))

import {
  createPomodoroNotificationController,
  notificationAction,
  notificationSpec,
  type PomodoroEvent,
} from './pomodoro'
import browser from 'webextension-polyfill'
import {
  getPomodoroNotificationCursor,
  setPomodoroNotificationCursor,
} from '../storage'

const options = {
  system_notifications: true,
  chrome_notifications: true,
  sound_enabled: true,
}

describe('Pomodoro Chrome notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('formats a Russian distraction warning with pause and stop buttons', () => {
    const event: PomodoroEvent = {
      type: 'distraction_warning',
      session_id: 'session-1',
      sequence: 3,
      current_category: ['Media', 'Video'],
      remaining_milliseconds: 64_100,
      notifications: options,
    }

    const spec = notificationSpec(event, 'ru')
    expect(spec.message).toContain('Media > Video')
    expect(spec.message).toContain('1:05')
    expect(spec.buttons.map((button) => button.title)).toEqual([
      'Пауза',
      'Остановить',
    ])
  })

  it('maps the notification click and both Chrome buttons to all actions', () => {
    expect(notificationAction('distraction_warning')).toBe('continue')
    expect(notificationAction('distraction_warning', 0)).toBe('pause')
    expect(notificationAction('distraction_warning', 1)).toBe('stop')
    expect(notificationAction('distraction_warning', 2)).toBeUndefined()
  })

  it('offers start and stop after a completed phase', () => {
    const event: PomodoroEvent = {
      type: 'phase_completed',
      session_id: 'session-1',
      completed: { kind: 'focus', focus_number: 1 },
      next: { kind: 'short_break', after_focus: 1 },
      notifications: options,
    }

    const spec = notificationSpec(event, 'en')
    expect(spec.buttons.map((button) => button.title)).toEqual([
      'Start',
      'Stop',
    ])
    expect(notificationAction('phase_completed', 0)).toBe('continue')
  })

  it('resets a persisted cursor when aw-notify restarts', async () => {
    vi.mocked(getPomodoroNotificationCursor).mockResolvedValue({
      instanceId: 'old-instance',
      lastId: 99,
    })
    const event: PomodoroEvent = {
      type: 'session_completed',
      session_id: 'session-2',
      focus_intervals: 8,
      notifications: options,
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            instance_id: 'new-instance',
            latest_id: 0,
            items: [],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            instance_id: 'new-instance',
            latest_id: 1,
            items: [{ id: 1, event }],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await createPomodoroNotificationController().poll()

    expect(fetchMock.mock.calls[0][0]).toContain('after=99')
    expect(fetchMock.mock.calls[1][0]).toContain('after=0')
    expect(browser.notifications.create).toHaveBeenCalledTimes(1)
    expect(setPomodoroNotificationCursor).toHaveBeenCalledWith({
      instanceId: 'new-instance',
      lastId: 1,
    })
  })
})
