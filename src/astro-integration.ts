import * as fs from "node:fs/promises"
import * as path from "node:path"
import {fileURLToPath} from "node:url"

import type {HookParameters, ViteUserConfig} from "astro"
import sirv from "sirv"

import {copyFavicons, downloadFavicon, getCachedFaviconFiles} from "./cache"
import {FaviconConfig, faviconConfig, faviconDir, requireFaviconConfig} from "./config"
import {getAllDomains} from "./domains"

async function _downloadAllFaviconsInner() {
  const config = requireFaviconConfig()
  const domains = [...(await getAllDomains(config.srcDir, config.siteHostname))]
  await Promise.all(
    domains.map((domain) =>
      downloadFavicon(config.cacheDir, domain).catch((e) => {
        console.error(e)
      }),
    ),
  )
}

let downloadAllFaviconsPromise: Promise<void> | null = null

async function _downloadAllFavicons() {
  downloadAllFaviconsPromise ??= _downloadAllFaviconsInner()
    .catch((e) => {
      console.error(e)
    })
    .then(() => {
      downloadAllFaviconsPromise = null
    })
  return downloadAllFaviconsPromise
}

const vitePlugin: NonNullable<ViteUserConfig["plugins"]>[number] = {
  name: "astro-link-favicons:hmr",
  hotUpdate: {
    order: "pre",
    async handler(ctx) {
      if (this.environment.name !== "client" || ctx.type === "delete") return
      if (!/\.(html|md|mdx|astro)$/i.test(ctx.file)) return
      await _downloadAllFavicons()
    },
  },
}

export async function configSetup({
  config,
  command,
  updateConfig,
}: HookParameters<"astro:config:setup">) {
  const settings = new FaviconConfig(config)
  faviconConfig.value = settings
  await fs.mkdir(settings.cacheDir, {recursive: true})
  updateConfig({vite: {ssr: {noExternal: ["astro-link-favicons"]}}})
  if (command === "dev") {
    updateConfig({vite: {plugins: [vitePlugin]}})
  } else if (command !== "build" && command !== "sync") return
  await _downloadAllFavicons()
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
  await copyFavicons(config.cacheDir, path.join(fileURLToPath(dir), faviconDir))
}

export async function serverSetup({server}: HookParameters<"astro:server:setup">) {
  const config = requireFaviconConfig()
  server.middlewares.use(`/${faviconDir}`, sirv(config.cacheDir, {dev: true}))
}
