# Autobots

Home of the **Autobots** agent team, plus a small CLI that installs them into the
coding harnesses with genuine subagents: **Claude Code** and **Codex**.

Each Autobot is defined once, in `autobots/<name>/AUTOBOT.md`, and the CLI adapts
it to whatever each harness expects.

## The team

Optimus Prime runs the session and is the only agent that dispatches work. Everyone
else is a subagent he briefs. Full team notes are in [`autobots/README.md`](autobots/README.md).

| | Autobot | Model / effort | Role |
| :---: | --- | --- | --- |
| <img src="assets/avatars/optimus-prime.jpg" width="60" alt="Optimus Prime" /> | **optimus-prime** | fable / low | Tech lead: roadmap, sprints, decisions, all dispatch |
| <img src="assets/avatars/bumblebee.jpg" width="60" alt="Bumblebee" /> | **bumblebee**, bumblebee-lite | sonnet / medium, low | Developer |
| <img src="assets/avatars/ironhide.jpg" width="60" alt="Ironhide" /> | **ironhide**, ironhide-deep | opus / medium, high | Senior developer |
| <img src="assets/avatars/ratchet.jpg" width="60" alt="Ratchet" /> | **ratchet**, ratchet-deep | opus / medium, high | Tester |
| <img src="assets/avatars/arcee.jpg" width="60" alt="Arcee" /> | **arcee** | opus / medium | Designer |
| <img src="assets/avatars/prowl.jpg" width="60" alt="Prowl" /> | **prowl**, prowl-deep | fable / low, high | Architect (read-only) |
| <img src="assets/avatars/jazz.jpg" width="60" alt="Jazz" /> | **jazz**, jazz-deep | fable / low, high | Lead designer (design docs only) |

In Claude Code, start a session with `claude --agent optimus-prime`, or copy
`examples/claude-settings.example.json` to `.claude/settings.json` to make him the
project default.

## Shared skills

Team-wide skills live in `skills/<name>/SKILL.md` and are installed into every
harness's skills directory by `install --all` (or `install --skills`).

| Skill | Purpose |
| --- | --- |
| pre-commit | Mandatory gate before every push: review, clean-code-review, clear markers, verify, repeat |
| clean-code-review | Scored audit for SRP, DRY, naming, coupling, dead code, KISS, boundaries, panic safety; tags `// TODO: clean-code` markers |
| refactor | Clear the single highest-scored clean-code marker per pass |
| ddd-hexagonal | Layered hexagonal layout: domain owns model and ports, infra adapts, roots compose, failures as values |
| repodoc-workflow | Work a RepoDoc file-based kanban: cards, journal, gates, decisions, docs |

## Run it

Straight from GitHub with Bun, no clone:

```sh
bunx github:flying-dice/autobots install --all --harness claude --scope user
bunx github:flying-dice/autobots status --harness all --scope user
```

Nothing is assumed: `install`, `uninstall` and `status` all require
`--harness` (`claude`, `codex`, or `all`) and `--scope` (`user` for your home
directory config, `project` for the current directory).

Always include the `github:` prefix. `bunx autobots` on its own resolves to an
unrelated package on npm. Bun caches what it fetched, so to force the newest
commit pin a ref: `bunx github:flying-dice/autobots#main`.

Each GitHub release also ships one self-contained script, `autobots.ts`, with
the CLI and every Autobot and skill embedded. This route needs nothing but
`curl` and `bun`, and pins to a release rather than a branch. Arguments go
after the dash:

```sh
curl -fsSL https://github.com/flying-dice/autobots/releases/latest/download/autobots.ts | bun run - install --all --harness codex --scope project
```

Pin a version by replacing `latest/download` with `download/v0.1.0`.

Other options:

```sh
bun add -g github:flying-dice/autobots   # installs an `autobots` command from git
bun src/bin.ts list                       # from a checkout
```

## Commands

| Command | What it does |
| --- | --- |
| `list` | Show the Autobots in this repo |
| `skills` | Show the shared skills in this repo |
| `show <bot>` | Print one Autobot's definition |
| `harnesses` | Show supported harnesses and the paths they use |
| `doctor` | Detect which harnesses are installed on this machine |
| `install <bot...>` / `install --all` | Install into the given harness and scope. `--all` includes the shared skills and prunes anything this version no longer ships |
| `uninstall <bot...>` / `uninstall --all` | Remove the files the CLI wrote, per the manifest |
| `status` | Table of which Autobots are installed in which harness |

Options:

- `-H, --harness claude,codex|all` (required) target harnesses (aliases: `cc`, `openai`)
- `-S, --scope user|project` (required) home directory config or the current directory
- `-n, --dry-run` print what would change without touching disk
- `-s, --skills` include the shared skills (implied by `--all`)

## Upgrades and the manifest

Every install writes `autobots-manifest.json` at the harness's scope root
(`~/.claude/`, `~/.codex/`, or the project's `.claude/` and `.codex/`). It
records the CLI version and, per bot and skill, the exact paths written. That
record is what makes upgrades safe:

- Reinstalling a bot removes any path it owned before but no longer produces,
  such as a renamed skill directory.
- `install --all` also removes every bot or skill in the manifest that the new
  version no longer ships, so retiring an Autobot upstream retires it on your
  machine on the next run.
- Installing bots by name never prunes the others.
- `uninstall` removes what the manifest recorded, plus whatever the current plan
  would write, so it works even if the layout changed between versions.
- `status` shows which CLI version last wrote each harness. `--dry-run` reports
  prunes without touching the manifest.

## How each harness is adapted

| Harness | Autobot becomes | Skills go to |
| --- | --- | --- |
| Claude Code | subagent `~/.claude/agents/autobots/<name>.md`, frontmatter copied verbatim | `~/.claude/skills/<skill>/` |
| Codex | custom agent `~/.codex/agents/<name>.toml` (name, description, model, model_reasoning_effort, sandbox_mode, developer_instructions); the dispatcher also becomes a skill | `~/.agents/skills/<skill>/` |

**Prompts are adapted per harness by default.** Claude Code gets `AUTOBOT.md`
verbatim. Codex gets the same persona with Claude-specific references rewritten
(the launch command, `AskUserQuestion`, `TodoWrite`, agent memory) and an
appended "Operating in Codex" section: Optimus dispatches by asking Codex to
spawn teammates by name, and every agent is told which Codex model each tier
resolves to and which one it is running on.

To hand-write a harness-specific version instead, add
`autobots/<name>/AUTOBOT.<harness>.md` (for example `AUTOBOT.codex.md`). Its
body replaces the generated prompt for that harness and its `description`
overrides the bot's.

With `--scope project` the same layout is written under `./.claude` and `./.codex` + `./.agents`.

### Using the team in Codex

1. `autobots install --all --harness codex --scope user` (or the curl one-liner). Every bot
   becomes `~/.codex/agents/<name>.toml`; Optimus is also written as the skill
   `~/.agents/skills/optimus-prime/SKILL.md`.
2. Copy `examples/codex-config.example.toml` into `~/.codex/config.toml`. It
   caps agent nesting at one level and sets subagent defaults.
3. Start `codex` and open with `$optimus-prime` plus your ask. The primary session
   adopts Optimus, who dispatches by asking Codex to spawn teammates by name
   ("Spawn the bumblebee agent with this brief"). Spawned agents cannot spawn
   agents, which matches the team's chain of command.

Project-scoped installs (`--scope project`) write to `./.codex/agents` and
`./.agents/skills`; Codex only loads those in a trusted project.

**Codex models.** Claude tiers in `AUTOBOT.md` are mapped to concrete Codex
models in `src/harnesses/codex.ts` (`CODEX_MODELS`): fable and opus prescribe
`gpt-5.6-sol`, sonnet and haiku prescribe `gpt-5.6-terra`. Effort passes through
as `model_reasoning_effort` (Codex accepts minimal, low, medium, high, xhigh).
Bots whose Claude tool list has no Write or Edit get `sandbox_mode = "read-only"`;
the rest get `workspace-write`. Any other `model` value is written as a Codex
model id unchanged.

Adapters live in `src/harnesses/`; each is a small object with `plan()` and
`ownedPaths()`. Add a new harness by adding a file there and registering it in
`src/harnesses/index.ts`.

## Defining an Autobot

```
autobots/
  optimus/
    AUTOBOT.md            # frontmatter + persona body
    skills/
      roll-out/
        SKILL.md          # standard Agent Skills format, copied verbatim
```

`AUTOBOT.md` uses Claude Code's subagent frontmatter, which is the richest of the
four formats; other harnesses take the subset they understand.

```md
---
name: optimus
description: Leads the team and breaks big tasks into missions.
model: opus                            # claude; mapped to a Codex model for codex
effort: medium                         # claude, codex
tools: Agent(bumblebee), Read, Bash    # claude
disallowedTools: Agent, SendMessage    # claude
color: red                             # claude
memory: project                        # claude
---

You are Optimus. ...
```

Copy `autobots/_template` to start a new one. Directories beginning with `_` are ignored.

## Development and releasing

```sh
bun test               # includes building the bundle and running it over stdin
bun run typecheck
bun run build          # writes dist/autobots.ts
bun run smoke:tarball  # installs HEAD the way bunx github: does and runs the bin
bun run release patch  # or minor, major, or an explicit x.y.z
```

`bun run release` checks the tree is clean, runs the tests and build, bumps
`package.json`, commits, tags `vX.Y.Z` and pushes. The Release workflow then
builds the bundle on the tag and attaches `autobots.ts` to the GitHub release,
which is what the `latest/download` URL serves. The same workflow can be run
by hand from the Actions tab with a tag name, which creates the tag at the
chosen ref if it does not exist yet. CI runs typecheck, tests, build
and a stdin smoke test on every push to main and every pull request.
