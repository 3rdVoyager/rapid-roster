import {
  getAssignedItems,
  getAssignedSlots,
  getCoAssignedItems,
  getCoAssignedSlots,
} from "./selectors.js";
import { average } from "./math.js";
import { approximates } from "./operators.js";

const evaluators = {
  match: evaluateMatch,
  limit: evaluateLimit,
  balance: evaluateBalance,
  distribute: evaluateDistribute,
};

export function evaluateRule(rule, model) {
  try {
    isValidRule(rule);
  } catch (error) {
    return error;
  }
  const evaluator = evaluators[rule.keyword];
  const result = evaluator(rule.inputs, model);
  const priority = rule.priority ?? 1;

  return {
    score: (result.score / result.repetitions) * priority,
    percentage: result.score / result.repetitions,
    repetitions: result.repetitions,
    violations: result.violations,
  };
}

export function isValidRule(rule) {
  if (rule.enforcement !== "hard" && rule.enforcement !== "soft") {
    throw new Error(`Unknown enforcement ${rule.enforcement}`);
  }

  if (!rule.inputs.source || !rule.inputs.target || !rule.keyword) {
    throw new Error(`Unknown rule setup`);
  }

  if (!evaluators[rule.keyword]) {
    throw new Error(`Unknown keyword: ${rule.keyword}`);
  }
}

export function evaluateMatch(inputs, model) {
  let score = 0;
  let repetitions = 0;
  let violations = 0;
  const sourceCollection = inputs.source.collection;
  const targetCollection = inputs.target.collection;

  if (
    !["items", "slots"].includes(sourceCollection) ||
    !["items", "slots"].includes(targetCollection)
  ) {
    throw new Error(
      `Unsupported match collections: ${sourceCollection} -> ${targetCollection}`,
    );
  }

  for (const sourceRecord of model[sourceCollection]) {
    let relatedRecords = [];
    if (sourceCollection === "items") {
      if (targetCollection === "slots") {
        relatedRecords = getAssignedSlots(model, sourceRecord.id);
      } else if (targetCollection === "items") {
        relatedRecords = getCoAssignedItems(model, sourceRecord.id);
      }
    } else if (sourceCollection === "slots") {
      if (targetCollection === "slots") {
        relatedRecords = getCoAssignedSlots(model, sourceRecord.id);
      } else if (targetCollection === "items") {
        relatedRecords = getAssignedItems(model, sourceRecord.id);
      }
    }

    for (const targetRecord of relatedRecords) {
      const sourceValue = sourceRecord[inputs.source.attribute];
      const targetValue = targetRecord[inputs.target.attribute];
      let matches;

      // TODO: Score each source-array value separately instead of
      // reducing the whole array comparison to one boolean result.
      if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        matches = sourceValue.some((value) => targetValue.includes(value));
      } else if (Array.isArray(sourceValue)) {
        matches = sourceValue.includes(targetValue);
      } else if (Array.isArray(targetValue)) {
        matches = targetValue.includes(sourceValue);
      } else {
        matches = sourceValue === targetValue;
      }

      if (matches) {
        score++;
      } else {
        violations++;
      }
      repetitions++;
    }
  }

  return { score, repetitions, violations };
}

export function evaluateLimit(inputs, model) { }

export function evaluateBalance(inputs, model) {
  const sourceCollection = inputs.source.collection;
  const targetCollection =
    typeof inputs.target === "string"
      ? inputs.target
      : inputs.target.collection;

  if (
    !["items", "slots"].includes(sourceCollection) ||
    !["items", "slots"].includes(targetCollection) ||
    sourceCollection === targetCollection
  ) {
    throw new Error(
      `Unsupported balance collections: ${sourceCollection} -> ${targetCollection}`,
    );
  }

  const values = model[sourceCollection].map(
    (record) => record[inputs.source.attribute],
  );
  const overallAverage = average(values);
  let score = 0;
  let repetitions = 0;
  let violations = 0;

  for (const target of model[targetCollection]) {
    let assignedSourceRecords;
    if (sourceCollection === "items" && targetCollection === "slots") {
      assignedSourceRecords = getAssignedItems(model, target.id);
    } else {
      assignedSourceRecords = getAssignedSlots(model, target.id);
    }

    const groupAverage =
      assignedSourceRecords.length === 0
        ? 0
        : average(
            assignedSourceRecords.map(
              (record) => record[inputs.source.attribute],
            ),
          );
    const groupScore = approximates(groupAverage, overallAverage);
    score += groupScore;
    repetitions++;
    if (groupScore < 1) {
      violations++;
    }
  }

  return { score, repetitions, violations };
}
export function evaluateDistribute(inputs, model) { }