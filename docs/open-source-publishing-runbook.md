# Open-source contribution publishing runbook

## Working route (verified 2026-10-15)

For Thomas-owned branches, use the authorized OVH server's authenticated `gh` and Git CLI. This route successfully updated bloomberg/memray PR #1048 (commit `70a12b2`) and posted a maintainer reply, after the GitHub connector returned `403 Resource not accessible by integration`. The ledger repository `tmsteph/tmsteph-redesign-2025` also accepted a direct Git push (commit `f108a23`).

## Preflight

1. Inspect current upstream PR and comments; avoid duplicate replies and contributions.
2. Check `gh auth status`, `git remote -v`, `git status -sb`, and compare local and remote SHA.
3. Follow upstream contribution rules, run relevant tests and `git diff --check`.
4. For DCO projects verify commit author, email and matching `Signed-off-by` trailers. Thomas has authorized sign-off for his own contributions; never sign for other people.
5. Preserve dirty worktrees: use a dedicated worktree/branch for repairs.
6. Publish with `gh`/`git` from the authorized server when connector write permissions are insufficient. Use `--force-with-lease` only when rewriting a Thomas-owned PR branch is technically necessary for DCO; never force-push shared branches.
7. Verify GitHub's actual remote SHA and PR status after publishing.
8. Update `opensource.html` only for genuine submitted/merged work, preserving precise statuses (open PR, accepted review, merged PR).
9. Verify the live URL independently. Git push success does **not** prove site deployment. `.github/workflows/verify-opensource-ledger.yml` watches for the Memray receipt as a deployment canary; update the canary as needed when the ledger evolves.

## Classify errors precisely

- `403 Resource not accessible by integration`: GitHub connector permission/scope issue; try authorized server `gh` route, do not call it an OpenAI safety block.
- `non-fast-forward`: remote advanced; fetch and reconcile before retrying.
- `protected branch` or ruleset rejection: respect repository policy and open a PR.
- `DCO` check failure: inspect each commit trailer and author identity; repair only Thomas-owned commits.
- CLI process/tool execution refusal: record the exact tool error and operation; distinguish it from GitHub API rejection.
- GitHub updated but public HTML unchanged: investigate website deployment separately; do not report the ledger live.

Keep Desktop Commander as exceptional recovery only. Prefer server-native Operator jobs, GitHub Actions, and direct GitHub API/connector for routine operations. Never expose tokens in logs.
