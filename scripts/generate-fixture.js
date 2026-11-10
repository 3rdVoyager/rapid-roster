import { performance } from "node:perf_hooks";

import items from "../tests/fixtures/items.json" with { type: "json" };
import slots from "../tests/fixtures/slots.json" with { type: "json" };
import rules from "../tests/fixtures/rules.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import {
  createCompatibleAssignments,
  improveAssignments,
} from "../src/lib/assignment.js";
import { evaluateModel } from "../src/lib/scoring.js";

const maxIterations = Number(process.argv[2] ?? 100);

if (!Number.isInteger(maxIterations) || maxIterations < 1) {
  console.error("Usage: node scripts/generate-fixture.js [maxIterations]");
  process.exitCode = 1;
} else {
  const baseModel = createModel(items, slots, rules);
  const startingAssignments = createCompatibleAssignments(baseModel);
  const startingModel = createModel(
    items,
    slots,
    rules,
    startingAssignments,
  );
  const startingEvaluation = evaluateModel(startingModel, true);
  const startedAt = performance.now();

  try {
    const assignments = improveAssignments(
      startingModel,
      maxIterations,
    );
    const finalModel = createModel(items, slots, rules, assignments);
    const finalEvaluation = evaluateModel(finalModel, true);

    console.log("Legal assignment found");
    printSummary(startingEvaluation, finalEvaluation, startedAt);
    console.log("Assignments:");
    console.log(JSON.stringify(assignments, null, 2));
  } catch (error) {
    console.log("Could not create a legal assignment");
    console.log(`Message: ${error.message}`);
    console.log(`Elapsed: ${Math.round(performance.now() - startedAt)} ms`);
    console.log(`Starting hard penalty: ${startingEvaluation.hardPenalty}`);
    console.log(
      `Final hard penalty: ${error.hardPenalty ?? "unavailable"}`,
    );
    console.log(
      `Remaining violations: ${error.hardViolations?.length ?? "unavailable"}`,
    );
  }
}

function printSummary(startingEvaluation, finalEvaluation, startedAt) {
  console.log(`Elapsed: ${Math.round(performance.now() - startedAt)} ms`);
  console.log(`Starting hard penalty: ${startingEvaluation.hardPenalty}`);
  console.log(`Final hard penalty: ${finalEvaluation.hardPenalty}`);
  console.log(
    `Remaining violations: ${finalEvaluation.hardViolations.length}`,
  );
}
