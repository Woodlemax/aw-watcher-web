type ParsedPattern = {
  scheme: string
  hostname: string
  includeSubdomains: boolean
  path: string
}

function parsePattern(pattern: string): ParsedPattern | undefined {
  const match = pattern.trim().match(/^(\*|https?):\/\/(\*\.)?([^/]+)(\/.*)$/i)

  if (!match) return undefined

  return {
    scheme: match[1].toLowerCase(),
    includeSubdomains: match[2] === '*.',
    hostname: match[3].toLowerCase().replace(/\.$/, ''),
    path: match[4],
  }
}

function globMatches(value: string, glob: string): boolean {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`).test(value)
}

function urlMatchesPattern(url: URL, pattern: ParsedPattern): boolean {
  const schemeMatches =
    pattern.scheme === '*' || url.protocol === `${pattern.scheme}:`
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  const hostnameMatches = pattern.includeSubdomains
    ? hostname === pattern.hostname || hostname.endsWith(`.${pattern.hostname}`)
    : hostname === pattern.hostname

  return (
    schemeMatches &&
    hostnameMatches &&
    globMatches(`${url.pathname}${url.search}${url.hash}`, pattern.path)
  )
}

/**
 * Match a URL without retaining or returning it. Invalid, internal, and missing
 * URLs fail closed.
 */
export function isFocusGuardUrlAllowed(
  url: string | undefined,
  patterns: readonly string[],
): boolean {
  if (!url) return false

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return false
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return false
  }

  return patterns.some((pattern) => {
    const parsedPattern = parsePattern(pattern)
    return parsedPattern ? urlMatchesPattern(parsedUrl, parsedPattern) : false
  })
}

/** Send only the boolean decision to the loopback Focus Guard listener. */
export async function sendFocusGuardStatus(
  endpoint: string,
  allowed: boolean,
): Promise<void> {
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowed }),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
}
