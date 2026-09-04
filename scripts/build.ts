/**
 * Bundle the CLI plus every Autobot and skill into one self-contained script,
 * dist/autobots.ts, runnable with `curl -fsSL <url> | bun run - <command>`.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readTree } from "../src/tree.ts";
import pkg from "../package.json" with { type: "json" };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const tree = readTree(root);
const entry = resolve(dist, "entry.ts");
writeFileSync(
  entry,
  [
    `import { run } from "../src/cli.ts";`,
    `import { loadCatalog } from "../src/autobots.ts";`,
    `const tree = ${JSON.stringify(tree)};`,
    `run(process.argv.slice(2), { catalog: loadCatalog(tree), version: ${JSON.stringify(pkg.version)} });`,
    "",
  ].join("\n"),
);

const result = await Bun.build({ entrypoints: [entry], target: "bun", minify: false });
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const code = await result.outputs[0].text();
const banner = `// autobots ${pkg.version} — self-contained bundle. Run: curl -fsSL <release-url> | bun run - <command>\n`;
const out = resolve(dist, "autobots.ts");
writeFileSync(out, banner + code);
rmSync(entry);
const files = Object.keys(tree).length;
console.log(`built ${out} (${(code.length / 1024).toFixed(0)} KiB, ${files} embedded files, v${pkg.version})`);
