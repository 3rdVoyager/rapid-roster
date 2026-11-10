import { performance } from "node:perf_hooks";

import items from "../tests/fixtures/items.json" with { type: "json" };
import slots from "../tests/fixtures/slots.json" with { type: "json" };
import rules from "../tests/fixtures/rules.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import { createCompatibleAssignments } from "../src/lib/assignment.js";
import { evaluateModel } from "../src/lib/scoring.js";

const trialCount = Number(process.argv[2] ?? 100);

if (!Number.isInteger(trialCount) || trialCount < 1) {
  console.error("Usage: node scripts/stress-assignment-creation.js [trials]");
  process.exitCode = 1;
} else {
  runTrials(trialCount);
}

function runTrials(numberOfTrials) {
  const startedAt = performance.now();
  let successes = 0;
  const failures = [];

  for (let trial = 1; trial <= numberOfTrials; trial++) {
    const shuffledItems = shuffle(items);
    const model = createModel(shuffledItems, slots, rules);

    try {
      const assignments = createCompatibleAssignments(model);
      const evaluation = evaluateModel(
        createModel(shuffledItems, slots, rules, assignments),
        true,
      );

      if (evaluation.hardPenalty !== 0) {
        failures.push({
          trial,
          message: `Created assignments with hard penalty ${evaluation.hardPenalty}`,
        });
      } else {
        successes++;
      }
    } catch (error) {
      failures.push({
        trial,
        message: error.message,
      });
    }
  }

  const elapsedMilliseconds = performance.now() - startedAt;
  console.log(`Trials: ${numberOfTrials}`);
  console.log(`Successful assignments: ${successes}`);
  console.log(`Failures: ${failures.length}`);
  console.log(`Elapsed: ${Math.round(elapsedMilliseconds)} ms`);
  console.log(
    `Average per trial: ${Math.round(elapsedMilliseconds / numberOfTrials)} ms`,
  );

  if (failures.length > 0) {
    console.log("First failures:");
    for (const failure of failures.slice(0, 5)) {
      console.log(`- Trial ${failure.trial}: ${failure.message}`);
    }
  }
}

function shuffle(sourceItems) {
  const shuffledItems = [...sourceItems];

  for (let index = shuffledItems.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledItems[index], shuffledItems[randomIndex]] = [
      shuffledItems[randomIndex],
      shuffledItems[index],
    ];
  }

  return shuffledItems;
}
