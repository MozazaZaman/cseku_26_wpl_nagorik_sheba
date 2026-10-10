---
name: neon-postgres
description: >-
  Guides and best practices for working with Lakebase Postgres on Neon:
  connections, pooled vs direct, schema migrations, branching, autoscaling,
  scale-to-zero, instant restore, read replicas, IP allow lists, logical
  replication, and Lakebase Search. Use when the work is an existing
  DATABASE_URL, SQL, schema, inspect, or search. Also use for "@neondatabase/serverless",
  "neon inspect db", semantic/full-text/BM25/hybrid search.
metadata:
  parent: neon
  source: https://neon.com/.well-known/agent-skills/neon-postgres/SKILL.md
---

# Lakebase Postgres

Fully compatible with Postgres; works with any driver or ORM. Same database whether reached through Neon or Databricks; this covers the Neon access path.

## Setup flow

1. If a `DATABASE_URL` is supplied (prompt, env, repo) or `.neon` points at a project, use it. Do not create a second project for schema work.
2. Use the supplied string as-is. Otherwise `neon env pull` to get it into `.env` (read the file first; never overwrite existing values).

### Pooled vs direct

| Use case | Connection type |
| --- | --- |
| Web applications, serverless functions | Pooled (`-pooler` `DATABASE_URL`) |
| Schema migrations, pg_dump/restore, replication, LISTEN/NOTIFY, session state | Direct (`DATABASE_URL_UNPOOLED`) |

This project's app traffic uses the pooled URL; one-shot schema work uses the direct URL when available.

### Driver

Preserve the existing ORM/driver. This project uses `node-postgres` (`pg` Pool). For new TypeScript schema work with no established choice, Drizzle is suggested.

## Schema

Manage schemas and migrations as code. Avoid ad hoc migrations. Test a migration on a branch of production, against production-like data, before applying it to production. Run migrations over the **direct** connection.

## Branching

Branches are instant copy-on-write clones, each with its own compute endpoint. Use CLI/MCP to create, inspect, compare. See also the `neon-postgres-branches` skill (fetch from https://neon.com/docs/ai/skills/neon-postgres-branches/SKILL.md if needed).

## Diagnostics

Prefer read-only checks first: `neon inspect db <check>` (checks: `table-sizes`, `index-sizes`, `unused-indexes`, `seq-scans`, `long-running-queries`, `locks`, `outliers`, `calls`, `lfc-hit-rate`, `working-set`, `vacuum-stats`, `bloat`, `replication-slots`, `subscriptions`), or MCP `inspect_database`. For per-query cache behavior use `EXPLAIN (ANALYZE, BUFFERS, PREFETCH, FILECACHE)` on safe read-only queries only.

## Gotchas

- Transaction-mode pooling breaks session-level ops (`SET`, prepared-statement name clashes, `LISTEN`): use direct URL for those.
- Compute-wide stats reset on restart/scale-to-zero: run a representative workload before interpreting cache/stats checks.
- Scale to zero: idle computes suspend after ~5 min (configurable); first query after suspend pays a cold-start penalty; storage stays active.
