# Nagorik Sheba — Week 5 Sprint Retrospective & Velocity Report
*Development Sprint 2 · AI-generated report*

---

## 1. Sprint Summary

Two substantial features were completed this week, both outside the originally scoped board items:

| Feature | Scope |
|---|---|
| **Dark/Light Theme System** | React `ThemeProvider` + `useTheme()` hook, CSS-variable-based Tailwind tokens, localStorage persistence, no-flash pre-mount script, bilingual (EN/বাংলা) toggle in Navbar and Landing hero, WCAG-contrast fixes for light mode |
| **Layered Staff Workflow** | Supervisor-directed 5-role human approval chain (Junior → Senior → Mayor → WIT → Field) sitting on top of the AI verification layer; new `workflow_steps` audit table; unified workflow API; role-based staff dashboards; public lifecycle timeline; email notifications (nodemailer/Ethereal); resolution-photo proof with citizen confirm/dispute; 3-day auto-reopen sweep |

Both were end-to-end tested (build verification for the theme system; full role-chain + rejection + dispute + email-delivery testing for the workflow).

---

## 2. Velocity Analysis

### 2.1 Current board status (backfilled)

The GitHub Projects board (kanban, `MozazaZaman/projects/2`) has been backfilled to include both Week 5 features. Current snapshot:

| Column | Cards | Share |
|---|---|---|
| Done | 30 | 67% |
| To do | 9 | 20% |
| In progress | 6 | 13% |
| Backlog | 0 | — (not yet populated) |

**Total: 45 cards.**

This is a single-point-in-time snapshot, not yet a trend — a real velocity figure (items closed per week, compared across weeks) requires at least one more week of counts to compare against. This week's number should be treated as the baseline going forward, not as "Week 5's velocity" in isolation, since it also includes the backfilled historical work.

### 2.2 AI-suggested backlog adjustments

1. **Populate the Backlog column**: it's currently empty, which means there's no visible queue of future/unplanned work distinct from "To do" (committed-this-sprint work). Splitting these will make next sprint's planning and velocity tracking more accurate.
2. **Establish a per-week snapshot habit**: record this column breakdown (Done/To do/In progress/Backlog counts) at the same point each week — this is what turns this week's numbers into an actual velocity trend rather than a series of disconnected snapshots.
3. **Split by layer going forward**: both delivered Week 5 features spanned backend + web + mobile + email/infra. Track them as separate cards per layer rather than one card per feature, so future sprint sizing reflects the real per-layer effort.
4. **Tag supervisor-directed work separately**: the staff workflow came from a mid-sprint supervisor instruction, not the original plan. Labeling such additions distinctly from self-planned backlog items will make it clear whether future velocity dips are due to under-delivery or externally-added scope.
5. **Log-as-you-go for Week 6**: Week 6 is CRUD/forms/API-integration-heavy (many small, fast-moving tasks) — close/create cards the same day each piece is finished, rather than batching updates at week's end, so the weekly snapshot stays accurate.

---

## 3. Retrospective

### What went well
- Delivered two large, non-trivial features (UI/UX infra + a full multi-role backend workflow) in a single week, both fully tested end-to-end.
- The staff workflow design decisions (department-as-category, dedicated audit table, defined rejection paths) show solid architectural judgment — extending the schema cleanly rather than overloading a single `status` field.
- Real-world grounding: the approval chain mirrors actual Bangladesh local-government structure, which strengthens the project's credibility as a civic tool.

### What didn't go as planned / blockers
- Project board tracking fell behind actual delivery — both major features were built without corresponding board cards.
- The staff workflow was a supervisor-added requirement mid-sprint, which was absorbed successfully but wasn't part of the original Week 5 plan — worth flagging as a scope change, not silently folded in.
- Mayor-bottleneck risk was identified (every complaint waiting on 3 human approval hops) but not yet mitigated — deferred to the Week 6 SLA auto-escalation system.

### Next sprint (Week 6) focus
- Backfill the board per the suggestions above before new work starts, so Week 6 velocity is measurable against an accurate baseline.
- Core Week 6 mandate: CRUD operations, forms, and API integration across the remaining entities (USER, COMPLAINT_VOTE, STAFF assignment views not yet covered by the workflow endpoints).
- Begin the SLA auto-escalation system to address the mayor-bottleneck risk flagged this week.

---

## 4. Appendix: Planned Velocity Automation

To make the weekly board snapshot (Section 2.1) automatic instead of manual, a GitHub Actions workflow can be added at:

```
.github/workflows/weekly-velocity.yml
```

Starter workflow — runs weekly, pulls open/closed issue counts via the `gh` CLI (already available on GitHub-hosted runners), and commits a simple markdown snapshot to the repo:

```yaml
name: Weekly velocity snapshot

on:
  schedule:
    - cron: "0 9 * * 1"   # every Monday 09:00 UTC — adjust to your sprint cadence
  workflow_dispatch:        # allows manual "Run workflow" trigger

permissions:
  contents: write
  issues: read

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Count issues by state
        id: counts
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          OPEN=$(gh issue list --repo ${{ github.repository }} --state open --json number --jq 'length')
          CLOSED=$(gh issue list --repo ${{ github.repository }} --state closed --json number --jq 'length')
          echo "open=$OPEN" >> "$GITHUB_OUTPUT"
          echo "closed=$CLOSED" >> "$GITHUB_OUTPUT"

      - name: Write snapshot
        run: |
          mkdir -p reports
          DATE=$(date +%Y-%m-%d)
          echo "## Velocity snapshot — $DATE" >> reports/velocity-log.md
          echo "- Open issues: ${{ steps.counts.outputs.open }}" >> reports/velocity-log.md
          echo "- Closed issues: ${{ steps.counts.outputs.closed }}" >> reports/velocity-log.md
          echo "" >> reports/velocity-log.md

      - name: Commit snapshot
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add reports/velocity-log.md
          git commit -m "chore: weekly velocity snapshot" || echo "No changes to commit"
          git push
```

**Notes:**
- This counts plain repo issues, not Projects v2 board columns — reading Projects v2 data requires the GraphQL API with a token that has `project` scope (the default `GITHUB_TOKEN` isn't enough), which is a follow-up step if the board itself (not just issues) needs to be queried.
- `reports/velocity-log.md` accumulates one entry per run, giving an actual week-over-week trend after a few runs — this is what would eventually feed the velocity bar chart.
- Adjust the `cron` schedule to match whichever day your sprint week starts/ends.

---

*Report generated with AI assistance from sprint work summaries; velocity figures pending board backfill.*