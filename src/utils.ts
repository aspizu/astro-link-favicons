import {inspect} from "node:util"

import type {AstroIntegrationLogger} from "astro"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

export async function wget(url: URL, domain: string, logger: AstroIntegrationLogger) {
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
    if (res.status === 429) {
      logger.warn(
        `${url.hostname}: ${status}. Set overrides["${domain}"] to an image on another host.`,
      )
    } else {
      logger.warn(
        `${url.hostname}: ${status}. Set overrides["${domain}"] to an accessible image URL.`,
      )
    }
  } catch (error) {
    const message = stringifyError(error)
    if (error instanceof Error && error.name === "TimeoutError") {
      logger.warn(
        `${url.hostname}: ${message}. Set overrides["${domain}"] to an image that responds within 5 seconds.`,
      )
    } else {
      logger.warn(
        `${url.hostname}: ${message}. Check connectivity from the build machine or set overrides["${domain}"] to a reachable image URL.`,
      )
    }
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
  let message: string
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === "string") {
    message = error
  } else {
    message = inspect(error, {breakLength: Infinity})
  }
  return message.split(/\r?\n/, 1)[0]
}
