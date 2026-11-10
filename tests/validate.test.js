import test from "node:test";
import assert from "node:assert/strict";

import items from "./fixtures/items.json" with { type: "json" };
import slots from "./fixtures/slots.json" with { type: "json" };
import rules from "./fixtures/rules.json" with { type: "json" };
import assignments from "./fixtures/assignments.json" with { type: "json" };

import {
  validateAssignments,
  validateData,
  validateRules,
} from "../src/lib/validate.js";

function freshItems() {
  return structuredClone(items);
}

function freshSlots() {
  return structuredClone(slots);
}

function freshRules() {
  return structuredClone(rules);
}

test("valid fixtures pass validation", () => {
  assert.doesNotThrow(() => {
    validateData(freshItems(), freshSlots());
  });
});

test("missing item ID fails validation", () => {
  const testItems = freshItems();
  delete testItems[0].id;

  assert.throws(() => {
    validateData(testItems, freshSlots());
  });
});

test("duplicate item IDs fail validation", () => {
  const testItems = freshItems();
  testItems[1].id = testItems[0].id;

  assert.throws(() => {
    validateData(testItems, freshSlots());
  });
});

test("duplicate slot IDs fail validation", () => {
  const testSlots = freshSlots();
  testSlots[1].id = testSlots[0].id;

  assert.throws(() => {
    validateData(freshItems(), testSlots);
  });
});

test("item and slot ID collisions fail validation", () => {
  const testItems = freshItems();
  const testSlots = freshSlots();

  testSlots[0].id = testItems[0].id;

  assert.throws(() => {
    validateData(testItems, testSlots);
  });
});

test("items must be an array", () => {
  assert.throws(() => validateData({}, freshSlots()), /Items must be an array/);
});

test("slots must be an array", () => {
  assert.throws(() => validateData(freshItems(), {}), /Slots must be an array/);
});

test("items must not be empty", () => {
  assert.throws(
    () => validateData([], freshSlots()),
    /Items must not be empty/,
  );
});

test("slots must not be empty", () => {
  assert.throws(
    () => validateData(freshItems(), []),
    /Slots must not be empty/,
  );
});

test("items must contain objects", () => {
  assert.throws(
    () => validateData([null], freshSlots()),
    /Items must be an object/,
  );
});

test("arrays cannot be item records", () => {
  assert.throws(
    () => validateData([[]], freshSlots()),
    /Items must be an object/,
  );
});

test("invalid ID values fail validation", () => {
  const invalidIds = [true, {}, [], Number.NaN];

  for (const invalidId of invalidIds) {
    const testItems = freshItems();
    testItems[0].id = invalidId;

    assert.throws(
      () => validateData(testItems, freshSlots()),
      /Item has invalid id/,
    );
  }
});

test("valid rules pass validation", () => {
  assert.doesNotThrow(() => validateRules(freshRules()));
});

test("unknown rule keywords fail validation", () => {
  const testRules = freshRules();
  testRules[0].keyword = "unknown";

  assert.throws(() => validateRules(testRules), /Unknown keyword: unknown/);
});

test("soft rules require a priority from 1 to 100", () => {
  const testRules = freshRules();
  testRules[6].priority = 101;

  assert.throws(
    () => validateRules(testRules),
    /Invalid priority for rule: R7/,
  );
});

test("limit inputs must use a supported type and non-negative integer", () => {
  const testRules = freshRules();
  testRules[4].keyword = "limit";
  testRules[4].inputs = ["max", -1];

  assert.throws(
    () => validateRules(testRules),
    /Invalid input 2 for rule: R5/,
  );
});

test("valid assignments pass validation", () => {
  assert.doesNotThrow(() =>
    validateAssignments(assignments, freshItems(), freshSlots()),
  );
});

test("assignments must reference existing slots and items", () => {
  assert.throws(
    () =>
      validateAssignments(
        { missing: [items[0].id] },
        freshItems(),
        freshSlots(),
      ),
    /Assignment references unknown slot: missing/,
  );

  assert.throws(
    () =>
      validateAssignments(
        { [slots[0].id]: ["missing"] },
        freshItems(),
        freshSlots(),
      ),
    /Assignment references unknown item: missing/,
  );
});

test("duplicate item IDs in one assignment fail validation", () => {
  assert.throws(
    () =>
      validateAssignments(
        { [slots[0].id]: [items[0].id, items[0].id] },
        freshItems(),
        freshSlots(),
      ),
    new RegExp(
      `Duplicate item assignment in slot: ${slots[0].id}, ${items[0].id}`,
    ),
  );
});
