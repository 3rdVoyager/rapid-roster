import {
  getAssignedSlotIds,
  getCoAssignedItems,
  getItemById,
} from "../selectors.js";
import { swapAssignments } from "../assignment.js";
import {
  canSwapWithoutBreakingHardMatches,
  createRulePenalty,
  normalizeValues,
  valuesMatch,
} from "./helpers.js";

export const config = {
  keyword: "group",
  inputValidators: ["itemAttribute", "itemAttribute"],
};

export function evaluate(inputs, model) {
  const [itemAttribute, requestAttribute] = inputs;
  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const item of model.items) {
    const requestedValues = normalizeValues(item[requestAttribute]);
    if (requestedValues.length === 0) {
      continue;
    }

    const coAssignedItems = getCoAssignedItems(model, item.id);
    for (const requestedValue of requestedValues) {
      const matches = coAssignedItems.some((coAssignedItem) =>
        valuesMatch(requestedValue, coAssignedItem[itemAttribute]),
      );

      if (matches) {
        score++;
      } else {
        violations.push({
          sourceId: item.id,
          targetId: requestedValue,
          sourceValue: requestedValues,
          targetValue: coAssignedItems.map(
            (coAssignedItem) => coAssignedItem[itemAttribute],
          ),
        });
      }
      repetitions++;
    }
  }

  return { score, repetitions, violations };
}

export function isAffected(rule, model, swap) {
  const requestAttribute = rule.inputs[1];
  const affectedItemIds = [
    swap.firstItemId,
    swap.secondItemId,
    ...(model.assignments.slotAssignments[swap.firstSlotId] ?? []),
    ...(model.assignments.slotAssignments[swap.secondSlotId] ?? []),
  ];
  return affectedItemIds.some((itemId) => {
    const item = getItemById(model, itemId);
    return normalizeValues(item?.[requestAttribute]).length > 0;
  });
}

export function evaluateSwap(rule, model, currentPenalty, candidateModel, swap) {
  const [itemAttribute, requestAttribute] = rule.inputs;
  const affectedItemIds = new Set([
    swap.firstItemId,
    swap.secondItemId,
    ...(model.assignments.slotAssignments[swap.firstSlotId] ?? []),
    ...(model.assignments.slotAssignments[swap.secondSlotId] ?? []),
    ...(candidateModel.assignments.slotAssignments[swap.firstSlotId] ?? []),
    ...(candidateModel.assignments.slotAssignments[swap.secondSlotId] ?? []),
  ]);
  let score = currentPenalty.score;

  for (const itemId of affectedItemIds) {
    const item = getItemById(model, itemId);
    if (normalizeValues(item?.[requestAttribute]).length === 0) {
      continue;
    }
    score -= getItemScore(model, itemId, itemAttribute, requestAttribute);
    score += getItemScore(
      candidateModel,
      itemId,
      itemAttribute,
      requestAttribute,
    );
  }

  const percentage =
    currentPenalty.repetitions === 0
      ? 1
      : score / currentPenalty.repetitions;
  return createRulePenalty(
    rule,
    percentage,
    score,
    currentPenalty.repetitions,
  );
}

function getItemScore(model, itemId, itemAttribute, requestAttribute) {
  const item = getItemById(model, itemId);
  const requestedValues = normalizeValues(item?.[requestAttribute]);
  if (!item || requestedValues.length === 0) {
    return 0;
  }

  const coAssignedItems = getCoAssignedItems(model, itemId);
  return requestedValues.reduce(
    (score, requestedValue) =>
      score +
      (coAssignedItems.some((coAssignedItem) =>
        valuesMatch(requestedValue, coAssignedItem[itemAttribute]),
      )
        ? 1
        : 0),
    0,
  );
}

export function generateCandidate({
  model,
  rule,
  violation,
  isBetterCandidate,
  hardCompatibilityIndex,
  diagnostic,
}) {
  const [itemAttribute] = rule.inputs;
  const sourceItemId = violation.sourceId;
  const requestedValue = violation.targetId;
  const assignments = model.assignments.slotAssignments;
  const sourceSlotIds = getAssignedSlotIds(model, sourceItemId);
  const targetItems = model.items.filter(
    (item) =>
      item.id !== sourceItemId &&
      valuesMatch(requestedValue, item[itemAttribute]),
  );

  for (const targetItem of targetItems) {
    for (const sourceSlotId of sourceSlotIds) {
      for (const targetSlotId of getAssignedSlotIds(model, targetItem.id)) {
        if (targetSlotId === sourceSlotId) {
          continue;
        }
        if (
          !canSwapWithoutBreakingHardMatches(
            hardCompatibilityIndex,
            sourceItemId,
            sourceSlotId,
            targetItem.id,
            targetSlotId,
          )
        ) {
          diagnostic.hardRejected++;
          continue;
        }

        const candidate = swapAssignments(
          assignments,
          sourceSlotId,
          sourceItemId,
          targetSlotId,
          targetItem.id,
        );
        if (
          isBetterCandidate(candidate, {
            firstItemId: sourceItemId,
            firstSlotId: sourceSlotId,
            secondItemId: targetItem.id,
            secondSlotId: targetSlotId,
          })
        ) {
          return candidate;
        }
      }
    }
  }

  return null;
}
