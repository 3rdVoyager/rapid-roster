/** @type {import("./types").ProjectData} */
export const data = {
  items: [],
  slots: [],
  rules: [],
};

const STORAGE_KEY = "rapid-roster-project";

export const $ = (selector) => document.querySelector(selector);

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

export function formatValue(value) {
  return Array.isArray(value) ? value.join("; ") : value ?? "";
}

export function humanize(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function setMessage(message, isError = false) {
  const element = $("#app-message");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

export function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    setMessage(`Could not save project locally: ${error.message}`, true);
  }
}

export function restoreData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const restored = JSON.parse(saved);
    if (
      !restored ||
      !Array.isArray(restored.items) ||
      !Array.isArray(restored.slots) ||
      !Array.isArray(restored.rules)
    ) {
      throw new Error("Saved project must contain items, slots, and rules arrays.");
    }
    data.items = restored.items;
    data.slots = restored.slots;
    data.rules = restored.rules;
  } catch (error) {
    setMessage(`Could not restore saved project: ${error.message}`, true);
  }
}

export function getHeaders(records) {
  return [...new Set(records.flatMap((record) => Object.keys(record)))];
}

export function normalizeNumericRuleAttributes(items, rules) {
  const numericAttributes = new Set(
    rules
      .filter((rule) => ["balance", "distribute"].includes(rule.keyword))
      .map((rule) => rule.inputs?.[0])
      .filter(Boolean),
  );
  if (numericAttributes.size === 0) return items;

  return items.map((item) => {
    const normalized = { ...item };
    for (const attribute of numericAttributes) {
      const value = normalized[attribute];
      if (
        typeof value === "string" &&
        value.trim() !== "" &&
        Number.isFinite(Number(value))
      ) {
        normalized[attribute] = Number(value);
      }
    }
    return normalized;
  });
}

restoreData();
