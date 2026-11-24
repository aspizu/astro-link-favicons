import {unified} from "@astrojs/markdown-remark"
import {integration, rehypePlugin} from "astro-link-favicons"
import {defineConfig} from "astro/config"

export default defineConfig({
  devToolbar: {enabled: false},
  integrations: [integration],
  markdown: {
    processor: unified({rehypePlugins: [rehypePlugin]}),
  },
})
