import * as fs from "node:fs/promises"
import * as path from "node:path"

export function getExternalHostname(
  href: string,
  siteHostname: string | undefined,
): string | null {
  const hasHttpPrefix = /^https?:\/\//i.test(href)
  if (!hasHttpPrefix) {
    return null
  }
  try {
    const hostname = new URL(href).hostname
    if (hostname === "." || hostname === ".." || hostname === siteHostname) {
      return null
    }
    return hostname
  } catch {
    return null
  }
}

async function _getDomains(
  file: string,
  out: Set<string>,
  siteHostname: string | undefined,
) {
  const text = await fs.readFile(file, {encoding: "utf8"})
  for (const link of text.match(/https?:\/\/[^\s<>"'()]+/gi) ?? []) {
    const hostname = getExternalHostname(link, siteHostname)
    if (hostname) {
      out.add(hostname)
    }
  }
}

export async function getAllDomains(dir: string, siteHostname: string | undefined) {
  const paths = await Array.fromAsync(
    fs.glob(path.join(dir, "**/*.{html,md,mdx,astro,HTML,MD,MDX,ASTRO}")),
  )
  const domains: Set<string> = new Set()
  await Promise.all(paths.map((file) => _getDomains(file, domains, siteHostname)))
  return domains
}
