const startedAt = Date.now()

function elapsedMs() {
  return Date.now() - startedAt
}

function fail(message) {
  console.error(`[run-cron] failed duration_ms=${elapsedMs()} ${message}`)
  process.exit(1)
}

const appUrl = process.env.APP_URL?.trim()
const cronSecret = process.env.CRON_SECRET?.trim()
const path = process.argv[2]?.trim()

if (!appUrl) {
  fail('APP_URL is required')
}

if (!cronSecret) {
  fail('CRON_SECRET is required')
}

if (!path || !path.startsWith('/')) {
  fail('path argument is required and must start with /')
}

const baseUrl = appUrl.endsWith('/') ? appUrl : `${appUrl}/`
const url = new URL(path.replace(/^\/+/, ''), baseUrl)
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 300_000)

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cronSecret}`,
    },
    signal: controller.signal,
  })

  const duration = elapsedMs()
  const body = await response.text().catch(() => '')

  if (!response.ok) {
    console.error(
      `[run-cron] failed status=${response.status} duration_ms=${duration} path=${path} body=${body.slice(0, 500)}`,
    )
    process.exit(1)
  }

  console.log(`[run-cron] ok status=${response.status} duration_ms=${duration} path=${path}`)
  process.exit(0)
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  const label = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'error'
  console.error(`[run-cron] failed ${label} duration_ms=${elapsedMs()} path=${path} message=${reason}`)
  process.exit(1)
} finally {
  clearTimeout(timeout)
}
