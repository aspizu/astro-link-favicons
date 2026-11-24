import {build} from "esbuild"

await build({
  entryPoints: ["src/astro-integration.ts", "src/rehype-plugin.ts"],
  outdir: "dist",
  splitting: true,
  bundle: true,
  minify: true,
  sourcemap: true,
  sourcesContent: false,
  format: "esm",
  platform: "node",
  packages: "external",
  target: "esnext",
})
