/**
 * Reproduce what `bunx github:flying-dice/autobots` does, offline: archive HEAD
 * the way GitHub serves a repo tarball, install it as a dependency in a scratch
 * project, and run the package bin. Fails if the bin no longer runs from a
 * clean checkout with no build step.
 */
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "autobots-tarball-"));
const tgz = join(work, "autobots.tgz");

function sh(cmd: string[], cwd: string): string {
  const p = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) {
    console.error(`$ ${cmd.join(" ")}\n${p.stdout}${p.stderr}`);
    process.exit(p.exitCode);
  }
  return p.stdout.toString();
}

sh(["git", "archive", "--format=tgz", "--prefix=autobots/", "-o", tgz, "HEAD"], root);
const proj = join(work, "proj");
Bun.spawnSync(["mkdir", "-p", proj]);
writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "smoke", private: true }));
sh(["bun", "add", tgz], proj);

const bin = join(proj, "node_modules", ".bin", "autobots");
const version = sh([bin, "--version"], proj).trim();
sh([bin, "install", "--all", "--scope", "project", "--harness", "claude"], proj);
const agents = readdirSync(join(proj, ".claude", "agents", "autobots")).length;
if (!existsSync(join(proj, ".claude", "skills", "pre-commit", "SKILL.md")) || agents < 12) {
  console.error("bin ran but did not install the team");
  process.exit(1);
}
console.log(`ok: ${version} installed ${agents} agents from a HEAD tarball via the package bin`);
