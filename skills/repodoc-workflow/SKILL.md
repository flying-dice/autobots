---
name: repodoc-workflow
description: Work a RepoDoc project. Pick up cards from the file-based kanban board, report live progress, journal work, respect workflow gates, record decisions and keep docs current. Use whenever the repo contains boards/, decisions/ or docs/ managed by RepoDoc.
---

# repodoc-workflow

RepoDoc keeps a project's kanban board, decision records and documentation as
plain files. You move work forward by editing those files; an editor extension
watches them and updates live, so just save.

## Layout

- `boards/<board-id>/NN-slug.md`: one card per file. `NN` is the card's global position.
- `boards/<board-id>/.config.json`: board name, columns, WIP limits, labels, custom fields, gates.
- `decisions/NN-slug.md`: decision records with `status` (Proposed, Accepted, Superseded) and `date`.
- `docs/NN-slug.md`: documentation tree; the prefix orders the sidebar and the first `#` heading is the label.

## Card anatomy

Frontmatter (only `column` is required): `column`, `labels` (inline form
`[a, b]` only), `priority` (high, med, low), `agent` (free text, your name),
`live` (true while working), `status` (one line), `progress` (0 to 100),
`updatedAt` (ISO, bump on every edit), plus any custom fields from the board
config as flat keys. Never invent field ids or select options, and preserve
values you do not recognise.

Body: `# Title`, a short description, then optional sections in order:
`## Checklist` (`- [ ]` items), `## Gates` (evidence lines), `## Comments`
(the work journal).

```markdown
---
column: doing
labels: [feature, backend]
priority: high
live: true
status: Wiring the export endpoint
progress: 40
updatedAt: 2026-07-17T10:32:00.000Z
---
# Add CSV export

Let users download report data as CSV. See decisions/04-export-format.md.

## Checklist

- [x] Design the column mapping
- [ ] Implement the endpoint

## Comments

- **claude** (2026-07-17T10:32:00.000Z): Mapped columns in src/export/csv.ts:14-38; endpoint next.
```

## Journal your work

`## Comments` is an append-only journal. Add an entry for every meaningful step;
never rewrite or delete earlier entries. Each entry is one bullet:
`- **<name>** (<ISO time>): <what and why>`. Reference every file you touched as
`path:line` or `path:start-end`; the extension turns these into links, so never
describe a change without pointing at where it lives.

## Working a card

1. Claim it: `column: doing`, `live: true`, a `status`, your name in `agent`, and a journal entry.
2. While working keep `live`, `status` and `progress` honest, tick checklist items, journal progress.
3. When done: `column: review` (a human moves it to `done`), `live: false`, remove `status` and `progress`.
4. Bump `updatedAt` on every change.

## Gates

A column may declare `enter` and `exit` gates. Before changing `column`,
evaluate the target's enter gates and the source's exit gates, and move only
when all pass.

- **Script gates** name a command. Run it yourself and, only on exit 0, record
  `- [x] <gateId> — <one-line result> (<name>, <ISO time>)` under `## Gates`.
- **Field gates** check a card field with an optional `check`: absent means
  non-empty; `empty`, `nonempty`, `= v`, `!= v`, `> n`, `>= n`, `< n`, `<= n`,
  `contains v`, `match <regex>`. Satisfy them by setting the field for real.
- **Approvals are field gates a human sets.** Never set a field that encodes
  human sign-off (`peer-reviewed`, `approved-by` and the like) unless you are
  that person.

If you cannot honestly satisfy a gate, stay put and set
`status: blocked on gate: <gateId>`. Humans may bypass with an `OVERRIDDEN`
line under `## Gates`.

## Ordering, decisions, docs

- The extension renumbers cards when a human drags them; never renumber others. New cards take the next free `NN`.
- Record significant choices in `decisions/<next-NN>-slug.md` with `status`, `date`, and Context, Decision, Consequences sections. Link it from the card.
- Keep `docs/` current whenever behaviour changes.
