import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const manifest = readJson("manifest.json");

assert.equal(Array.isArray(manifest.artifacts), true, "manifest.artifacts must be an array");
assert.equal(manifest.artifact_count, manifest.artifacts.length, "manifest artifact count must match artifacts");
assert.ok(manifest.artifact_count >= 10, "seed corpus should include mirrored and queued official artifacts");

let mirrored = 0;
let blocked = 0;

for (const entry of manifest.artifacts) {
  assert.ok(entry.id, "artifact manifest entry needs id");
  assert.ok(entry.path, `${entry.id} needs path`);
  const artifact = readJson(entry.path);
  assert.equal(artifact.id, entry.id, `${entry.id} id mismatch`);
  assert.equal(artifact.domain, "policy", `${entry.id} should stay in policy domain`);
  assert.ok(artifact.title, `${entry.id} needs title`);
  assert.ok(artifact.artifact_type, `${entry.id} needs artifact_type`);
  assert.ok(artifact.issuing_authority, `${entry.id} needs issuing_authority`);
  assert.ok(artifact.issuing_organization, `${entry.id} needs issuing_organization`);
  assert.ok(artifact.source_url?.startsWith("https://"), `${entry.id} needs https source_url`);
  assert.ok(["source_known", "mirrored", "text_extracted", "normalized", "structured", "reviewed"].includes(artifact.pipeline_state), `${entry.id} invalid pipeline_state`);
  assert.ok(["mirrored", "blocked", "queued", "retired"].includes(artifact.mirror_status), `${entry.id} invalid mirror_status`);
  assert.ok(["not_started", "blocked", "parsed", "partial", "failed"].includes(artifact.parser_status), `${entry.id} invalid parser_status`);
  assert.ok(["unreviewed", "machine_reviewed", "analyst_review_needed", "analyst_reviewed"].includes(artifact.review_status), `${entry.id} invalid review_status`);
  assert.equal(existsSync(join(ROOT, "artifacts", artifact.id, "provenance.json")), true, `${entry.id} needs provenance.json`);

  if (artifact.mirror_status === "mirrored") {
    mirrored += 1;
    assert.ok(artifact.raw_path, `${entry.id} mirrored artifact needs raw_path`);
    assert.ok(artifact.extracted_text_path, `${entry.id} mirrored artifact needs extracted_text_path`);
    assert.ok(artifact.structured_json_path, `${entry.id} mirrored artifact needs structured_json_path`);
    assert.equal(existsSync(join(ROOT, artifact.raw_path)), true, `${entry.id} raw file missing`);
    assert.equal(existsSync(join(ROOT, artifact.extracted_text_path)), true, `${entry.id} extracted text missing`);
    assert.equal(existsSync(join(ROOT, artifact.structured_json_path)), true, `${entry.id} structured summary missing`);
    const checksum = createHash("sha256").update(readFileSync(join(ROOT, artifact.raw_path))).digest("hex");
    assert.equal(checksum, artifact.checksum_sha256, `${entry.id} raw checksum mismatch`);
    assert.ok(readFileSync(join(ROOT, artifact.extracted_text_path), "utf8").trim().length > 100, `${entry.id} extracted text should be non-empty`);
  }

  if (artifact.mirror_status === "blocked") {
    blocked += 1;
    assert.equal(artifact.raw_path, null, `${entry.id} blocked artifact should not claim raw_path`);
    assert.equal(artifact.pipeline_state, "source_known", `${entry.id} blocked artifact should stay source_known`);
  }
}

assert.ok(mirrored >= 6, `expected at least 6 mirrored seed artifacts, got ${mirrored}`);
assert.ok(blocked >= 3, `expected blocked official-source records to be explicit, got ${blocked}`);
assert.equal(existsSync(join(ROOT, "sources", "source-registry.json")), true, "source registry missing");

console.log(`Validated ${manifest.artifact_count} artifacts (${mirrored} mirrored, ${blocked} source-known blocked).`);

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}
