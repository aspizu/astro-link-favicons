import * as fs from "node:fs/promises"
import * as path from "node:path"

import {getExternalHostname} from "./utils"

async function _getDomains(
  file: string,
  out: Set<string>,
  siteHostname: string | undefined,
) {
  if (!(await fs.stat(file)).isFile()) return
  const text = await fs.readFile(file, {encoding: "utf8"}).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "EISDIR") return
    throw error
  })
  if (!text) return
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
