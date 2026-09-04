#!/usr/bin/env bun
/** Entry point for a checkout or a `bun add github:` install: reads autobots/ and skills/ from disk. */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./cli.ts";
import { loadCatalog } from "./autobots.ts";
import { readTree } from "./tree.ts";
import pkg from "../package.json" with { type: "json" };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
run(process.argv.slice(2), { catalog: loadCatalog(readTree(root)), version: pkg.version });
