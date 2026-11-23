import * as fs from "node:fs/promises"
import * as path from "node:path"
import {fileURLToPath} from "node:url"

import type {AstroIntegration} from "astro"
import * as cheerio from "cheerio"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

let cacheDir = ""

async function _getDomains(file: string, out: Set<string>) {
  const text = await fs.readFile(file, {encoding: "utf8"})
  for (const link of text.match(/https?:\/\/[^\s<>"']+/gi) ?? []) {
    const url = new URL(link)
    out.add(url.hostname)
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
  const res = await fetch(`https://${domain}/`, {
    headers: {
      "User-Agent": UA,
    },
  })
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

async function _downloadFavicon(domain: string) {
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
  await fs.mkdir(outdir, {recursive: true})
  const res = await fetch(faviconURL, {headers: {"User-Agent": UA}})
  await fs.writeFile(
    path.join(outdir, `favicon${path.extname(faviconURL)}`),
    new Uint8Array(await res.arrayBuffer()),
  )
  return true
}

export default {
  name: "astro-link-favicons",
  hooks: {
    "astro:config:done": async ({config}) => {
      cacheDir = path.join(fileURLToPath(config.cacheDir), "astro-link-favicons")
      await fs.mkdir(cacheDir, {recursive: true})
    },
    "astro:routes:resolved": async () => {
      const urls = [...(await _getAllDomains("src"))]
      await Promise.all(urls.map(_downloadFavicon))
    },
  },
} satisfies AstroIntegration
