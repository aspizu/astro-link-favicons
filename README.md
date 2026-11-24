# astro-link-favicons

Display favicons beside external links in Astro Markdown pages.

![Python favicons beside links to the beginner’s guide, pathlib, and Counter](./example/screenshot.png)

## Usage

Install the package and the Markdown processor in your Astro project.

```sh
pnpm add astro-link-favicons @astrojs/markdown-remark
```

Register the astro integration and rehype plugin in `astro.config.ts`. Set `site` to
your site's URL to skip absolute links to your own hostname.

```ts
import {unified} from "@astrojs/markdown-remark"
import favicons from "astro-link-favicons"
import {defineConfig} from "astro/config"

export default defineConfig({
  site: "https://example.com",
  integrations: [favicons.integration],
  markdown: {
    processor: unified({rehypePlugins: [favicons.rehypePlugin]}),
  },
})
```

Add this rule to your global stylesheet to display the icon before the link text.

```css
a[style*="--favicon:"]::before {
  content: "";
  display: inline-block;
  width: 1em;
  height: 1em;
  margin-inline-end: 0.25em;
  background: var(--favicon) center / contain no-repeat;
}
```

Write links as usual in Markdown.

```md
Read the [Python beginner's guide](https://www.python.org/about/gettingstarted/).
```

See the [example site](./example) for a working configuration and Markdown page.

## Look up a favicon

Use `getFaviconUrl` in Astro frontmatter to get a URL under `_astro/_favicons/`
with the site's configured `base` path. It accepts a
string or `URL` and returns `null` for local links or when no favicon is cached.

```astro
---
import {getFaviconUrl} from "astro-link-favicons"

const icon = await getFaviconUrl("https://www.python.org/")
---
{icon && <img src={icon} alt="" />}
```

## Refresh or remove cached favicons

To force a download for one hostname, delete its cache folder from your Astro
project root, then restart the dev server or rebuild. This also clears any cached
download failure for that hostname.

```sh
rm -rf node_modules/.astro/astro-link-favicons/www.python.org
```

Removing a link leaves its favicon in the cache. To discard unused icons and
download fresh copies for the hostnames still present in your source files,
stop the dev server, clear the favicon cache and generated icons, then rebuild.

```sh
rm -rf node_modules/.astro/astro-link-favicons dist/_astro/_favicons
ASTRO_TELEMETRY_DISABLED=1 pnpm exec astro build
```
