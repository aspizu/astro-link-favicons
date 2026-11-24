import {unified} from "@astrojs/markdown-remark"
import * as astroLinkFavicons from "astro-link-favicons"
import {defineConfig} from "astro/config"

export default defineConfig({
  site: "https://example.com",
  integrations: [astroLinkFavicons.integration],
  markdown: {
    processor: unified({rehypePlugins: [astroLinkFavicons.rehypePlugin]}),
  },
})
