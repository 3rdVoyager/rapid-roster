import { readFileSync } from "node:fs";

import { parseRulesCsv } from "../../src/lib/import.js";

export default parseRulesCsv(
  readFileSync(new URL("./rules.csv", import.meta.url), "utf8"),
);
