import { performance } from "node:perf_hooks";

import items from "../tests/fixtures/items.json" with { type: "json" };
import slots from "../tests/fixtures/slots.json" with { type: "json" };
import rules from "../tests/fixtures/rules.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import {
  createCompatibleAssignments,
  improveHardAssignments,
  improveSoftAssignments,
} from "../src/lib/assignment.js";
import { evaluateModel } from "../src/lib/scoring.js";

const maxIterations = Number(process.argv[2] ?? 100);

if (!Number.isInteger(maxIterations) || maxIterations < 1) {
  console.error("Usage: node scripts/generate-fixture.js [maxIterations]");
  process.exitCode = 1;
} else {
  console.log("Creating hard-rule-compatible assignments...");
  const baseModel = createModel(items, slots, rules);
  const startingAssignments = createCompatibleAssignments(baseModel);
  const startingModel = createModel(
    items,
    slots,
    rules,
    startingAssignments,
  );
  const startingEvaluation = evaluateModel(startingModel, true);
  const startingFullEvaluation = evaluateModel(startingModel);
  console.log(
    `Hard-rule creation complete. Hard penalty: ${startingEvaluation.hardPenalty}`,
  );
  console.log(
    `Starting soft penalty: ${startingFullEvaluation.softPenalty}`,
  );
  console.log(
    `Top soft penalties: ${formatTopSoftPenalties(
      startingFullEvaluation.softRulePenalties,
    )}`,
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
      maxIterations,
      (progress) => {
        const status = progress.improved ? "improved" : "stopped";
        console.log(
          `Soft iteration ${progress.iteration}: ` +
            `${status}; penalty ${progress.softPenalty}; ` +
            `improvement ${progress.improvement}; ` +
            `top rules ${formatTopSoftPenalties(
              progress.softRulePenalties,
            )}; candidates ${formatCandidateDiagnostics(
              progress.candidateDiagnostics,
            )}`,
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
    console.log(`Final hard penalty: ${finalEvaluation.hardPenalty}`);
    console.log(
      `Soft penalty: ${finalEvaluation.softPenalty}`,
    );
    console.log(
      `Soft violations: ${finalEvaluation.softViolations.length}`,
    );
    console.log(
      `Top soft penalties: ${formatTopSoftPenalties(
        finalEvaluation.softRulePenalties,
      )}`,
    );
  } catch (error) {
    console.log("Assignment generation failed");
    console.log(`Message: ${error.message}`);
    console.log(`Starting hard penalty: ${startingEvaluation.hardPenalty}`);
    console.log(`Final hard penalty: ${error.hardPenalty ?? "unavailable"}`);
  }
}

function formatTopSoftPenalties(rulePenalties) {
  return rulePenalties
    .filter((rulePenalty) => rulePenalty.weightedPenalty > 0)
    .sort((first, second) => second.weightedPenalty - first.weightedPenalty)
    .slice(0, 3)
    .map(
      (rulePenalty) =>
        `${rulePenalty.ruleId}=${rulePenalty.weightedPenalty.toFixed(2)}`,
    )
    .join(", ");
}

function formatCandidateDiagnostics(diagnostics) {
  const totals = new Map();

  for (const diagnostic of diagnostics) {
    const current = totals.get(diagnostic.ruleId) ?? {
      attempts: 0,
      hardRejected: 0,
      scored: 0,
      accepted: 0,
    };
    current.attempts += diagnostic.attempts;
    current.hardRejected += diagnostic.hardRejected;
    current.scored += diagnostic.scored;
    current.accepted += diagnostic.accepted;
    totals.set(diagnostic.ruleId, current);
  }

  return [...totals.entries()]
    .sort((first, second) => second[1].attempts - first[1].attempts)
    .slice(0, 3)
    .map(
      ([ruleId, stats]) =>
        `${ruleId}: attempted ${stats.attempts}, ` +
        `hard-rejected ${stats.hardRejected}, ` +
        `scored ${stats.scored}, accepted ${stats.accepted}`,
    )
    .join(" | ");
}
