import {unified} from "@astrojs/markdown-remark"
import * as favicons from "astro-link-favicons"
import {defineConfig} from "astro/config"

export default defineConfig({
  site: "https://example.com",
  integrations: [favicons.integration()],
  markdown: {
    processor: unified({rehypePlugins: [favicons.rehypePlugin]}),
  },
})
