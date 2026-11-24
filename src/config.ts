import * as path from "node:path"
import {fileURLToPath} from "node:url"

import type {AstroConfig} from "astro"

export const faviconDir = "_astro/_favicons"

export class FaviconConfig {
  readonly cacheDir: string
  readonly faviconPath: string
  readonly srcDir: string
  readonly siteHostname: string | undefined

  constructor(config: Pick<AstroConfig, "base" | "cacheDir" | "srcDir" | "site">) {
    this.cacheDir = path.join(fileURLToPath(config.cacheDir), "astro-link-favicons")
    this.faviconPath = path.posix.join("/", config.base, faviconDir)
    this.srcDir = fileURLToPath(config.srcDir)
    this.siteHostname = config.site ? new URL(config.site).hostname : undefined
  }
}

export const faviconConfig: {value?: FaviconConfig} = {}

export function requireFaviconConfig() {
  if (!faviconConfig.value) {
    throw new Error("Favicon integration uninitialized")
  }
  return faviconConfig.value
}
