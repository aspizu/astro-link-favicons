import type {AstroIntegration} from "astro"
import type {Root} from "hast"
import type {Plugin} from "unified"

import {buildDone, configSetup, serverSetup} from "./astro-integration"
import {getFaviconUrl} from "./get-favicon-url"
import {linkFavicons} from "./rehype-plugin"

export {getFaviconUrl}

export const rehypePlugin: Plugin<[], Root> = () => linkFavicons

export const integration: AstroIntegration = {
  name: "astro-link-favicons",
  hooks: {
    "astro:config:setup": configSetup,
    "astro:build:done": buildDone,
    "astro:server:setup": serverSetup,
  },
}

export default {integration, rehypePlugin, getFaviconUrl}
