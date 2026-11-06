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
    score: (result.score / repetitions) * rule.priority,
    percentage: result.score / repetitions,
    repetitions: result.repetitions,
    violations: result.violations,
  };
}

export function isValidRule(rule) {
  if (rule.enforcement !== "hard" && rule.enforcement !== "soft") {
    throw new Error(`Unknown enforcement ${rule.enforcement}`);
  }

  if (!rule.inputs.source || rule.inputs.target || !rule.keyword) {
    throw new Error(`Unknown rule setup`);
  }

  if (!evaluators[rule.keyword]) {
    throw new Error(`Unknown keyword: ${keyword}`);
  }
}

export function evaluateMatch(inputs, model) {
  let score = 0;
  let repetitions = 0;
  let violations = 0;
  for (const i of model[inputs.source.collection]) {
    let assignments = null;
    if (inputs.source.collection === "items") {
      if (inputs.target.collection === "slots") {
        assignments = getAssignedSlots(model, i.id);
      } else if (inputs.target.collection === "items") {
        assignments = getCoAssignedItems(model, i.id);
      }
    } else if (inputs.source.collection === "slots") {
      if (inputs.target.collection === "slots") {
        assignments = getCoAssignedSlots(model, i.id);
      } else if (inputs.target.collection === "items") {
        assignments = getAssignedItems(model, i.id);
      }
    }

    for (const j of assignments) {
      if (j[inputs.target.attribute] === i[inputs.source.attribute]) {
        score++;
      } else {
        violations++;
      }
      repetitions++;
    }
  }

  return { score, repetitions, violations };
}
