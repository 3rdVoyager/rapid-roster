import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };
import rules from "./fixtures/rules.json" with { type: "json" };
import assignments from "./fixtures/assignments.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import {
  evaluateRule,
  evaluateOperator,
  evaluateRecursiveRule,
  resolvePath,
} from "../src/lib/rules.js";

function createTestModel() {
  return createModel(
    structuredClone(items),
    structuredClone(slots),
    structuredClone(rules),
    structuredClone(assignments),
  );
}
