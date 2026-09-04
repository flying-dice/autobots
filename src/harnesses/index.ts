import { claude } from "./claude.ts";
import { codex } from "./codex.ts";
import type { Harness, HarnessId } from "../types.ts";

export const HARNESSES: Record<HarnessId, Harness> = { claude, codex };
export const HARNESS_IDS = Object.keys(HARNESSES) as HarnessId[];

const ALIASES: Record<string, HarnessId> = {
  "claude-code": "claude",
  claudecode: "claude",
  cc: "claude",
  openai: "codex",
};

export function resolveHarnesses(spec: string | undefined): Harness[] {
  if (!spec || spec === "all") return HARNESS_IDS.map((id) => HARNESSES[id]);
  return spec.split(",").map((raw) => {
    const key = raw.trim().toLowerCase();
    const id = (ALIASES[key] ?? key) as HarnessId;
    if (!HARNESSES[id]) throw new Error(`Unknown harness "${raw}". Known: ${HARNESS_IDS.join(", ")}`);
    return HARNESSES[id];
  });
}
