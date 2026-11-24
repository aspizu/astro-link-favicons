import * as path from "node:path"
import {fileURLToPath} from "node:url"

import type {AstroConfig} from "astro"

export class FaviconConfig {
  readonly cacheDir: string
  readonly faviconDir: string
  readonly faviconPath: string
  readonly srcDir: string
  readonly siteHostname: string | undefined
  readonly overrides = new Map<string, URL>()

  constructor(
    config: Pick<AstroConfig, "base" | "cacheDir" | "srcDir" | "site">,
    assetsDir: string,
    overrides?: Record<string, string>,
  ) {
    this.cacheDir = path.join(fileURLToPath(config.cacheDir), "astro-link-favicons")
    this.faviconDir = path.posix.join(assetsDir, "_favicons")
    this.faviconPath = path.posix.join("/", config.base, this.faviconDir)
    this.srcDir = fileURLToPath(config.srcDir)
    if (config.site) {
      this.siteHostname = new URL(config.site).hostname
    }
    for (const [key, value] of Object.entries(overrides ?? {})) {
      const host = URL.parse(`https://${key}`)
      const hasInvalidHostCharacter = /[\\/@?#%*\s]/u.test(key)
      if (
        !host ||
        hasInvalidHostCharacter ||
        (key.includes(":") && !key.endsWith("]")) ||
        host.hostname === "." ||
        host.hostname === ".."
      ) {
        throw new Error(
          `Invalid favicon override hostname: ${key}. Use a bare hostname such as example.org as the override key.`,
        )
      }
      const url = URL.parse(value)
      const hasHttpPrefix = /^https?:\/\//i.test(value)
      if (!url || !hasHttpPrefix || !["http:", "https:"].includes(url.protocol)) {
        throw new Error(
          `Expected an absolute HTTP(S) favicon URL for ${key}. Set the override value to a full image URL such as https://example.org/icon.png.`,
        )
      }
      this.overrides.set(host.hostname, url)
    }
  }
}

export const faviconConfig: {value?: FaviconConfig} = {}

export function requireFaviconConfig() {
  if (!faviconConfig.value) {
    throw new Error("Favicon integration uninitialized")
  }
  return faviconConfig.value
}
