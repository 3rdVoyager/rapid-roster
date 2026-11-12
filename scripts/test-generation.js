import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import items from "../tests/fixtures/items.json" with { type: "json" };
import slots from "../tests/fixtures/slots.json" with { type: "json" };
import rules from "../tests/fixtures/rules.json" with { type: "json" };

import { createModel } from "../src/lib/model.js";
import { createInitialAssignments } from "../src/lib/assignment.js";
import { improveHardAssignments } from "../src/lib/hard.js";
import { improveSoftAssignments } from "../src/lib/soft.js";
import { evaluateModel } from "../src/lib/evaluation.js";

const logLines = [];
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
  writeLog("Creating hard-rule-compatible assignments...");
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
  writeLog(
    `Compatible assignment creation complete in ${compatibleElapsed} ms.`,
  );
  writeLog(`Initial scoring complete in ${initialScoringElapsed} ms.`);
  writeLog(
    `Hard-rule creation complete. Hard penalty: ${startingEvaluation.hardPenalty}`,
  );
  writeLog(
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
    writeLog(
      `Hard-rule optimization complete in ${Math.round(
        performance.now() - hardStartedAt,
      )} ms. Hard penalty: ${hardEvaluation.hardPenalty}`,
    );

    writeLog("Optimizing soft rules...");
    const softStartedAt = performance.now();
    const softAssignments = improveSoftAssignments(
      hardModel,
      softLimit,
      (progress) => {
        writeLog(
          `Soft round ${progress.round}: ` +
            `rule ${progress.ruleId ?? "none"}; ` +
            `penalty ${progress.softPenalty}; ` +
            `improvement ${progress.improvement}`,
        );
      },
    );
    const finalModel = createModel(items, slots, rules, softAssignments);
    const finalEvaluation = evaluateModel(finalModel);

    writeLog(
      `Soft-rule optimization complete in ${Math.round(
        performance.now() - softStartedAt,
      )} ms.`,
    );
    writeLog(
      `Total generation time: ${Math.round(
        performance.now() - generationStartedAt,
      )} ms.`,
    );
    writeLog(`Final hard penalty: ${finalEvaluation.hardPenalty}`);
    writeLog(
      `Soft penalty: ${finalEvaluation.softPenalty}`,
    );
    writeLog(
      `Soft violations: ${finalEvaluation.softViolations.length}`,
    );
    logLines.push("Final assignments:");
    logLines.push(JSON.stringify(softAssignments, null, 2));
  } catch (error) {
    writeLog("Assignment generation failed");
    writeLog(`Message: ${error.message}`);
    writeLog(`Starting hard penalty: ${startingEvaluation.hardPenalty}`);
    writeLog(`Final hard penalty: ${error.hardPenalty ?? "unavailable"}`);
  }
}

if (logLines.length > 0) {
  const timestamp = new Date()
    .toISOString()
    .replace("T", "_")
    .replace(/\.\d{3}Z$/, "")
    .replaceAll(":", "-");
  const logDirectory = join(process.cwd(), "logs");
  const logPath = join(logDirectory, `generation-${timestamp}.txt`);
  mkdirSync(logDirectory, { recursive: true });
  const logContent = `${logLines.join("\n")}\n`;
  writeFileSync(logPath, logContent, "utf8");
  console.log(`Generation results written to ${logPath}`);
}

function writeLog(message) {
  const line = String(message);
  logLines.push(line);
  console.log(line);
}
