import * as path from "node:path"

import {getCachedFavicon} from "./cache"
import {FaviconConfig} from "./config"
import {getExternalHostname} from "./utils"

declare const __ASTRO_LINK_FAVICON_ASSETS_DIR__: string
declare const __ASTRO_LINK_FAVICON_FILES__: Record<string, string | null>

export async function lookupFavicon(href: string | URL, config: FaviconConfig) {
  const hostname = getExternalHostname(href.toString(), config.siteHostname)
  if (!hostname) {
    return null
  }
  let file
  if (typeof __ASTRO_LINK_FAVICON_FILES__ === "undefined") {
    file = await getCachedFavicon(config.cacheDir, hostname)
  } else if (Object.hasOwn(__ASTRO_LINK_FAVICON_FILES__, hostname)) {
    file = __ASTRO_LINK_FAVICON_FILES__[hostname]
  }
  return file ? `${config.faviconPath}/${hostname}/${path.basename(file)}` : null
}

export async function getFaviconUrl(href: string | URL): Promise<string | null> {
  const config = await import("astro:config/server")
  return lookupFavicon(
    href,
    new FaviconConfig(config, __ASTRO_LINK_FAVICON_ASSETS_DIR__),
  )
}
