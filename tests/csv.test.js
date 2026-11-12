import test from "node:test";
import assert from "node:assert/strict";

import { parseCsv } from "../src/lib/import.js";

test("parses CSV headers and records", () => {
  const records = parseCsv("id,name,division\nI1,Alice,North\nI2,Bob,South");

  assert.deepEqual(records, [
    { id: "I1", name: "Alice", division: "North" },
    { id: "I2", name: "Bob", division: "South" },
  ]);
});

test("converts headers to camelCase", () => {
  const records = parseCsv(
    "ID,Practice Nights,Gym_Location,alreadyCamel\nI1,Monday; Tuesday,ROC,value",
  );

  assert.deepEqual(records, [
    {
      id: "I1",
      practiceNights: ["Monday", "Tuesday"],
      gymLocation: "ROC",
      alreadyCamel: "value",
    },
  ]);
});

test("parses quoted commas, escaped quotes, and newlines", () => {
  const records = parseCsv(
    'id,name,notes\nI1,"Smith, Alice","Said ""hello"""\nI2,Bob,"Line one\nLine two"',
  );

  assert.deepEqual(records, [
    {
      id: "I1",
      name: "Smith, Alice",
      notes: 'Said "hello"',
    },
    {
      id: "I2",
      name: "Bob",
      notes: "Line one\nLine two",
    },
  ]);
});

test("preserves empty values and missing trailing fields", () => {
  const records = parseCsv("id,name,division\r\nI1,,\r\nI2,Bob");

  assert.deepEqual(records, [
    { id: "I1", name: "", division: "" },
    { id: "I2", name: "Bob", division: "" },
  ]);
});

test("splits semicolon-delimited cell values into arrays", () => {
  const records = parseCsv('id,requests,name\nI1,"I2; I3;",Alice');

  assert.deepEqual(records, [
    { id: "I1", requests: ["I2", "I3"], name: "Alice" },
  ]);
});

test("removes a UTF-8 BOM and trims headers", () => {
  const records = parseCsv("\uFEFF id , name \nI1,Alice");

  assert.deepEqual(records, [{ id: "I1", name: "Alice" }]);
});

test("rejects invalid CSV headers and quoted fields", () => {
  assert.throws(
    () => parseCsv("id,id\nI1,I1"),
    /column headers must be unique/,
  );
  assert.throws(
    () => parseCsv("id,name\nI1,\"Alice"),
    /unterminated quoted field/,
  );
  assert.throws(
    () => parseCsv("id,name\nI1,Al\"ice"),
    /quote found inside an unquoted field/,
  );
});
