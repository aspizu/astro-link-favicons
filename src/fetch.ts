import * as path from "node:path"

import * as cheerio from "cheerio"

export const EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  ".svg": ["image/svg+xml", "image/svg"],
  ".avif": ["image/avif"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".jpeg": ["image/jpeg"],
  ".jpg": ["image/jpeg", "image/jpg"],
  ".webp": ["image/webp"],
  ".ico": ["image/vnd.microsoft.icon", "image/x-icon", "image/ico"],
}
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

async function _wget(url: string) {
  const res = await fetch(url, {
    headers: {"User-Agent": UA},
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) {
    throw new Error(`failed to fetch ${url}:\n${res.status} ${res.statusText}`)
  }
  return res
}

interface IconLink {
  url: URL
  contentType: string | null
  sizes: string[]
}

function _iconExtension({url, contentType}: IconLink) {
  const mime = contentType?.split(";")[0].trim().toLowerCase()
  const extension = path.posix.extname(url.pathname).toLowerCase()
  if (!mime || EXTENSIONS[extension]?.includes(mime)) {
    return extension
  }
  for (const [candidate, mimeTypes] of Object.entries(EXTENSIONS)) {
    if (mimeTypes.includes(mime)) {
      return candidate
    }
  }
  return extension
}

const SIZE_LIMIT = 64

function _largestIconArea(sizes: string[]) {
  let largest = 0
  let hasDimensions = false
  for (const size of sizes) {
    if (size.toLowerCase() === "any") {
      return SIZE_LIMIT ** 2
    }
    const dimensions = /^([1-9]\d*)x([1-9]\d*)$/i.exec(size)
    if (!dimensions) continue
    hasDimensions = true
    const width = Number(dimensions[1])
    const height = Number(dimensions[2])
    if (width <= SIZE_LIMIT && height <= SIZE_LIMIT) {
      largest = Math.max(largest, width * height)
    }
  }
  return hasDimensions && !largest ? null : largest
}

interface IconCandidate {
  link: IconLink
  extension: string
}

function _largestIcon(candidates: IconCandidate[]) {
  let selected: IconCandidate | null = null
  let largestArea = -1
  for (const candidate of candidates) {
    const area = _largestIconArea(candidate.link.sizes)
    if (area !== null && area > largestArea) {
      selected = candidate
      largestArea = area
    }
  }
  return selected
}

function _selectIcon(links: IconLink[]) {
  const svg = links.find((link) => _iconExtension(link) === ".svg")
  if (svg) {
    return {link: svg, extension: ".svg"}
  }
  const byExtension = Object.groupBy(links, _iconExtension)
  const bitmaps: IconCandidate[] = []
  for (const extension of Object.keys(EXTENSIONS)) {
    if (extension === ".ico") continue
    for (const link of byExtension[extension] ?? []) {
      bitmaps.push({link, extension})
    }
  }
  const bitmap = _largestIcon(bitmaps)
  if (bitmap) {
    return bitmap
  }
  const icons = byExtension[".ico"] ?? []
  return _largestIcon(icons.map((link) => ({link, extension: ".ico"})))
}

async function _downloadIcon(url: URL, extension: string) {
  const res = await _wget(url.href)
  const contentType = res.headers.get("content-type")
  if (/^(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType ?? "")) {
    await res.body?.cancel()
    return null
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (!bytes.length) {
    return null
  }
  return {bytes, extension}
}

function _getIconLinks(html: string, base: string) {
  const $ = cheerio.load(html)
  const links = $('link[rel~="icon" i][href]')
    .get()
    .map((link) => link.attribs)
    .filter(({href}) => href.trim())
  if (!links.length) {
    links.push({href: "/favicon.ico"})
  }
  const icons = new Map<string, IconLink>()
  for (const {href, type, sizes} of links) {
    const url = URL.parse(href, base)
    if (!url || !["http:", "https:"].includes(url.protocol)) continue

    let icon = icons.get(url.href)
    if (!icon) {
      icon = {url, contentType: null, sizes: []}
      icons.set(url.href, icon)
    }
    icon.contentType ??= type?.trim() || null
    for (const size of sizes?.match(/\S+/g) ?? []) {
      if (!icon.sizes.includes(size)) {
        icon.sizes.push(size)
      }
    }
  }
  return Array.from(icons.values())
}

export async function fetchFavicon(domain: string) {
  const res = await _wget(`https://${domain}/`)
  const links = _getIconLinks(await res.text(), res.url)
  const selected = _selectIcon(links)
  if (!selected) {
    return null
  }
  return _downloadIcon(selected.link.url, selected.extension).catch((error) => {
    console.error(error)
    return null
  })
}
