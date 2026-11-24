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
  integrations: [favicons.integration()],
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

If an SVG favicon uses `prefers-color-scheme`, add `color-scheme: dark;` to
the `::before` rule to display its dark theme, or `color-scheme: light;` for
its light theme. SVGs with fixed colors keep their original appearance.
Some Safari versions follow the system theme even with this override.
See [WebKit issue 316640](https://bugs.webkit.org/show_bug.cgi?id=316640).

Write links as usual in Markdown.

```md
Read the [Python beginner's guide](https://www.python.org/about/gettingstarted/).
```

See the [example site](./example) for a working configuration and Markdown page.

## Override a favicon

Choose a favicon for a specific site. Give each subdomain its own entry.

```ts
integrations: [
  favicons.integration({
    overrides: {
      "github.com": "https://github.githubassets.com/favicons/favicon-dark.svg",
    },
  }),
]
```

## Look up a favicon

Pass a link to `getFaviconUrl` in Astro frontmatter as a string or `URL`.
Use the result as an image source. Local links and links without an available
favicon return `null`.

```astro
---
import {getFaviconUrl} from "astro-link-favicons"

const href = "https://www.python.org/"
const icon = await getFaviconUrl(href)
---

<a href={href}>{icon && <img src={icon} width="16" height="16" alt="" />} Python</a>
```

## Refresh or remove cached favicons

To refresh one site's icon or retry a failed download, remove that site's cache
folder, then restart the dev server or rebuild. The following commands assume
Astro's default cache location and run from your project root.

```sh
rm -rf node_modules/.astro/astro-link-favicons/www.python.org
```

To refresh all icons and discard unused ones, stop the dev server, clear the
favicon cache, and run a clean build.

```sh
rm -rf node_modules/.astro/astro-link-favicons
pnpm exec astro build
```
