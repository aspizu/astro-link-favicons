import {build} from "esbuild"

await build({
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  bundle: true,
  sourcemap: true,
  sourcesContent: false,
  format: "esm",
  platform: "node",
  packages: "external",
  target: "esnext",
})
