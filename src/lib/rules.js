import {
  equals,
  contains,
  greaterThan,
  lessThan,
  approximates,
} from "./operators.js";
import { min, max, sum, average } from "./math.js";

const operators = {
  equals,
  contains,
  greaterThan,
  lessThan,
  approximates,
};

export function evaluateRule(rule, model) {
  const sourceValue = resolvePath(rule.source, model);
  const targetValue = resolveValue(rule.target, model);

  const scores = [];
  if (Array.isArray(sourceValue) || Array.isArray(targetValue)) {
    scores.push(
      ...evaluateRecursiveRule(rule.operator, sourceValue, targetValue),
    );
  } else {
    scores.push(evaluateOperator(rule.operator, sourceValue, targetValue));
  }

  return {
    score: rule.enforcement === "hard" ? min(scores) : average(scores),
    enforcement: rule.enforcement,
  };
}

export function evaluateOperator(operator, sourceValue, targetValue) {
  const operation = operators[operator];
  if (!operation) {
    throw new Error(`Unknown operator: ${operator}`);
  }
  return operation(sourceValue, targetValue);
}

export function isValidRule(rule) {
  if (rule.enforcement !== "hard" && rule.enforcement !== "soft") {
    return false;
  }

  if (!rule.source || !rule.operator || !rule.target) {
    return false;
  }

  return true;
}

export function resolveValue(value, model) {
  if (typeof value === "string") {
    return resolvePath(value, model);
  }
  return value;
}

export function resolvePath(path, model) {
  const [collection, attribute, ...remainingPath] = path.split(".");

  if (remainingPath.length > 0) {
    throw new Error(`Unsupported path: ${path}`);
  }
  if (collection === "items") {
    return model.getItemAttribute(attribute);
  }
  if (collection === "slots") {
    return model.getSlotAttribute(attribute);
  }
  throw new Error(`Unknown collection: ${collection}`);
}

export function evaluateRecursiveRule(operator, sourceValue, targetValue) {
  const results = [];
  if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
    for (const item of sourceValue) {
      for (const target of targetValue) {
        results.push(evaluateOperator(operator, item, target));
      }
    }
  } else if (Array.isArray(sourceValue) && !Array.isArray(targetValue)) {
    for (const item of sourceValue) {
      results.push(evaluateOperator(operator, item, targetValue));
    }
  } else if (!Array.isArray(sourceValue) && Array.isArray(targetValue)) {
    for (const target of targetValue) {
      results.push(evaluateOperator(operator, sourceValue, target));
    }
  }
  return results;
}
