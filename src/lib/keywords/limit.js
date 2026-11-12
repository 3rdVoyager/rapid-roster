import { getAssignedItemIds } from "../selectors.js";

export const config = {
  keyword: "limit",
  inputValidators: ["limitType", "nonNegativeInteger", "slotTargets"],
};

export function evaluate(inputs, model) {
  const [limitType, limit, slotTargets] = inputs;
  const slots =
    slotTargets === "all"
      ? model.slots
      : model.slots.filter((slot) =>
          slotTargets.some(
            (targetSlotId) => String(targetSlotId) === String(slot.id),
          ),
        );
  let score = 0;
  let repetitions = 0;
  const violations = [];

  for (const slot of slots) {
    const itemCount = getAssignedItemIds(model, slot.id).length;
    const slotScore =
      limitType === "max"
        ? itemCount <= limit
          ? 1
          : limit / itemCount
        : itemCount >= limit || limit === 0
          ? 1
          : itemCount / limit;

    score += slotScore;
    repetitions++;
    if (slotScore < 1) {
      violations.push({
        sourceId: slot.id,
        actual: itemCount,
        type: limitType,
        limit,
        difference:
          limitType === "max" ? itemCount - limit : limit - itemCount,
      });
    }
  }

  return { score, repetitions, violations };
}

export function isAffected() {
  return false;
}

export function generateCandidate() {
  return null;
}
