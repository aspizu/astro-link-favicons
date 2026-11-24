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
    return hostname === siteHostname ? null : hostname
  } catch {
    return null
  }
}

async function _getDomains(file: string, out: Set<string>) {
  const text = await fs.readFile(file, {encoding: "utf8"})
  for (const link of text.match(/https?:\/\/[^\s<>"']+/gi) ?? []) {
    const hostname = _getExternalHostname(link)
    if (hostname) {
      out.add(hostname)
    }
  }
}

async function _getAllDomains(dir: string) {
  const paths = await Array.fromAsync(
    fs.glob(path.join(dir, "**/*.{html,md,mdx,astro}")),
  )
  const domains: Set<string> = new Set()
  await Promise.all(paths.map((file) => _getDomains(file, domains)))
  return domains
}

async function _getFaviconURL(domain: string) {
  const res = await _wget(`https://${domain}/`)
  const $ = cheerio.load(await res.text())
  const href = $('head > link[rel="icon"]').attr("href")
  if (!href) {
    return null
  }
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href
  }
  if (href.startsWith("/")) {
    return `https://${domain}${href}`
  }
  return `https://${domain}/${href}`
}

async function _getCachedFavicon(domain: string) {
  if (!cacheDir) {
    throw new Error("cacheDir uninitialized")
  }
  const paths = await Array.fromAsync(fs.glob(path.join(cacheDir, domain, "*")))
  return paths.at(0) ?? null
}

async function _downloadFavicon(domain: string) {
  if (!cacheDir) {
    throw new Error("cacheDir uninitialized")
  }
  const faviconURL = await _getFaviconURL(domain)
  if (!faviconURL) {
    return false
  }
  const outdir = path.join(cacheDir, domain)
  if (
    await fs
      .stat(outdir)
      .then((s) => s.isDirectory())
      .catch(() => false)
  ) {
    return true
  }
  const res = await _wget(faviconURL)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const hash = crypto.createHash("sha256").update(bytes).digest("base64url").slice(0, 8)
  await fs.mkdir(outdir, {recursive: true}).catch(() => {})
  const extension = path.posix.extname(new URL(faviconURL).pathname)
  await fs.writeFile(path.join(outdir, `${hash}${extension}`), bytes)
  return true
}

async function _downloadAllFavicons() {
  if (!srcDir) {
    throw new Error("srcDir uninitialized")
  }
  const domains = [...(await _getAllDomains(srcDir))]
  await Promise.all(
    domains.map(async (domain) => {
      try {
        await _downloadFavicon(domain)
        const favicon = await _getCachedFavicon(domain)
        if (!favicon) return
        console.log(favicon)
      } catch (e) {
        console.error(e instanceof Error ? (e.stack ?? e.message) : String(e))
      }
    }),
  )
}

async function _copyToBuildDir(dir: URL) {
  if (!cacheDir) {
    throw new Error("cacheDir uninitialized")
  }
  const out = path.join(fileURLToPath(dir), "_astro", "_favicons")
  await fs.mkdir(path.dirname(out), {recursive: true}).catch(() => {})
  await fs.cp(cacheDir, out, {recursive: true})
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
    "astro:config:setup": async ({config}) => {
      siteHostname = config.site ? new URL(config.site).hostname : undefined
      faviconPath = path.posix.join("/", config.base, "_astro", "_favicons")
      cacheDir = path.join(fileURLToPath(config.cacheDir), "astro-link-favicons")
      await fs.mkdir(cacheDir, {recursive: true}).catch(() => {})
      srcDir = fileURLToPath(config.srcDir)
    },
    "astro:routes:resolved": async () => {
      await _downloadAllFavicons()
    },
    "astro:build:done": async ({dir}) => {
      await _copyToBuildDir(dir)
    },
    "astro:server:setup": async ({server}) => {
      if (!cacheDir) {
        throw new Error("cacheDir uninitialized")
      }
      if (!faviconPath) {
        throw new Error("faviconPath uninitialized")
      }
      server.middlewares.use(faviconPath, sirv(cacheDir))
    },
  },
}

export {integration, rehypePlugin}
