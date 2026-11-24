import {inspect} from "node:util"

import type {AstroIntegrationLogger} from "astro"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

export async function wget(url: URL, logger: AstroIntegrationLogger) {
  try {
    const res = await fetch(url, {
      headers: {"User-Agent": UA},
      signal: AbortSignal.timeout(5_000),
    })
    if (res.ok) {
      return res
    }
    await res.body?.cancel()
    const status = `HTTP ${res.status} ${res.statusText}`.trimEnd()
    const hint =
      res.status === 429
        ? "Wait for the rate limit to reset or set an override on another host."
        : "Set a favicon override pointing to an accessible image URL."
    logger.warn(`${url.hostname}: ${status}. ${hint}`)
  } catch (error) {
    const hint =
      error instanceof Error && error.name === "TimeoutError"
        ? "Set a favicon override to an image that responds within 5 seconds."
        : "Check connectivity from the build machine or set a reachable favicon override."
    logger.warn(`${url.hostname}: ${stringifyError(error)}. ${hint}`)
  }
  return null
}

export function getExternalHostname(
  href: string,
  siteHostname: string | undefined,
): string | null {
  const hasHttpPrefix = /^https?:\/\//i.test(href)
  if (!hasHttpPrefix) {
    return null
  }
  const url = URL.parse(href)
  if (
    !url ||
    url.hostname === "." ||
    url.hostname === ".." ||
    url.hostname === siteHostname
  ) {
    return null
  }
  return url.hostname
}

export function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    error = error.message
  }
  const message =
    typeof error === "string" ? error : inspect(error, {breakLength: Infinity})
  return message.split(/\r?\n/, 1)[0]
}
