import browser from 'webextension-polyfill'
import config from '../config'
import {
  getPomodoroNotificationCursor,
  setPomodoroNotificationCursor,
} from '../storage'

type NotificationAction = 'continue' | 'pause' | 'stop'
type PhaseKind = 'focus' | 'short_break' | 'long_break'

interface Phase {
  kind: PhaseKind
  focus_number?: number
  after_focus?: number
}

interface NotificationOptions {
  system_notifications: boolean
  chrome_notifications: boolean
  sound_enabled: boolean
}

interface DistractionWarningEvent {
  type: 'distraction_warning'
  session_id: string
  sequence: number
  current_category?: string[]
  remaining_milliseconds: number
  notifications: NotificationOptions
}

interface PhaseCompletedEvent {
  type: 'phase_completed'
  session_id: string
  completed: Phase
  next: Phase
  notifications: NotificationOptions
}

interface SessionCompletedEvent {
  type: 'session_completed'
  session_id: string
  focus_intervals: number
  notifications: NotificationOptions
}

interface PausedEvent {
  type: 'afk_paused' | 'monitoring_unavailable_paused'
  session_id: string
  notifications: NotificationOptions
}

export type PomodoroEvent =
  | DistractionWarningEvent
  | PhaseCompletedEvent
  | SessionCompletedEvent
  | PausedEvent

interface QueuedNotification {
  id: number
  event: PomodoroEvent
}

interface NotificationPage {
  items: QueuedNotification[]
  latest_id: number
  instance_id: string
}

export interface ChromeNotificationSpec {
  title: string
  message: string
  contextMessage?: string
  buttons: Array<{ title: string }>
  requireInteraction: boolean
}

type EventType = PomodoroEvent['type']

const notificationIdPattern =
  /^aw-pomodoro-(\d+)-(distraction_warning|phase_completed|session_completed|afk_paused|monitoring_unavailable_paused)$/

function locale(): 'ru' | 'en' {
  return browser.i18n.getUILanguage().toLowerCase().startsWith('ru')
    ? 'ru'
    : 'en'
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function phaseName(phase: Phase, language: 'ru' | 'en'): string {
  if (language === 'ru') {
    if (phase.kind === 'focus') return `работу №${phase.focus_number ?? ''}`
    if (phase.kind === 'short_break') return 'короткий перерыв'
    return 'длинный перерыв'
  }
  if (phase.kind === 'focus') return `work phase ${phase.focus_number ?? ''}`
  if (phase.kind === 'short_break') return 'the short break'
  return 'the long break'
}

export function notificationSpec(
  event: PomodoroEvent,
  language: 'ru' | 'en',
): ChromeNotificationSpec {
  switch (event.type) {
    case 'distraction_warning': {
      const category = event.current_category?.join(' > ')
      const remaining = formatRemaining(event.remaining_milliseconds)
      return language === 'ru'
        ? {
            title: 'ActivityWatch · Отвлечение',
            message: category
              ? `Вы переключились на «${category}». До конца работы ${remaining}.`
              : `Текущая активность не имеет категории. До конца работы ${remaining}.`,
            contextMessage: 'Нажмите уведомление, чтобы продолжить фокус',
            buttons: [{ title: 'Пауза' }, { title: 'Остановить' }],
            requireInteraction: true,
          }
        : {
            title: 'ActivityWatch · Distraction',
            message: category
              ? `You switched to “${category}”. ${remaining} remains in this work phase.`
              : `The current activity is uncategorized. ${remaining} remains in this work phase.`,
            contextMessage: 'Click the notification to continue focusing',
            buttons: [{ title: 'Pause' }, { title: 'Stop' }],
            requireInteraction: true,
          }
    }
    case 'phase_completed':
      return language === 'ru'
        ? {
            title:
              event.completed.kind === 'focus'
                ? 'ActivityWatch · Работа завершена'
                : 'ActivityWatch · Перерыв завершён',
            message: `Следующий этап — ${phaseName(event.next, language)}. Запустить его?`,
            buttons: [{ title: 'Начать' }, { title: 'Остановить' }],
            requireInteraction: true,
          }
        : {
            title:
              event.completed.kind === 'focus'
                ? 'ActivityWatch · Work phase complete'
                : 'ActivityWatch · Break complete',
            message: `Next is ${phaseName(event.next, language)}. Start it now?`,
            buttons: [{ title: 'Start' }, { title: 'Stop' }],
            requireInteraction: true,
          }
    case 'session_completed':
      return language === 'ru'
        ? {
            title: 'ActivityWatch · Томато завершён',
            message: `Выполнено рабочих этапов: ${event.focus_intervals}.`,
            buttons: [],
            requireInteraction: false,
          }
        : {
            title: 'ActivityWatch · Pomodoro complete',
            message: `Completed work phases: ${event.focus_intervals}.`,
            buttons: [],
            requireInteraction: false,
          }
    case 'afk_paused':
      return language === 'ru'
        ? {
            title: 'ActivityWatch · Таймер на паузе',
            message:
              'Обнаружено отсутствие за компьютером. Вернитесь и продолжите таймер вручную.',
            buttons: [{ title: 'Продолжить' }, { title: 'Остановить' }],
            requireInteraction: true,
          }
        : {
            title: 'ActivityWatch · Timer paused',
            message:
              'You are away from the computer. Return and resume the timer manually.',
            buttons: [{ title: 'Continue' }, { title: 'Stop' }],
            requireInteraction: true,
          }
    case 'monitoring_unavailable_paused':
      return language === 'ru'
        ? {
            title: 'ActivityWatch · Контроль активности недоступен',
            message:
              'Таймер безопасно поставлен на паузу. После восстановления продолжите вручную.',
            buttons: [{ title: 'Продолжить' }, { title: 'Остановить' }],
            requireInteraction: true,
          }
        : {
            title: 'ActivityWatch · Activity monitoring unavailable',
            message:
              'The timer was paused safely. Resume it manually after monitoring recovers.',
            buttons: [{ title: 'Continue' }, { title: 'Stop' }],
            requireInteraction: true,
          }
  }
}

export function notificationAction(
  eventType: EventType,
  buttonIndex?: number,
): NotificationAction | undefined {
  if (eventType === 'session_completed') return undefined
  if (buttonIndex === undefined) return 'continue'
  if (eventType === 'distraction_warning') {
    return buttonIndex === 0 ? 'pause' : buttonIndex === 1 ? 'stop' : undefined
  }
  return buttonIndex === 0 ? 'continue' : buttonIndex === 1 ? 'stop' : undefined
}

function encodeNotificationId(notification: QueuedNotification): string {
  return `aw-pomodoro-${notification.id}-${notification.event.type}`
}

function decodeNotificationId(
  notificationId: string,
): { id: number; eventType: EventType } | undefined {
  const match = notificationId.match(notificationIdPattern)
  if (!match) return undefined
  return { id: Number(match[1]), eventType: match[2] as EventType }
}

async function requestNotifications(after: number): Promise<NotificationPage> {
  const response = await fetch(
    `${config.pomodoro.apiBaseUrl}/notifications?after=${after}`,
    { cache: 'no-store' },
  )
  if (!response.ok) throw new Error(`Pomodoro API returned ${response.status}`)
  return (await response.json()) as NotificationPage
}

async function sendAction(
  notificationId: number,
  action: NotificationAction,
): Promise<boolean> {
  const response = await fetch(
    `${config.pomodoro.apiBaseUrl}/notifications/${notificationId}/action`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    },
  )
  if (!response.ok) throw new Error(`Pomodoro API returned ${response.status}`)
  const result = (await response.json()) as { applied?: boolean }
  return result.applied === true
}

export function createPomodoroNotificationController() {
  let polling: Promise<void> | undefined

  const pollOnce = async () => {
    const storedCursor = await getPomodoroNotificationCursor()
    let page = await requestNotifications(storedCursor?.lastId ?? 0)
    if (storedCursor && storedCursor.instanceId !== page.instance_id) {
      page = await requestNotifications(0)
    }

    let lastId =
      storedCursor?.instanceId === page.instance_id ? storedCursor.lastId : 0
    for (const notification of page.items) {
      if (!notification.event.notifications.chrome_notifications) continue
      const spec = notificationSpec(notification.event, locale())
      const options: browser.Notifications.CreateNotificationOptions & {
        buttons: Array<{ title: string }>
        requireInteraction: boolean
        silent: boolean
      } = {
        type: 'basic',
        iconUrl: browser.runtime.getURL('logo-128.png'),
        title: spec.title,
        message: spec.message,
        contextMessage: spec.contextMessage,
        buttons: spec.buttons,
        requireInteraction: spec.requireInteraction,
        silent: true,
      }
      await browser.notifications.create(
        encodeNotificationId(notification),
        options,
      )
      lastId = Math.max(lastId, notification.id)
    }

    await setPomodoroNotificationCursor({
      instanceId: page.instance_id,
      lastId: Math.max(lastId, page.latest_id),
    })
  }

  const poll = () => {
    if (polling) return polling
    polling = pollOnce()
      .catch((error) =>
        console.debug('Pomodoro notification service is unavailable:', error),
      )
      .finally(() => {
        polling = undefined
      })
    return polling
  }

  const act = async (chromeNotificationId: string, buttonIndex?: number) => {
    const decoded = decodeNotificationId(chromeNotificationId)
    if (!decoded) return
    const action = notificationAction(decoded.eventType, buttonIndex)
    if (!action) return
    try {
      await sendAction(decoded.id, action)
      await browser.notifications.clear(chromeNotificationId)
    } catch (error) {
      console.error('Failed to apply Pomodoro notification action:', error)
    }
  }

  return { poll, act }
}
