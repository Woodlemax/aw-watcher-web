import config from '../config'
import { isFocusGuardUrlAllowed, sendFocusGuardStatus } from '../focus-guard'
import { getTabs } from './helpers'

async function getActiveTabUrl(): Promise<string | undefined> {
  const tabs = await getTabs({ active: true, lastFocusedWindow: true })
  return tabs[0]?.url
}

/**
 * Publish only the current boolean state to the loopback Focus Guard listener.
 * The active URL is used transiently for matching and is never included in the
 * request, stored, or logged by this integration.
 */
export async function publishFocusGuardStatus(): Promise<void> {
  if (!config.focusGuard.enabled) return

  const allowed = isFocusGuardUrlAllowed(
    await getActiveTabUrl(),
    config.focusGuard.allowedUrlPatterns,
  )

  try {
    await sendFocusGuardStatus(config.focusGuard.endpoint, allowed)
  } catch {
    // The local companion is optional and may not be running.
    console.debug('Focus Guard listener is unavailable')
  }
}
