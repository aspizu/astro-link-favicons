import * as crypto from "node:crypto"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import {fileURLToPath} from "node:url"

import type {AstroIntegration} from "astro"
import * as cheerio from "cheerio"
import type * as hast from "hast"
import sirv from "sirv"
import type * as unified from "unified"
import {visit} from "unist-util-visit"

const EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
])
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000
const FAILURE_MARKER = ".failed"
const FAVICON_DIR = "_astro/_favicons"
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

let srcDir: string | null = null
let cacheDir: string | null = null
let faviconPath: string | null = null
let siteHostname: string | undefined

async function _wget(url: string) {
  try {
    const res = await fetch(url, {
      headers: {"User-Agent": UA},
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      throw new Error(`failed to fetch ${url}:\n${res.status} ${res.statusText}`)
    }
    return res
  } catch {
    throw new Error(`failed to fetch ${url}`)
  }
}

function _getExternalHostname(href: string): string | null {
  if (!/^https?:\/\//i.test(href)) {
    return null
  }
  try {
    const {hostname} = new URL(href)
    if (hostname === "." || hostname === ".." || hostname === siteHostname) {
      return null
    }
    return hostname
  } catch {
    return null
  }
}

async function _getDomains(file: string, out: Set<string>) {
  const text = await fs.readFile(file, {encoding: "utf8"})
  for (const link of text.match(/https?:\/\/[^\s<>"'()]+/gi) ?? []) {
    const hostname = _getExternalHostname(link)
    if (hostname) {
      out.add(hostname)
    }
  }
}

async function _getAllDomains(dir: string) {
  const paths = await Array.fromAsync(
    fs.glob(path.join(dir, "**/*.{html,md,mdx,astro,HTML,MD,MDX,ASTRO}")),
  )
  const domains: Set<string> = new Set()
  await Promise.all(paths.map((file) => _getDomains(file, domains)))
  return domains
}

async function _getFaviconURL(domain: string) {
  const res = await _wget(`https://${domain}/`)
  const $ = cheerio.load(await res.text())
  const href = $('head > link[rel~="icon" i][href]').attr("href")
  const url = href && URL.parse(href, res.url)
  return url && (url.protocol === "https:" || url.protocol === "http:") ? url : null
}

async function _getCachedFavicon(domain: string) {
  if (!cacheDir) {
    throw new Error("cacheDir uninitialized")
  }
  const dir = path.join(cacheDir, domain)
  const entries = await fs.readdir(dir, {withFileTypes: true}).catch((e) => {
    if (e.code === "ENOENT") {
      return []
    }
    throw e
  })
  const icon = entries.find((e) => e.isFile() && EXTENSIONS.has(path.extname(e.name)))
  if (!icon) {
    return null
  }
  return path.join(dir, icon.name)
}

async function _fetchFavicon(domain: string) {
  const faviconURL = await _getFaviconURL(domain)
  if (!faviconURL) {
    return null
  }
  const extension = path.posix.extname(faviconURL.pathname).toLowerCase()
  if (!EXTENSIONS.has(extension)) {
    return null
  }
  const res = await _wget(faviconURL.href)
  const bytes = Buffer.from(await res.arrayBuffer())
  if (extension === ".svg") {
    const image = `data:image/svg+xml;base64,${bytes.toString("base64")}`
    return {
      bytes: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image width="32" height="32" href="${image}"/></svg>`,
      ),
      extension,
    }
  }
  return {bytes, extension}
}

async function _isFresh(file: string) {
  const stat = await fs.stat(file).catch((e) => {
    if (e.code === "ENOENT") {
      return null
    }
    throw e
  })
  if (!stat?.size) {
    return null
  }
  return Date.now() - stat.mtimeMs <= CACHE_MAX_AGE
}

async function _downloadFavicon(domain: string) {
  if (!cacheDir) {
    throw new Error("cacheDir uninitialized")
  }
  const outdir = path.join(cacheDir, domain)
  const marker = path.join(outdir, FAILURE_MARKER)
  const previous = await _getCachedFavicon(domain)
  if ((previous && (await _isFresh(previous))) || (await _isFresh(marker))) {
    return previous
  }
  const favicon = await _fetchFavicon(domain).catch((e) => {
    console.error(e)
    return null
  })
  await fs.mkdir(outdir, {recursive: true})
  if (!favicon) {
    await fs.writeFile(marker, "failed\n")
    return previous
  }
  const {bytes, extension} = favicon
  const hash = crypto.createHash("sha256").update(bytes).digest("base64url").slice(0, 8)
  const file = path.join(outdir, `${hash}${extension}`)
  await fs.writeFile(file, bytes)
  if (previous && previous !== file) {
    await fs.rm(previous, {force: true})
  }
  await fs.rm(marker, {force: true})
  return file
}

async function _downloadAllFaviconsInner() {
  if (!srcDir) {
    throw new Error("srcDir uninitialized")
  }
  const domains = [...(await _getAllDomains(srcDir))]
  await Promise.all(
    domains.map((domain) =>
      _downloadFavicon(domain).catch((e) => {
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

async function _copyToBuildDir(dir: URL) {
  if (!cacheDir) {
    throw new Error("cacheDir uninitialized")
  }
  const out = path.join(fileURLToPath(dir), FAVICON_DIR)
  await fs.mkdir(path.dirname(out), {recursive: true})
  await fs.cp(cacheDir, out, {
    recursive: true,
    filter: (file) => path.basename(file) !== FAILURE_MARKER,
  })
}

const rehypePlugin: unified.Plugin<[], hast.Root> = () => {
  return async (tree) => {
    const nodes: hast.Element[] = []
    const filePromises: Promise<string | null>[] = []
    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return
      const href = node.properties.href
      if (!href) return
      const hostname = _getExternalHostname(href)
      if (!hostname) return
      nodes.push(node)
      filePromises.push(_getCachedFavicon(hostname))
    })
    const files = await Promise.all(filePromises)
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const file = files[i]
      if (!file || !cacheDir) continue
      const relativeURL = path
        .relative(cacheDir, file)
        .split(path.sep)
        .map(encodeURIComponent)
        .join("/")
      const style = node.properties.style
      node.properties.style = `${style ? `${style}; ` : ""}--favicon: url("${faviconPath}/${relativeURL}")`
    }
  }
}

const integration: AstroIntegration = {
  name: "astro-link-favicons",
  hooks: {
    "astro:config:setup": async ({config, command, updateConfig}) => {
      siteHostname = config.site ? new URL(config.site).hostname : undefined
      faviconPath = path.posix.join("/", config.base, FAVICON_DIR)
      cacheDir = path.join(fileURLToPath(config.cacheDir), "astro-link-favicons")
      await fs.mkdir(cacheDir, {recursive: true})
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
      await _copyToBuildDir(dir)
    },
    "astro:server:setup": async ({server}) => {
      if (!cacheDir) {
        throw new Error("cacheDir uninitialized")
      }
      server.middlewares.use(`/${FAVICON_DIR}`, sirv(cacheDir, {dev: true}))
    },
  },
}

export {integration, rehypePlugin}
