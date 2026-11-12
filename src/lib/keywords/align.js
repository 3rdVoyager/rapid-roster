import { getAssignedSlotIds, getItemById } from "../selectors.js";
import { swapAssignments } from "../assignment.js";
import {
  canSwapWithoutBreakingHardMatches,
  createRulePenalty,
  valuesMatch,
} from "./helpers.js";

export const config = {
  keyword: "align",
  inputValidators: ["slotAttribute", "itemAttribute"],
};

export function evaluate(inputs, model) {
  const [slotAttribute, siblingAttribute] = inputs;
  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const item of model.items) {
    const siblingId = item[siblingAttribute];
    if (siblingId === undefined || siblingId === null || siblingId === "") {
      continue;
    }
    const sibling = getItemById(model, siblingId);
    if (!sibling) {
      continue;
    }

    const itemAssignedSlots = model.slots.filter((slot) =>
      (model.assignments.itemAssignments[item.id] ?? []).includes(slot.id),
    );
    const siblingAssignedSlots = model.slots.filter((slot) =>
      (model.assignments.itemAssignments[sibling.id] ?? []).includes(slot.id),
    );

    for (const itemSlot of itemAssignedSlots) {
      for (const siblingSlot of siblingAssignedSlots) {
        repetitions++;
        if (valuesMatch(itemSlot[slotAttribute], siblingSlot[slotAttribute])) {
          score++;
        } else {
          violations.push({
            sourceId: itemSlot.id,
            targetId: siblingSlot.id,
            sourceValue: itemSlot[slotAttribute],
            targetValue: siblingSlot[slotAttribute],
          });
        }
      }
    }
  }

  return { score, repetitions, violations };
}

export function isAffected(rule, model, swap) {
  const siblingAttribute = rule.inputs[1];
  return model.items.some(
    (item) =>
      item.id === swap.firstItemId ||
      item.id === swap.secondItemId ||
      item[siblingAttribute] === swap.firstItemId ||
      item[siblingAttribute] === swap.secondItemId,
  );
}

export function evaluateSwap(rule, model, currentPenalty, candidateModel, swap) {
  const affectedItemIds = getAffectedItemIds(model, rule, swap);
  let score = currentPenalty.score;
  let repetitions = currentPenalty.repetitions;

  for (const itemId of affectedItemIds) {
    const currentStats = getItemStats(model, rule, itemId);
    const candidateStats = getItemStats(candidateModel, rule, itemId);
    score += candidateStats.score - currentStats.score;
    repetitions += candidateStats.repetitions - currentStats.repetitions;
  }

  return createRulePenalty(
    rule,
    repetitions === 0 ? 1 : score / repetitions,
    score,
    repetitions,
  );
}

function getAffectedItemIds(model, rule, swap) {
  const siblingAttribute = rule.inputs[1];
  return new Set(
    model.items
      .filter(
        (item) =>
          item.id === swap.firstItemId ||
          item.id === swap.secondItemId ||
          item[siblingAttribute] === swap.firstItemId ||
          item[siblingAttribute] === swap.secondItemId,
      )
      .map((item) => item.id),
  );
}

function getItemStats(model, rule, itemId) {
  const [slotAttribute, siblingAttribute] = rule.inputs;
  const item = getItemById(model, itemId);
  const sibling = item ? getItemById(model, item[siblingAttribute]) : null;
  if (!item || !sibling) {
    return { score: 0, repetitions: 0 };
  }

  const itemSlotIds = getAssignedSlotIds(model, itemId);
  const siblingSlotIds = getAssignedSlotIds(model, sibling.id);
  let score = 0;
  let repetitions = 0;
  for (const itemSlotId of itemSlotIds) {
    const itemSlot = model.slots.find((slot) => slot.id === itemSlotId);
    for (const siblingSlotId of siblingSlotIds) {
      const siblingSlot = model.slots.find(
        (slot) => slot.id === siblingSlotId,
      );
      repetitions++;
      if (valuesMatch(itemSlot?.[slotAttribute], siblingSlot?.[slotAttribute])) {
        score++;
      }
    }
  }
  return { score, repetitions };
}

export function generateCandidate({
  model,
  rule,
  violation,
  isBetterCandidate,
  hardCompatibilityIndex,
  diagnostic,
}) {
  const firstSlotId = violation.sourceId;
  const secondSlotId = violation.targetId;
  if (firstSlotId === secondSlotId) {
    return null;
  }

  const assignments = model.assignments.slotAssignments;
  const candidatePairs = [];
  for (const firstItemId of assignments[firstSlotId] ?? []) {
    for (const secondItemId of assignments[secondSlotId] ?? []) {
      candidatePairs.push({
        firstItemId,
        secondItemId,
        alignmentScore:
          getAlignmentScore(model, rule, firstItemId, secondSlotId) +
          getAlignmentScore(model, rule, secondItemId, firstSlotId),
      });
    }
  }
  candidatePairs.sort(
    (first, second) => second.alignmentScore - first.alignmentScore,
  );

  for (const { firstItemId, secondItemId } of candidatePairs) {
    if (
      !canSwapWithoutBreakingHardMatches(
        hardCompatibilityIndex,
        firstItemId,
        firstSlotId,
        secondItemId,
        secondSlotId,
      )
    ) {
      diagnostic.hardRejected++;
      continue;
    }
    const candidate = swapAssignments(
      assignments,
      firstSlotId,
      firstItemId,
      secondSlotId,
      secondItemId,
    );
    if (
      isBetterCandidate(candidate, {
        firstItemId,
        firstSlotId,
        secondItemId,
        secondSlotId,
      })
    ) {
      return candidate;
    }
  }

  return null;
}

function getAlignmentScore(model, rule, itemId, destinationSlotId) {
  const item = getItemById(model, itemId);
  const sibling = item ? getItemById(model, item[rule.inputs[1]]) : null;
  const destinationSlot = model.slots.find(
    (slot) => slot.id === destinationSlotId,
  );
  if (!sibling || !destinationSlot) {
    return 0;
  }

  return getAssignedSlotIds(model, sibling.id).filter((slotId) => {
    const siblingSlot = model.slots.find((slot) => slot.id === slotId);
    return siblingSlot?.[rule.inputs[0]] === destinationSlot[rule.inputs[0]];
  }).length;
}
