import * as crypto from "node:crypto"
import * as fs from "node:fs/promises"
import * as path from "node:path"

import {EXTENSIONS, fetchFavicon} from "./fetch"

const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000
const FAILURE_MARKER = ".failed"
const OVERRIDE_MARKER = ".override"

export async function getCachedFavicon(cacheDir: string | null, domain: string) {
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
  const icon = entries.find(
    (e) => e.isFile() && Object.hasOwn(EXTENSIONS, path.extname(e.name)),
  )
  if (!icon) {
    return null
  }
  return path.join(dir, icon.name)
}

export async function getCachedFaviconFiles(cacheDir: string) {
  const directories = await fs.readdir(cacheDir, {withFileTypes: true})
  const entries = await Promise.all(
    directories
      .filter((entry) => entry.isDirectory())
      .map(async ({name}) => {
        const file = await getCachedFavicon(cacheDir, name)
        return [name, file && path.basename(file)] as const
      }),
  )
  return Object.fromEntries(entries)
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

export async function downloadFavicon(
  cacheDir: string,
  domain: string,
  override?: URL,
) {
  const outdir = path.join(cacheDir, domain)
  const marker = path.join(outdir, FAILURE_MARKER)
  const overrideFile = path.join(outdir, OVERRIDE_MARKER)
  const overrideUrl = override?.href
  const cachedOverrideUrl = await fs.readFile(overrideFile, "utf8").catch((error) => {
    if (error.code !== "ENOENT") {
      throw error
    }
    return null
  })
  let previous = await getCachedFavicon(cacheDir, domain)
  if (overrideUrl !== cachedOverrideUrl) {
    if (previous) {
      await fs.rm(previous, {force: true})
    }
    previous = null
    await fs.rm(marker, {force: true})
    if (overrideUrl) {
      await fs.mkdir(outdir, {recursive: true})
      await fs.writeFile(overrideFile, overrideUrl)
    } else {
      await fs.rm(overrideFile, {force: true})
    }
  }
  if ((previous && (await _isFresh(previous))) || (await _isFresh(marker))) {
    return previous
  }
  const favicon = await fetchFavicon(domain, override).catch((e) => {
    console.error(e)
    return null
  })
  await fs.mkdir(outdir, {recursive: true})
  if (!favicon) {
    if (override && previous) {
      await fs.rm(previous, {force: true})
      previous = null
    }
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

export async function copyFavicons(cacheDir: string, out: string) {
  await fs.mkdir(path.dirname(out), {recursive: true})
  await fs.cp(cacheDir, out, {
    recursive: true,
    filter: (file) => ![FAILURE_MARKER, OVERRIDE_MARKER].includes(path.basename(file)),
  })
}
