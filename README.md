# astro-link-favicons

An Astro integration that caches favicons for external links in Markdown. The package exports `integration` for fetching and serving icons and `rehypePlugin` for adding the `--favicon` CSS property to links with a cached icon.

Set Astro's `site` option to skip links to your own hostname. To display the icons, add this rule to your global stylesheet.

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
