import { performance } from "node:perf_hooks";

import items from "../tests/fixtures/items.json" with { type: "json" };
import slots from "../tests/fixtures/slots.json" with { type: "json" };
import rules from "../tests/fixtures/rules.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import { createInitialAssignments } from "../src/lib/assignment.js";
import { improveHardAssignments } from "../src/lib/hard.js";
import { improveSoftAssignments } from "../src/lib/soft.js";
import { evaluateModel } from "../src/lib/evaluation.js";

const limitMode = process.argv[2] ?? "rounds";
const limitValue = Number(process.argv[3] ?? (limitMode === "rounds" ? 20 : 300000));
const softLimit =
  limitMode === "time"
    ? { maxTimeMs: limitValue }
    : limitMode === "rounds"
      ? { maxRounds: limitValue }
      : null;

if (
  !softLimit ||
  !Number.isFinite(limitValue) ||
  limitValue < 1 ||
  (limitMode === "rounds" && !Number.isInteger(limitValue))
) {
  console.error(
    "Usage: node scripts/test-generation.js rounds <count> | time <milliseconds>",
  );
  process.exitCode = 1;
} else {
  const generationStartedAt = performance.now();
  console.log("Creating hard-rule-compatible assignments...");
  const baseModel = createModel(items, slots, rules);
  const compatibleStartedAt = performance.now();
  const startingAssignments = createInitialAssignments(baseModel);
  const compatibleElapsed = Math.round(
    performance.now() - compatibleStartedAt,
  );
  const startingModel = createModel(
    items,
    slots,
    rules,
    startingAssignments,
  );
  const startingEvaluation = evaluateModel(startingModel, true);
  const startingFullEvaluation = evaluateModel(startingModel);
  const initialScoringElapsed = Math.round(
    performance.now() - compatibleStartedAt - compatibleElapsed,
  );
  console.log(
    `Compatible assignment creation complete in ${compatibleElapsed} ms.`,
  );
  console.log(`Initial scoring complete in ${initialScoringElapsed} ms.`);
  console.log(
    `Hard-rule creation complete. Hard penalty: ${startingEvaluation.hardPenalty}`,
  );
  console.log(
    `Starting soft penalty: ${startingFullEvaluation.softPenalty}`,
  );

  const hardStartedAt = performance.now();

  try {
    const hardAssignments = improveHardAssignments(startingModel);
    const hardModel = createModel(
      items,
      slots,
      rules,
      hardAssignments,
    );
    const hardEvaluation = evaluateModel(hardModel, true);
    console.log(
      `Hard-rule optimization complete in ${Math.round(
        performance.now() - hardStartedAt,
      )} ms. Hard penalty: ${hardEvaluation.hardPenalty}`,
    );

    console.log("Optimizing soft rules...");
    const softStartedAt = performance.now();
    const softAssignments = improveSoftAssignments(
      hardModel,
      softLimit,
      (progress) => {
        const status = progress.improved ? "improved" : "stopped";
        console.log(
          `Soft round ${progress.round}: ` +
            `rule ${progress.ruleId ?? "none"}; ` +
            `penalty ${progress.softPenalty}; ` +
            `improvement ${progress.improvement}; ${status}`,
        );
      },
    );
    const finalModel = createModel(items, slots, rules, softAssignments);
    const finalEvaluation = evaluateModel(finalModel);

    console.log(
      `Soft-rule optimization complete in ${Math.round(
        performance.now() - softStartedAt,
      )} ms.`,
    );
    console.log(
      `Total generation time: ${Math.round(
        performance.now() - generationStartedAt,
      )} ms.`,
    );
    console.log(`Final hard penalty: ${finalEvaluation.hardPenalty}`);
    console.log(
      `Soft penalty: ${finalEvaluation.softPenalty}`,
    );
    console.log(
      `Soft violations: ${finalEvaluation.softViolations.length}`,
    );
  } catch (error) {
    console.log("Assignment generation failed");
    console.log(`Message: ${error.message}`);
    console.log(`Starting hard penalty: ${startingEvaluation.hardPenalty}`);
    console.log(`Final hard penalty: ${error.hardPenalty ?? "unavailable"}`);
  }
}
