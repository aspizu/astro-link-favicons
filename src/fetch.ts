import * as path from "node:path"

import * as cheerio from "cheerio"

export const EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
])
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

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

async function _getFaviconURL(domain: string) {
  const res = await _wget(`https://${domain}/`)
  const $ = cheerio.load(await res.text())
  const href = $('head > link[rel~="icon" i][href]').attr("href")
  const url = href && URL.parse(href, res.url)
  return url && (url.protocol === "https:" || url.protocol === "http:") ? url : null
}

export async function fetchFavicon(domain: string) {
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
