import * as path from "node:path"

import type * as hast from "hast"
import type * as unified from "unified"
import {visit} from "unist-util-visit"

import {getCachedFavicon} from "./cache"
import {faviconConfig} from "./config"
import {getExternalHostname} from "./domains"

const rehypePlugin: unified.Plugin<[], hast.Root> = () => {
  return async (tree) => {
    const {cacheDir, faviconPath, siteHostname} = faviconConfig
    const nodes: hast.Element[] = []
    const filePromises: Promise<string | null>[] = []
    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return
      const href = node.properties.href
      if (!href) return
      const hostname = getExternalHostname(href, siteHostname)
      if (!hostname) return
      nodes.push(node)
      filePromises.push(getCachedFavicon(cacheDir, hostname))
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

export default rehypePlugin
