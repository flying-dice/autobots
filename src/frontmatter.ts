/** Minimal YAML-ish frontmatter parser: supports scalars and simple inline/block string lists. */
export interface Parsed {
  data: Record<string, unknown>;
  body: string;
  /** The raw text between the --- fences, unchanged. Empty when there was no frontmatter. */
  raw: string;
}

export function parseFrontmatter(text: string): Parsed {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text, raw: "" };
  const data: Record<string, unknown> = {};
  const lines = m[1].split(/\r?\n/);
  let currentKey: string | null = null;
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const listItem = raw.match(/^\s+-\s*(.*)$/);
    if (listItem && currentKey) {
      (data[currentKey] as string[]).push(unquote(listItem[1]));
      continue;
    }
    const kv = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    currentKey = null;
    if (value === "") {
      data[key] = [];
      currentKey = key;
    } else if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = splitTopLevel(value.slice(1, -1)).map(unquote).filter(Boolean);
    } else {
      data[key] = unquote(value);
    }
  }
  return { data, body: m[2].replace(/^\r?\n/, ""), raw: m[1] };
}

/** Split on commas that are not inside parentheses, e.g. "Agent(a, b), Read" -> ["Agent(a, b)", "Read"]. */
export function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function unquote(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

export function stringifyFrontmatter(data: Record<string, unknown>, body: string): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      lines.push(`${k}: [${v.map((x) => String(x)).join(", ")}]`);
    } else {
      const s = String(v);
      lines.push(/[:#]/.test(s) ? `${k}: "${s.replace(/"/g, '\\"')}"` : `${k}: ${s}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n") + body.replace(/\s*$/, "") + "\n";
}
