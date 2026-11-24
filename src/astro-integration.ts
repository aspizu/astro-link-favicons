import * as fs from "node:fs/promises"
import * as path from "node:path"
import {fileURLToPath} from "node:url"

import type {AstroIntegrationLogger, HookParameters, ViteUserConfig} from "astro"
import sirv from "sirv"

import {copyFavicons, downloadFavicon, getCachedFaviconFiles} from "./cache"
import {FaviconConfig, faviconConfig, requireFaviconConfig} from "./config"
import {getAllDomains} from "./domains"
import {stringifyError} from "./utils"

async function _downloadAllFaviconsInner(logger: AstroIntegrationLogger) {
  const config = requireFaviconConfig()
  const domains = [...(await getAllDomains(config.srcDir, config.siteHostname))]
  await Promise.all(
    domains.map((domain) =>
      downloadFavicon(
        config.cacheDir,
        domain,
        logger,
        config.overrides.get(domain),
      ).catch((e) => logger.warn(`${domain}: ${stringifyError(e)}`)),
    ),
  )
}

let downloadAllFaviconsPromise: Promise<void> | null = null

async function _downloadAllFavicons(logger: AstroIntegrationLogger) {
  downloadAllFaviconsPromise ??= _downloadAllFaviconsInner(logger)
    .catch((e) => {
      logger.warn(stringifyError(e))
    })
    .then(() => {
      downloadAllFaviconsPromise = null
    })
  return downloadAllFaviconsPromise
}

function _vitePlugin(
  logger: AstroIntegrationLogger,
): NonNullable<ViteUserConfig["plugins"]>[number] {
  return {
    name: "astro-link-favicons:hmr",
    hotUpdate: {
      order: "pre",
      async handler(ctx) {
        if (this.environment.name !== "client" || ctx.type === "delete") return
        const isSourceFile = /\.(html|md|mdx|astro)$/i.test(ctx.file)
        if (!isSourceFile) return
        await _downloadAllFavicons(logger)
      },
    },
  }
}

export async function configSetup(
  {config, command, updateConfig, logger}: HookParameters<"astro:config:setup">,
  overrides?: Record<string, string>,
) {
  const settings = new FaviconConfig(config, config.build.assets, overrides)
  faviconConfig.value = settings
  await fs.mkdir(settings.cacheDir, {recursive: true})
  updateConfig({
    vite: {
      define: {__ASTRO_LINK_FAVICON_ASSETS_DIR__: JSON.stringify(config.build.assets)},
    },
  })
  if (command === "dev") {
    updateConfig({vite: {plugins: [_vitePlugin(logger)]}})
  } else if (command !== "build" && command !== "sync") return
  await _downloadAllFavicons(logger)
  if (command === "build") {
    const files = await getCachedFaviconFiles(settings.cacheDir)
    updateConfig({
      vite: {
        define: {
          __ASTRO_LINK_FAVICON_FILES__: JSON.stringify(files),
        },
      },
    })
  }
}

export async function buildDone({dir}: HookParameters<"astro:build:done">) {
  const config = requireFaviconConfig()
  await copyFavicons(config.cacheDir, path.join(fileURLToPath(dir), config.faviconDir))
}

export async function serverSetup({server}: HookParameters<"astro:server:setup">) {
  const config = requireFaviconConfig()
  server.middlewares.use(`/${config.faviconDir}`, sirv(config.cacheDir, {dev: true}))
}
