import {build} from "esbuild"

await build({
  entryPoints: ["src/index.ts"],
  outfile: "index.js",
  bundle: true,
  minify: true,
  sourcemap: true,
  sourcesContent: false,
  format: "esm",
  platform: "node",
  packages: "external",
  target: "esnext",
})
