import type {Root} from "hast"
import {visit} from "unist-util-visit"

import {requireFaviconConfig} from "./config"
import {lookupFavicon} from "./get-favicon-url"

export async function linkFavicons(tree: Root) {
  const updates: Promise<void>[] = []
  visit(tree, "element", (node) => {
    if (node.tagName !== "a") return
    const href = node.properties.href
    if (!href) return
    updates.push(
      lookupFavicon(href, requireFaviconConfig()).then((url) => {
        if (!url) return
        const style = node.properties.style
        node.properties.style = `${style ? `${style}; ` : ""}--favicon: url("${url}")`
      }),
    )
  })
  await Promise.all(updates)
}

export {rehypePlugin as default} from "./index"
