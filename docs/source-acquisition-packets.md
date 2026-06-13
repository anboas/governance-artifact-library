# Source Acquisition Packets

Policy Intelligence exports capture work orders as `policy-source-acquisition-packet-v1` JSON packets. This corpus treats those packets as the handoff contract between product-side triage and repo-side source capture.

## Packet Intake

Use the planner to validate a packet against the current source acquisition queue and produce a deterministic capture plan:

```bash
npm run packet:plan -- --packet path/to/policy-source-acquisition-active-queue-YYYY-MM-DD.json
```

Write a plan to disk:

```bash
npm run packet:plan -- --packet path/to/packet.json --out work/source-acquisition-capture-plan.json
```

Check a committed plan fixture:

```bash
npm run packet:plan -- --packet data/source-acquisition-packet-example.json --out data/source-acquisition-capture-plan.example.json --check
```

## What The Planner Verifies

- Packet version is `policy-source-acquisition-packet-v1`.
- Each item exists in `data/source-acquisition-queue.json`.
- Queue rank, priority, and item type still match the corpus queue.
- Source/search/API URLs are HTTPS when present.
- Local execution status is one of the supported Policy Intelligence states.
- Corpus target paths stay under `artifacts/<artifact-id>/` and point to raw mirror, extracted text, artifact metadata, and provenance locations.

## Plan Output

The generated `source-acquisition-capture-plan-v1` contains:

- Source and queue metadata.
- Local status, owner, and notes from the product UI.
- Capture mode: API/direct fetch, browser-assisted capture, manual import, or source discovery.
- Source URLs and official source candidates.
- Existing or candidate artifact target paths.
- Next actions and acceptance criteria for each work item.

## Capture Loop

1. Export a packet from the Policy Source Acquisition Queue.
2. Run `npm run packet:plan` in this repo.
3. Capture official source files or register source-known blockers.
4. Update artifact metadata, provenance, and raw/text paths.
5. Regenerate corpus sidecars and maps:

```bash
npm run extract
npm run claims
npm run references
npm run authority
npm run index
npm run coverage
npm run sources
npm run acquisition
npm run validate
```

6. Confirm the relevant acquisition queue item is reduced, re-ranked, or removed.
