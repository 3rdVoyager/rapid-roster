import test from "node:test";
import assert from "node:assert/strict";

import { exportCsv } from "../src/lib/export.js";
import { parseCsv } from "../src/lib/import.js";

test("exports records as CSV", () => {
  const csv = exportCsv([
    { id: "I1", name: "Alice", requests: ["I2", "I3"] },
    { id: "I2", name: "Bob", requests: [] },
  ]);

  assert.equal(
    csv,
    "id,name,requests\nI1,Alice,I2; I3\nI2,Bob,",
  );
  assert.deepEqual(parseCsv(csv), [
    { id: "I1", name: "Alice", requests: ["I2", "I3"] },
    { id: "I2", name: "Bob", requests: "" },
  ]);
});

test("exports values requiring CSV escaping", () => {
  assert.equal(
    exportCsv([{ id: "I1", notes: 'Said "hello",\nthen left' }]),
    'id,notes\nI1,"Said ""hello"",\nthen left"',
  );
});

test("exports columns from all records", () => {
  assert.equal(
    exportCsv([{ id: "I1", name: "Alice" }, { id: "I2", division: "South" }]),
    "id,name,division\nI1,Alice,\nI2,,South",
  );
});

test("rejects invalid JSON export input", () => {
  assert.throws(() => exportCsv({ id: "I1" }), /must be an array/);
  assert.throws(() => exportCsv([null]), /record objects/);
});
