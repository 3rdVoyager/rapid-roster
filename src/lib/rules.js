import {
  equals,
  contains,
  greaterThan,
  lessThan,
  approximates,
} from "./operators.js";
import { min, max, sum, average } from "./math.js";
import { getAttribute } from "./selectors.js";

export function evaluateRule(rule, model) {
  let result = {
    satisfied: false,
    score: 0,
    enforcement: rule.enforcement,
  };

  const sourceValue = resolvePath(rule.source, model);
  const targetValue = resolvePath(rule.target, model);
  return result;
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
