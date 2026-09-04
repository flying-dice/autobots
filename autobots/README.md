# Autobots — agent team

Optimus Prime (Fable, low effort) runs the session. Everyone else is a subagent he dispatches; none of them can spawn agents or message each other (`disallowedTools: Agent, SendMessage`).

## Start a session

```bash
claude --agent optimus-prime
```

Or make it the project default in `.claude/settings.json` (see `settings.example.json` at repo root).

## Roster

| | Agent | Model | Effort | Role |
|:---:|---|---|---|---|
| <img src="../assets/avatars/optimus-prime.jpg" width="60" alt="Optimus Prime" /> | **optimus-prime** | fable | low | Tech lead — roadmap, sprints, decisions, all dispatch |
| <img src="../assets/avatars/bumblebee.jpg" width="60" alt="Bumblebee" /> | **bumblebee** / bumblebee-lite | sonnet | medium / low | Developer |
| <img src="../assets/avatars/ironhide.jpg" width="60" alt="Ironhide" /> | **ironhide** / ironhide-deep | opus | medium / high | Senior developer |
| <img src="../assets/avatars/ratchet.jpg" width="60" alt="Ratchet" /> | **ratchet** / ratchet-deep | opus | medium / high | Tester |
| <img src="../assets/avatars/arcee.jpg" width="60" alt="Arcee" /> | **arcee** | opus | medium | Designer |
| <img src="../assets/avatars/prowl.jpg" width="60" alt="Prowl" /> | **prowl** / prowl-deep | fable | low / high | Architect (read-only) |
| <img src="../assets/avatars/jazz.jpg" width="60" alt="Jazz" /> | **jazz** / jazz-deep | fable | low / high | Lead designer (design docs only) |

`-deep` Fable variants may only be dispatched with a written justification (three criteria in Optimus's prompt).

## Where the plan lives

- `docs/autobots/ROADMAP.md`
- `docs/autobots/sprints/`
- `docs/autobots/decisions/` (ADRs)
- `docs/autobots/design/` (Jazz's direction docs)

## Notes

- `Agent(...)` allowlisting in Optimus's `tools` only takes effect when he is the main session (`--agent`). If you @-mention Optimus as a subagent instead, the allowlist is ignored.
- Effort is per-agent frontmatter and overrides the session effort while that agent is active. Sonnet/Opus tiers are chosen by picking the variant; there is no per-invocation effort parameter, which is why the variants exist.
- Subagents inherit the session's extended-thinking on/off setting; effort is separate.
- `settings.example.json` caps nesting at depth 1 as a belt-and-braces backstop.
