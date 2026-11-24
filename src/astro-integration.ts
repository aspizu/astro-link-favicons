import * as fs from "node:fs/promises"
import * as path from "node:path"
import {fileURLToPath} from "node:url"

import type {AstroIntegration} from "astro"
import sirv from "sirv"

import {copyFavicons, downloadFavicon} from "./cache"
import {faviconConfig} from "./config"
import {getAllDomains} from "./domains"

const FAVICON_DIR = "_astro/_favicons"

let srcDir: string | null = null

async function _downloadAllFaviconsInner() {
  if (!srcDir) {
    throw new Error("srcDir uninitialized")
  }
  const {cacheDir, siteHostname} = faviconConfig
  if (!cacheDir) {
    throw new Error("cacheDir uninitialized")
  }
  const domains = [...(await getAllDomains(srcDir, siteHostname))]
  await Promise.all(
    domains.map((domain) =>
      downloadFavicon(cacheDir, domain).catch((e) => {
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

const integration: AstroIntegration = {
  name: "astro-link-favicons",
  hooks: {
    "astro:config:setup": async ({config, command, updateConfig}) => {
      faviconConfig.siteHostname = config.site
        ? new URL(config.site).hostname
        : undefined
      faviconConfig.faviconPath = path.posix.join("/", config.base, FAVICON_DIR)
      faviconConfig.cacheDir = path.join(
        fileURLToPath(config.cacheDir),
        "astro-link-favicons",
      )
      await fs.mkdir(faviconConfig.cacheDir, {recursive: true})
      srcDir = fileURLToPath(config.srcDir)
      if (command === "build" || command === "sync") {
        await _downloadAllFavicons()
        return
      }
      if (command !== "dev") return
      updateConfig({
        vite: {
          plugins: [
            {
              name: "astro-link-favicons:hmr",
              hotUpdate: {
                order: "pre",
                async handler(ctx) {
                  if (this.environment.name !== "client" || ctx.type === "delete")
                    return
                  if (!/\.(html|md|mdx|astro)$/i.test(ctx.file)) return
                  await _downloadAllFavicons()
                },
              },
            },
          ],
        },
      })
      await _downloadAllFavicons()
    },
    "astro:build:done": async ({dir}) => {
      const {cacheDir} = faviconConfig
      if (!cacheDir) {
        throw new Error("cacheDir uninitialized")
      }
      await copyFavicons(cacheDir, path.join(fileURLToPath(dir), FAVICON_DIR))
    },
    "astro:server:setup": async ({server}) => {
      const {cacheDir} = faviconConfig
      if (!cacheDir) {
        throw new Error("cacheDir uninitialized")
      }
      server.middlewares.use(`/${FAVICON_DIR}`, sirv(cacheDir, {dev: true}))
    },
  },
}

export default integration
