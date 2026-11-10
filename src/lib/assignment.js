import { createModel } from "./model.js";
import { evaluateModel } from "./scoring.js";
import { getItemById } from "./selectors.js";

export function createRandomAssignments(model, random = Math.random) {
  const assignments = {};
  const slots = model.slots;

  if (slots.length === 0) {
    throw new Error("Cannot create an assignment without slots");
  }

  for (const slot of slots) {
    assignments[slot.id] = [];
  }

  const shuffledItems = shuffle([...model.items], random);

  for (let index = 0; index < shuffledItems.length; index++) {
    const slot = slots[index % slots.length];
    assignments[slot.id].push(shuffledItems[index].id);
  }
  return assignments;
}

export function createCompatibleAssignments(model) {
  const assignments = Object.fromEntries(
    model.slots.map((slot) => [slot.id, []]),
  );
  const hardMatchRules = model.rules.filter(
    (rule) => rule.enforcement === "hard" && rule.keyword === "match",
  );
  const hardLimitRules = model.rules.filter(
    (rule) => rule.enforcement === "hard" && rule.keyword === "limit",
  );
  const slotLimits = Object.fromEntries(
    model.slots.map((slot) => [
      slot.id,
      getSlotLimits(hardLimitRules, slot.id),
    ]),
  );

  const invalidLimitSlots = model.slots.filter(
    (slot) => slotLimits[slot.id].minimum > slotLimits[slot.id].maximum,
  );
  if (invalidLimitSlots.length > 0) {
    throw new Error(
      "Cannot create compatible assignments: minimum slot size exceeds " +
        "maximum for slots: " +
        invalidLimitSlots.map((slot) => slot.id).join(", "),
    );
  }

  const itemOptions = model.items.map((item) => ({
    item,
    compatibleSlots: model.slots.filter((slot) =>
      hardMatchRules.every((rule) => isItemCompatibleWithSlot(item, slot, rule)),
    ),
  }));
  const incompatibleItems = itemOptions.filter(
    ({ compatibleSlots }) => compatibleSlots.length === 0,
  );

  if (incompatibleItems.length > 0) {
    const error = new Error(
      "Could not create compatible assignments for items: " +
        incompatibleItems.map(({ item }) => item.id).join(", "),
    );
    error.incompatibleItemIds = incompatibleItems.map(({ item }) => item.id);
    throw error;
  }

  itemOptions.sort(
    (first, second) =>
      first.compatibleSlots.length - second.compatibleSlots.length,
  );

  const itemOptionsById = new Map(
    itemOptions.map((itemOption) => [itemOption.item.id, itemOption]),
  );

  for (const { item } of itemOptions) {
    const assigned = assignItemToSlot(
      item.id,
      itemOptionsById,
      assignments,
      slotLimits,
    );

    if (!assigned) {
      const error = new Error(
        `Could not create compatible assignments within slot limits for item: ${item.id}`,
      );
      error.incompatibleItemIds = [item.id];
      throw error;
    }

  }

  const underfilledSlotIds = model.slots
    .filter(
      (slot) =>
        assignments[slot.id].length < slotLimits[slot.id].minimum,
    )
    .map((slot) => slot.id);

  if (underfilledSlotIds.length > 0) {
    const error = new Error(
      "Could not satisfy minimum slot limits for slots: " +
        underfilledSlotIds.join(", "),
    );
    error.underfilledSlotIds = underfilledSlotIds;
    throw error;
  }

  return assignments;
}

function assignItemToSlot(
  itemId,
  itemOptionsById,
  assignments,
  slotLimits,
  visitedItems = new Set(),
  visitedSlots = new Set(),
) {
  if (visitedItems.has(itemId)) {
    return false;
  }
  visitedItems.add(itemId);

  const compatibleSlots = itemOptionsById.get(itemId).compatibleSlots
    .slice()
    .sort((first, second) =>
      compareSlotCapacity(
        first,
        second,
        assignments,
        slotLimits,
      ),
    );

  for (const slot of compatibleSlots) {
    if (visitedSlots.has(slot.id)) {
      continue;
    }
    visitedSlots.add(slot.id);

    const assignedItemIds = assignments[slot.id];
    if (assignedItemIds.length < slotLimits[slot.id].maximum) {
      assignedItemIds.push(itemId);
      return true;
    }

    for (const displacedItemId of [...assignedItemIds]) {
      const displacedIndex = assignedItemIds.indexOf(displacedItemId);
      assignedItemIds.splice(displacedIndex, 1);

      const displacedItemAssigned = assignItemToSlot(
        displacedItemId,
        itemOptionsById,
        assignments,
        slotLimits,
        visitedItems,
        visitedSlots,
      );

      if (displacedItemAssigned) {
        assignedItemIds.push(itemId);
        return true;
      }

      assignedItemIds.splice(displacedIndex, 0, displacedItemId);
    }
  }

  return false;
}

function compareSlotCapacity(
  firstSlot,
  secondSlot,
  assignments,
  slotLimits,
) {
  const firstCount = assignments[firstSlot.id].length;
  const secondCount = assignments[secondSlot.id].length;
  const firstBelowMinimum =
    firstCount < slotLimits[firstSlot.id].minimum;
  const secondBelowMinimum =
    secondCount < slotLimits[secondSlot.id].minimum;

  if (firstBelowMinimum !== secondBelowMinimum) {
    return firstBelowMinimum ? -1 : 1;
  }

  return firstCount - secondCount;
}

function getSlotLimits(limitRules, slotId) {
  return limitRules.reduce(
    (limits, rule) => {
      const [limitType, limit, targetSlotTargets] = rule.inputs;
      const appliesToSlot =
        targetSlotTargets === "all" ||
        targetSlotTargets.some(
          (targetSlotId) => String(targetSlotId) === String(slotId),
        );

      if (!appliesToSlot) {
        return limits;
      }

      if (limitType === "min") {
        limits.minimum = Math.max(limits.minimum, limit);
      } else {
        limits.maximum = Math.min(limits.maximum, limit);
      }

      return limits;
    },
    {
      minimum: 0,
      maximum: Number.POSITIVE_INFINITY,
    },
  );
}

export function improveAssignments(model, maxIterations = 100) {
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new Error("Max iterations must be a positive integer");
  }

  let assignments = cloneAssignments(model.assignments.slotAssignments);
  let lastEvaluation;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const currentModel = createModel(
      model.items,
      model.slots,
      model.rules,
      assignments,
    );
    const currentEvaluation = evaluateModel(currentModel, true);
    lastEvaluation = currentEvaluation;

    if (currentEvaluation.hardPenalty === 0) {
      return assignments;
    }

    const candidate = generateCandidate(currentModel, currentEvaluation);

    if (candidate) {
      assignments = candidate;
    } else {
      break;
    }
  }

  const violationCounts = countViolationsByRule(lastEvaluation);
  const error = new Error(
    `Could not create legal assignments after ${maxIterations} iterations. ` +
      `Hard penalty: ${lastEvaluation.hardPenalty}. ` +
      `Remaining violations: ${violationCounts}`,
  );
  error.hardPenalty = lastEvaluation.hardPenalty;
  error.hardViolations = lastEvaluation.hardViolations;
  throw error;
}

function countViolationsByRule(evaluation) {
  const counts = {};

  for (const violation of evaluation.hardViolations) {
    counts[violation.ruleId] = (counts[violation.ruleId] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([ruleId, count]) => `${ruleId} (${count})`)
    .join(", ");
}

function isItemCompatibleWithSlot(item, slot, rule) {
  const itemValue = item[rule.inputs[0]];

  // Empty item fields are optional for match rules and do not restrict
  // the item's compatible slots.
  if (isEmptyValue(itemValue)) {
    return true;
  }

  return valuesMatch(itemValue, slot[rule.inputs[1]]);
}

function isEmptyValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function generateCandidate(model, evaluation) {
  for (const violation of evaluation.hardViolations) {
    const rule = getRuleById(model, violation.ruleId);
    if (rule?.keyword === "match") {
      return generateMatchCandidate(model, rule, violation, evaluation);
    }
  }
  return null;
}

function generateMatchCandidate(model, rule, violation, evaluation) {
  const itemAttribute = rule.inputs[0];
  const slotAttribute = rule.inputs[1];
  const item = getItemById(model, violation.sourceId);
  const itemAttributeValue = item[itemAttribute];
  const assignments = model.assignments.slotAssignments;

  const targetSlots = model.slots.filter((slot) =>
    valuesMatch(itemAttributeValue, slot[slotAttribute]),
  );

  for (const targetSlot of targetSlots) {
    if (targetSlot.id === violation.targetId) {
      continue;
    }

    const targetItemIds = assignments[targetSlot.id] ?? [];
    if (targetItemIds.length === 0) {
      const candidate = moveAssignment(
        assignments,
        violation.sourceId,
        violation.targetId,
        targetSlot.id,
      );
      const candidateScore = evaluateModel(
        createModel(model.items, model.slots, model.rules, candidate),
        true,
      );
      if (isBetterScore(candidateScore, evaluation)) {
        return candidate;
      }
    }

    for (const targetItemId of targetItemIds) {
      const candidate = swapAssignments(
        assignments,
        violation.targetId,
        violation.sourceId,
        targetSlot.id,
        targetItemId,
      );
      const candidateScore = evaluateModel(
        createModel(model.items, model.slots, model.rules, candidate),
        true,
      );
      if (isBetterScore(candidateScore, evaluation)) {
        return candidate;
      }
    }
  }

  return null;
}

function getRuleById(model, id) {
  return model.rules.find((rule) => rule.id === id);
}

function isBetterScore(candidateScore, currentScore) {
  if (
    candidateScore.hardPenalty !== currentScore.hardPenalty
  ) {
    return (
      candidateScore.hardPenalty < currentScore.hardPenalty
    );
  }

  return false;
}

function valuesMatch(sourceValue, targetValue) {
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

export function addAssignment(assignments, slotId, itemId) {
  const nextAssignments = cloneAssignments(assignments);
  const itemIds = nextAssignments[slotId] ?? [];

  if (!itemIds.includes(itemId)) {
    itemIds.push(itemId);
  }
  nextAssignments[slotId] = itemIds;

  return nextAssignments;
}

export function removeAssignment(assignments, slotId, itemId) {
  const nextAssignments = cloneAssignments(assignments);
  const itemIds = nextAssignments[slotId] ?? [];

  nextAssignments[slotId] = itemIds.filter(
    (assignedItemId) => assignedItemId !== itemId,
  );

  return nextAssignments;
}

export function moveAssignment(assignments, itemId, fromSlotId, toSlotId) {
  if (fromSlotId === toSlotId) {
    throw new Error("Move requires different slots");
  }

  if (!(assignments[fromSlotId] ?? []).includes(itemId)) {
    throw new Error(`Item is not assigned to slot: ${itemId}, ${fromSlotId}`);
  }

  return addAssignment(
    removeAssignment(assignments, fromSlotId, itemId),
    toSlotId,
    itemId,
  );
}

export function swapAssignments(
  assignments,
  firstSlotId,
  firstItemId,
  secondSlotId,
  secondItemId,
) {
  if (firstSlotId === secondSlotId || firstItemId === secondItemId) {
    throw new Error("Swap requires two different assignments");
  }

  if (
    !(assignments[firstSlotId] ?? []).includes(firstItemId) ||
    !(assignments[secondSlotId] ?? []).includes(secondItemId)
  ) {
    throw new Error("Cannot swap an unassigned item");
  }

  const nextAssignments = cloneAssignments(assignments);
  nextAssignments[firstSlotId] = nextAssignments[firstSlotId].map((itemId) =>
    itemId === firstItemId ? secondItemId : itemId,
  );
  nextAssignments[secondSlotId] = nextAssignments[secondSlotId].map((itemId) =>
    itemId === secondItemId ? firstItemId : itemId,
  );

  return nextAssignments;
}

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function cloneAssignments(assignments) {
  return Object.fromEntries(
    Object.entries(assignments).map(([slotId, itemIds]) => [
      slotId,
      [...itemIds],
    ]),
  );
}
