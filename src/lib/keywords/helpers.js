import {
  getAssignedItems,
  getAssignedSlotIds,
  getItemById,
} from "../selectors.js";

export function isEmptyValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function normalizeValues(value) {
  if (isEmptyValue(value)) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  return values.filter((entry) => !isEmptyValue(entry));
}

export function valuesMatch(sourceValue, targetValue) {
  if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
    return sourceValue.some((value) => targetValue.includes(value));
  }

  if (Array.isArray(sourceValue)) {
    return sourceValue.includes(targetValue);
  }

  if (Array.isArray(targetValue)) {
    return targetValue.includes(sourceValue);
  }

  return sourceValue === targetValue;
}

export function isNumericValue(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function getItemsInSlot(model, slotId) {
  const itemIds = model.assignments.slotAssignments[slotId] ?? [];
  return itemIds.map((itemId) => getItemById(model, itemId)).filter(Boolean);
}

export function getNumericSlotAverage(model, slotId, itemAttribute) {
  const numericValues = getItemsInSlot(model, slotId)
    .map((item) => item[itemAttribute])
    .filter(isNumericValue);

  if (numericValues.length === 0) {
    return 0;
  }

  return (
    numericValues.reduce((total, value) => total + value, 0) /
    numericValues.length
  );
}

export function getBalanceSlotScore(model, slotId, itemAttribute) {
  const numericValues = getItemsInSlot(model, slotId)
    .map((item) => item[itemAttribute])
    .filter(isNumericValue);
  const allValues = model.items
    .map((item) => item[itemAttribute])
    .filter(isNumericValue);

  if (allValues.length === 0) {
    return 1;
  }

  const overallAverage =
    allValues.reduce((total, value) => total + value, 0) / allValues.length;
  const slotAverage = getNumericSlotAverage(model, slotId, itemAttribute);
  return Math.max(0, 1 - Math.abs(slotAverage - overallAverage) / 100);
}

export function createRulePenalty(rule, percentage, score, repetitions) {
  const priority = rule.priority ?? 1;
  const penalty = 1 - percentage;

  return {
    ruleId: rule.id,
    name: rule.name,
    priority,
    percentage,
    score,
    repetitions,
    penalty,
    weightedPenalty: penalty * priority,
    violationCount: 0,
  };
}

export function canSwapWithoutBreakingHardMatches(
  hardCompatibilityIndex,
  firstItemId,
  firstSlotId,
  secondItemId,
  secondSlotId,
) {
  return (
    hardCompatibilityIndex.get(firstItemId)?.has(secondSlotId) &&
    hardCompatibilityIndex.get(secondItemId)?.has(firstSlotId)
  );
}

export function isItemCompatibleWithSlot(item, slot, rule) {
  const itemValue = item[rule.inputs[0]];
  if (isEmptyValue(itemValue)) {
    return true;
  }

  return valuesMatch(itemValue, slot[rule.inputs[1]]);
}

export function getAssignedSlotIdsForItem(model, itemId) {
  return getAssignedSlotIds(model, itemId);
}

export function getAssignedItemsForSlot(model, slotId) {
  return getAssignedItems(model, slotId);
}
