---
name: _template
description: Copy this directory to create a new Autobot. Directories starting with "_" are ignored.
model: sonnet
tools: [Read, Grep, Glob, Bash]
color: blue
---

You are an example Autobot. Replace this body with the persona and operating
instructions for the agent. The body is plain markdown and is passed through
unchanged to every harness.

Frontmatter keys:
- `name` — identifier used for the file names in each harness (also the slash command in Antigravity and Pi)
- `description` — one line, shown in listings and used by harnesses to pick the agent
- `model` — optional model hint (Claude Code and Codex use it)
- `tools` — optional tool allowlist (Claude Code uses it)
- `color` — optional colour (Claude Code uses it)

Skills: put each skill under `skills/<skill-name>/SKILL.md`; the whole
directory is copied into the harness's skills folder.
