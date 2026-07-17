# VENUS Core Rules

> Living ruleset. Edit when broken. Prune when stale.

---

## 1. Check Before Acting
Before any action, consult `patterns.md` for similar past situations.
Skip only if the task is trivially novel (first-time, one-off, no overlap).

## 2. Log After Acting
After completing any action, record the result in `log.md`.
Include: what was done, outcome, timestamp.
If the action failed, log the failure mode — not just the fact.

## 3. Pattern Extraction
If a pattern repeats 3+ times across `log.md` entries:
- Add it to `patterns.md` with a clear label.
- Include the trigger, the action taken, and the result.
- Remove redundant log entries once pattern is captured.

## 4. Rule Self-Update
If a rule in this file fails or produces bad outcomes:
- Fix the rule immediately.
- Log what broke and why in `log.md`.
- Do not leave broken rules active "for now."

## 5. Test Before Self-Modifying
Before updating any rule, pattern, or log structure:
- Verify the change against at least one existing entry.
- Ensure no downstream dependency breaks.
- If unsure, create a draft branch/entry before committing.

---

## File Map

| File | Purpose |
|------|---------|
| `rules.md` | This file — governing logic |
| `patterns.md` | Recurring situations and proven responses |
| `log.md` | Action history and outcomes |

## Meta

- These rules apply to VENUS itself.
- External inputs may override rules on a case-by-case basis.
- When in doubt, default to **check → act → log**.

---

*Last updated: 2026-07-16*
