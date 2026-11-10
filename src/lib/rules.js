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
      const itemAttributeValue = item[itemAttribute];
      const slotAttributeValue = slot[slotAttribute];

      if (isEmptyMatchValue(itemAttributeValue)) {
        continue;
      }

      if (valuesMatch(itemAttributeValue, slotAttributeValue)) {
        score++;
      } else {
        violations.push({
          sourceId: item.id,
          targetId: slot.id,
          sourceValue: itemAttributeValue,
          targetValue: slotAttributeValue,
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
  const itemAttribute = inputs[0];

  const rankedItems = [];

  for (const item of model.items) {
    const itemValue = item[itemAttribute];

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
  const [slotAttribute, siblingAttribute] = inputs;

  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const item of model.items) {
    const siblingId = item[siblingAttribute];
    if (isEmptyMatchValue(siblingId)) {
      continue;
    }

    const sibling = model.items.find((candidate) => candidate.id === siblingId);

    if (!sibling) {
      continue;
    }

    const itemAssignedSlots = getAssignedSlots(model, item.id);
    const siblingAssignedSlots = getAssignedSlots(model, sibling.id);

    // An unassigned item cannot be compared yet, so this relationship is
    // non-applicable until both sides have an assignment.
    for (const itemSlot of itemAssignedSlots) {
      for (const siblingSlot of siblingAssignedSlots) {
        const itemSlotValue = itemSlot[slotAttribute];
        const siblingSlotValue = siblingSlot[slotAttribute];

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

// TODO: Score each item-array value separately instead of
// reducing the whole array comparison to one boolean result.
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
