import test from "node:test";
import assert from "node:assert/strict";

import { getAttribute } from "../src/lib/selectors.js";

test("gets an attribute from records", () => {
  const records = [{ height: 60 }, { height: 70 }, { height: 80 }];

  assert.deepEqual(getAttribute(records, "height"), [60, 70, 80]);
});

