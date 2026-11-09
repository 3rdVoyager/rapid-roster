import {
  getAssignedItems,
  getAssignedItemIds,
  getAssignedSlots,
  getAssignedSlotIds,
  getCoAssignedItems,
} from "./selectors.js";

const evaluators = {
  match: evaluateMatch,
  group: evaluateGroup,
  equalize: evaluateEqualize,
  limit: evaluateLimit,
  balance: evaluateBalance,
  distribute: evaluateDistribute,
  align: evaluateAlign,
};

export function evaluateRule(rule, model) {
  const evaluator = evaluators[rule.keyword];
  const result = evaluator(rule.inputs, model);
  const priority = rule.priority ?? 1;
  const percentage =
    result.repetitions === 0 ? 1 : result.score / result.repetitions;

  return {
    score: percentage * priority,
    percentage,
    repetitions: result.repetitions,
    violations: result.violations,
  };
}

export function evaluateMatch(inputs, model) {
  const [itemAttribute, slotAttribute] = inputs;
  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const item of model.items) {
    const assignedSlots = getAssignedSlots(model, item.id);

    for (const slot of assignedSlots) {
      const itemValue = item[itemAttribute];
      const slotValue = slot[slotAttribute];

      // Empty request fields mean that this comparison does not apply to
      // the item. They should not become false violations.
      if (isEmptyMatchValue(itemValue)) {
        continue;
      }

      // TODO: Score each item-array value separately instead of
      // reducing the whole array comparison to one boolean result.
      if (valuesMatch(itemValue, slotValue)) {
        score++;
      } else {
        violations.push({
          sourceId: item.id,
          targetId: slot.id,
          sourceValue: itemValue,
          targetValue: slotValue,
        });
      }
      repetitions++;
    }
  }

  return { score, repetitions, violations };
}

export function evaluateGroup(inputs, model) {
  const [itemAttribute1, itemAttribute2] = inputs;
  let satisfaction = 0;
  let repetitions = 0;
  const violations = [];

  for (const item of model.items) {
    const requestedValues = normalizeValues(item[itemAttribute2]);

    if (requestedValues.length === 0) {
      continue;
    }

    const coAssignedItems = getCoAssignedItems(model, item.id);

    for (const requestedValue of requestedValues) {
      const matches = coAssignedItems.some((coAssignedItem) =>
        valuesMatch(requestedValue, coAssignedItem[itemAttribute1]),
      );

      if (matches) {
        satisfaction++;
      } else {
        violations.push({
          sourceId: item.id,
          targetId: requestedValue,
          sourceValue: requestedValues,
          targetValue: coAssignedItems.map(
            (coAssignedItem) => coAssignedItem[itemAttribute1],
          ),
        });
      }

      repetitions++;
    }
  }

  return {
    score: satisfaction,
    repetitions,
    violations,
  };
}

function isEmptyMatchValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function normalizeValues(value) {
  if (isEmptyMatchValue(value)) {
    return [];
  }

  const normalizedValues = Array.isArray(value) ? value : [value];
  return normalizedValues.filter((entry) => !isEmptyMatchValue(entry));
}

export function evaluateEqualize(inputs, model) {
  const maximumDifference = inputs[0];
  const slots = model.slots;

  const slotCounts = slots.map((slot) => ({
    slot,
    itemCount: getAssignedItemIds(model, slot.id).length,
  }));

  if (slotCounts.length === 0) {
    return { score: 1, repetitions: 1, violations: [] };
  }

  const minimumItemCount = Math.min(
    ...slotCounts.map((slotCount) => slotCount.itemCount),
  );
  const maximumItemCount = Math.max(
    ...slotCounts.map((slotCount) => slotCount.itemCount),
  );
  const actualDifference = maximumItemCount - minimumItemCount;
  let score = 0;
  const violations = [];

  for (const slotCount of slotCounts) {
    const excess = Math.max(
      0,
      slotCount.itemCount - minimumItemCount - maximumDifference,
    );
    const recordScore = excess === 0 ? 1 : 1 / (1 + excess);
    score += recordScore;

    if (excess > 0) {
      violations.push({
        sourceId: slotCount.slot.id,
        actual: slotCount.itemCount,
        minimum: minimumItemCount,
        maximum: maximumItemCount,
        difference: actualDifference,
        maximumDifference,
        excess,
      });
    }
  }

  return {
    score,
    repetitions: slotCounts.length,
    violations,
  };
}

export function evaluateLimit(inputs, model) {
  const [limitType, limit] = inputs;

  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const slot of model.slots) {
    const itemCount = getAssignedItemIds(model, slot.id).length;

    let slotScore;
    if (limitType === "max") {
      slotScore = itemCount <= limit ? 1 : limit / itemCount;
    } else {
      slotScore = itemCount >= limit || limit === 0 ? 1 : itemCount / limit;
    }

    score += slotScore;
    repetitions++;
    if (slotScore < 1) {
      violations.push({
        sourceId: slot.id,
        actual: itemCount,
        type: limitType,
        limit,
        difference: limitType === "max" ? itemCount - limit : limit - itemCount,
      });
    }
  }

  return { score, repetitions, violations };
}

export function evaluateBalance(inputs, model) {
  const itemAttribute = inputs[0];

  const itemValues = model.items
    .map((item) => item[itemAttribute])
    .filter(
      (itemValue) =>
        typeof itemValue === "number" && Number.isFinite(itemValue),
    );

  if (itemValues.length === 0) {
    return { score: 1, repetitions: 1, violations: [] };
  }

  let totalItemValue = 0;
  for (const itemValue of itemValues) {
    totalItemValue += itemValue;
  }
  const overallAverage = totalItemValue / itemValues.length;
  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const slot of model.slots) {
    const assignedItems = getAssignedItems(model, slot.id);

    let slotAverage = 0;
    if (assignedItems.length > 0) {
      let slotValueSum = 0;
      let validItemValueCount = 0;
      for (const item of assignedItems) {
        const itemValue = item[itemAttribute];
        if (typeof itemValue !== "number" || !Number.isFinite(itemValue)) {
          continue;
        }
        slotValueSum += itemValue;
        validItemValueCount++;
      }
      if (validItemValueCount > 0) {
        slotAverage = slotValueSum / validItemValueCount;
      }
    }

    const difference = Math.abs(slotAverage - overallAverage);
    const slotScore = Math.max(0, 1 - difference / 100);
    score += slotScore;
    repetitions++;
    if (slotScore < 1) {
      violations.push({
        targetId: slot.id,
        actual: slotAverage,
        target: overallAverage,
        difference,
      });
    }
  }

  return { score, repetitions, violations };
}

export function evaluateDistribute(inputs, model) {
  const sourceCollection = inputs.source.collection;
  const targetCollection =
    typeof inputs.target === "string"
      ? inputs.target
      : inputs.target.collection;

  if (sourceCollection !== "items" || targetCollection !== "slots") {
    throw new Error(
      `Unsupported distribute collections: ${sourceCollection} -> ${targetCollection}`,
    );
  }

  const rankedItems = [];

  for (const item of model[sourceCollection]) {
    const itemValue = item[inputs.source.attribute];

    // Missing numeric values cannot be ranked, so they do not participate.
    if (typeof itemValue !== "number" || !Number.isFinite(itemValue)) {
      continue;
    }

    const assignedSlotIds = getAssignedSlotIds(model, item.id);
    if (assignedSlotIds.length > 0) {
      rankedItems.push({ item, itemValue, assignedSlotIds });
    }
  }

  rankedItems.sort((first, second) => second.itemValue - first.itemValue);

  // With fewer than two ranked items there is nothing to distribute.
  if (rankedItems.length < 2) {
    return { score: 1, repetitions: 1, violations: [] };
  }

  let score = 0;
  const violations = [];

  for (let index = 1; index < rankedItems.length; index++) {
    const previousItem = rankedItems[index - 1];
    const currentItem = rankedItems[index];
    const sharedSlotIds = previousItem.assignedSlotIds.filter((slotId) =>
      currentItem.assignedSlotIds.includes(slotId),
    );

    if (sharedSlotIds.length === 0) {
      score++;
    } else {
      violations.push({
        sourceId: previousItem.item.id,
        targetId: currentItem.item.id,
        sourceValue: previousItem.itemValue,
        targetValue: currentItem.itemValue,
        sharedSlotIds,
      });
    }
  }

  return {
    score,
    repetitions: rankedItems.length - 1,
    violations,
  };
}

export function evaluateAlign(inputs, model) {
  const sourceCollection = inputs.source.collection;
  const targetCollection = inputs.target.collection;

  if (
    sourceCollection !== "assignedSlots" ||
    targetCollection !== "siblingAssignedSlots"
  ) {
    throw new Error(
      `Unsupported align collections: ${sourceCollection} -> ${targetCollection}`,
    );
  }

  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const item of model.items) {
    if (isEmptyMatchValue(item.sibling)) {
      continue;
    }

    const sibling = model.items.find(
      (candidate) => candidate.id === item.sibling,
    );

    if (!sibling) {
      continue;
    }

    const itemAssignedSlots = getAssignedSlots(model, item.id);
    const siblingAssignedSlots = getAssignedSlots(model, sibling.id);

    // An unassigned item cannot be compared yet, so this relationship is
    // non-applicable until both sides have an assignment.
    for (const itemSlot of itemAssignedSlots) {
      for (const siblingSlot of siblingAssignedSlots) {
        const itemSlotValue = itemSlot[inputs.source.attribute];
        const siblingSlotValue = siblingSlot[inputs.target.attribute];

        repetitions++;

        if (valuesMatch(itemSlotValue, siblingSlotValue)) {
          score++;
        } else {
          violations.push({
            sourceId: itemSlot.id,
            targetId: siblingSlot.id,
            sourceValue: itemSlotValue,
            targetValue: siblingSlotValue,
          });
        }
      }
    }
  }

  return { score, repetitions, violations };
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
