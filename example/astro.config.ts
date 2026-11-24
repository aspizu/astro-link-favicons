import {unified} from "@astrojs/markdown-remark"
import astroLinkFavicons from "astro-link-favicons/astro-integration"
import rehypeLinkFavicons from "astro-link-favicons/rehype-plugin"
import {defineConfig} from "astro/config"

export default defineConfig({
  site: "https://example.com",
  integrations: [astroLinkFavicons],
  markdown: {
    processor: unified({rehypePlugins: [rehypeLinkFavicons]}),
  },
})
