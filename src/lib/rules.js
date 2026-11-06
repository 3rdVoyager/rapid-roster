import {
  getAssignedItems,
  getAssignedSlots,
  getCoAssignedItems,
  getCoAssignedSlots,
} from "./selectors.js";

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

  return {
    score: (result.score / result.repetitions) * rule.priority,
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

  for (const i of model[sourceCollection]) {
    let assignments = [];
    if (sourceCollection === "items") {
      if (targetCollection === "slots") {
        assignments = getAssignedSlots(model, i.id);
      } else if (targetCollection === "items") {
        assignments = getCoAssignedItems(model, i.id);
      }
    } else if (sourceCollection === "slots") {
      if (targetCollection === "slots") {
        assignments = getCoAssignedSlots(model, i.id);
      } else if (targetCollection === "items") {
        assignments = getAssignedItems(model, i.id);
      }
    }

    for (const j of assignments) {
      const sourceValue = i[inputs.source.attribute];
      const targetValue = j[inputs.target.attribute];
      let matches;

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
export function evaluateBalance(inputs, model) { }
export function evaluateDistribute(inputs, model) { }