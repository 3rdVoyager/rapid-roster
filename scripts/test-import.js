import fs from "node:fs";
import path from "node:path";

import { parseCsv } from "../src/lib/import.js";
import { createModel } from "../src/lib/model.js";
import { evaluateModel } from "../src/lib/evaluation.js";

const [itemsPath = "./tests/fixtures/items.csv", slotsPath = "./tests/fixtures/slots.csv", rulesPath = "./tests/fixtures/rules.json", assignmentsPath = "./tests/fixtures/assignments.json"] = process.argv.slice(2);

if (!itemsPath || !slotsPath) {
  console.error(
    "Usage: node scripts/test-import.js " +
      "<items.csv> <slots.csv> [rules.json] [assignments.json]",
  );
  process.exitCode = 1;
} else {
  try {
    const items = parseCsvFile(itemsPath);
    const slots = parseCsvFile(slotsPath);
    const rules = rulesPath ? readJsonFile(rulesPath) : [];
    const assignments = assignmentsPath ? readJsonFile(assignmentsPath) : {};

    console.log(`Parsed items: ${items.length}`);
    console.log(`Parsed slots: ${slots.length}`);
    console.log(`Loaded rules: ${rules.length}`);
    console.log(
      `Loaded assignment slots: ${Object.keys(assignments).length}`,
    );

    const model = createModel(items, slots, rules, assignments);
    console.log("Model creation: passed");

    const evaluation = evaluateModel(model);
    console.log(`Hard penalty: ${evaluation.hardPenalty}`);
    console.log(`Hard violations: ${evaluation.hardViolations.length}`);
    console.log(`Soft penalty: ${evaluation.softPenalty}`);
    console.log(`Soft violations: ${evaluation.softViolations.length}`);
    console.log("Model evaluation: passed");
  } catch (error) {
    console.error(`CSV model test failed: ${error.message}`);
    process.exitCode = 1;
  }
}

function parseCsvFile(filePath) {
  const absolutePath = path.resolve(filePath);
  return parseCsv(fs.readFileSync(absolutePath, "utf8"));
}

function readJsonFile(filePath) {
  const absolutePath = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}
