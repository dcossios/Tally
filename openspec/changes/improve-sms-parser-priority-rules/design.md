## Context

The current parser is a small ordered list of regex matches in `convex/lib/smsParser.ts`. It works for existing fixtures but misses several high-frequency Bancolombia variants found in recent messages:

- `Pagaste ... desde tu producto ...`
- `pagaste ... por codigo QR ...`
- `Recibiste un pago proveedor ...`
- rejected suspicious transfer alerts
- date strings that omit `a las` or include seconds

The shortest safe change is to extend the existing parser instead of replacing it. The import pipeline already records parser outcomes and already distinguishes confirmed vs pending records, so the parser is the narrowest place to fix this.

## Goals / Non-Goals

**Goals:**
- Parse the listed Bancolombia variants into the correct income or expense type.
- Avoid creating transactions for rejected suspicious transfer alerts.
- Make date extraction tolerant to the known visible variants.
- Preserve the current import flow and test style.

**Non-Goals:**
- Generalize parsing across all banks.
- Introduce AI-based parsing or confidence scoring.
- Redesign categories, review UI, or transaction storage.
- Broaden scope beyond the named message families.

## Decisions

1. Extend the existing regex-first parser instead of introducing a new parsing layer.
   Rationale: this is the cheapest path that fits the current architecture and addresses the known failures without a broader parser rewrite.
   Alternative considered: signal-based parser. Rejected for now because it adds more moving parts than this scoped change needs.

2. Add an explicit non-movement outcome for rejected suspicious transfer alerts.
   Rationale: these messages describe a blocked attempt, not a completed expense, so they should not produce review noise or dashboard data.
   Alternative considered: keep them as `unknown` pending messages. Rejected because the current behavior is actively misleading.

3. Relax date matching in one shared date parser rather than per-rule parsing.
   Rationale: the visible failures share the same date formatting issue, so one tolerant extractor is less code and lowers future rule churn.
   Alternative considered: duplicate date handling inside each new rule. Rejected because it is harder to maintain and easier to break.

4. Keep rule matching ordered and specific.
   Rationale: the current parser relies on order, so new rules should be inserted before the generic unknown fallback and in a sequence that avoids overlapping false positives.

## Risks / Trade-offs

- [Rule overlap] -> Mitigation: keep the new patterns narrowly scoped and cover each family with dedicated fixtures.
- [Ignored alert shape is too broad] -> Mitigation: only ignore messages that explicitly say the transfer was rejected.
- [Date tolerance accidentally matches unrelated text] -> Mitigation: keep parsing anchored to the existing `el <date> <time>` structure and test both old and new formats.
- [Still more unsupported bank variants remain] -> Mitigation: keep scope limited to the five approved wins and revisit only with fresh samples.

## Migration Plan

No data migration is required. The change only affects new imports after deployment. Rollback is a normal code rollback to the previous parser behavior.

## Open Questions

- Should ignored suspicious-transfer alerts be fully dropped, or stored as audit-only import rows without transactions?
- Should `Pagaste ... desde tu producto ...` be categorized as `Transferencias` or a separate payment category, or stay on the parser's closest current category?
