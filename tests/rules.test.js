import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import { resolvePath } from "../src/lib/rules.js";

function createTestModel() {
  return createModel(structuredClone(items), structuredClone(slots));
}

test("resolves an item attribute", () => {
  const model = createTestModel();

  assert.deepEqual(resolvePath("items.gender", model), [
    "M",
    "M",
    "F",
    "M",
    "F",
    "F",
    "M",
    "F",
    "M",
    "F",
    "M",
    "F",
  ]);
});

test("resolves another item attribute", () => {
  const model = createTestModel();

  assert.deepEqual(resolvePath("items.height", model), [
    54,
    42,
    62,
    56,
    38,
    61,
    46,
    49,
    59,
    64,
    67,
    55,
  ]);
});

test("resolves a slot attribute", () => {
  const model = createTestModel();

  assert.deepEqual(resolvePath("slots.division", model), [
    "4/5",
    "6/7/8",
    "2/3",
    "K/1",
    "4/5",
  ]);
});

test("resolves another slot attribute", () => {
  const model = createTestModel();

  assert.deepEqual(resolvePath("slots.practiceNight", model), [
    "Tue",
    "Thu",
    "Thu",
    "Mon",
    "Wed",
  ]);
});

test("rejects an unknown collection", () => {
  const model = createTestModel();

  assert.throws(
    () => resolvePath("teams.name", model),
    /Unknown collection: teams/,
  );
});

test("rejects paths with unsupported methods", () => {
  const model = createTestModel();

  assert.throws(
    () => resolvePath("items.height.average()", model),
    /Unsupported path: items.height.average\(\)/,
  );
});
