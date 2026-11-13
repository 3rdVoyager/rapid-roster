export function parseCsv(csvText) {
  if (typeof csvText !== "string") {
    throw new TypeError("CSV input must be a string");
  }

  const rows = parseCsvRows(csvText.replace(/^\uFEFF/, ""));
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(toCamelCase);
  validateHeaders(headers);

  return rows.slice(1).map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [
        header,
        parseCellValue(row[index] ?? ""),
      ]),
    ),
  );
}

export function parseRulesCsv(csvText) {
  return parseCsv(csvText).map((record) => {
    const rule = { ...record };
    const inputEntries = Object.entries(record)
      .filter(([key]) => /^input\d+$/.test(key))
      .sort(([firstKey], [secondKey]) =>
        Number(firstKey.slice(5)) - Number(secondKey.slice(5)),
      );

    rule.inputs = inputEntries
      .map(([, value], index) =>
        rule.keyword === "limit" && index === 1 && value !== ""
          ? Number(value)
          : value,
      );
    while (rule.inputs.at(-1) === "") {
      rule.inputs.pop();
    }

    for (const [key] of inputEntries) {
      delete rule[key];
    }

    if (rule.priority === "") {
      delete rule.priority;
    } else if (rule.priority !== undefined) {
      rule.priority = Number(rule.priority);
    }

    return rule;
  });
}

function parseCellValue(value) {
  if (!value.includes(";")) {
    return value;
  }

  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

function toCamelCase(header) {
  const trimmedHeader = header.trim();
  if (!trimmedHeader) {
    return "";
  }

  if (!/[\s_-]/.test(trimmedHeader)) {
    return /^[A-Z0-9]+$/.test(trimmedHeader)
      ? trimmedHeader.toLowerCase()
      : trimmedHeader[0].toLowerCase() + trimmedHeader.slice(1);
  }

  const words = trimmedHeader
    .replace(/['’]/g, "")
    .split(/[\s_-]+/)
    .filter(Boolean);
  return words
    .map((word, index) => {
      const normalizedWord = word.toLowerCase();
      return index === 0
        ? normalizedWord
        : normalizedWord[0].toUpperCase() + normalizedWord.slice(1);
    })
    .join("");
}

function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index++) {
    const character = csvText[index];

    if (inQuotes) {
      if (character !== '"') {
        field += character;
        continue;
      }

      if (csvText[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        inQuotes = false;
      }
      continue;
    }

    if (character === '"') {
      if (field !== "") {
        throw new Error("Invalid CSV: quote found inside an unquoted field");
      }
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && csvText[index + 1] === "\n") {
        index++;
      }
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error("Invalid CSV: unterminated quoted field");
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function validateHeaders(headers) {
  if (headers.length === 0 || headers.some((header) => header === "")) {
    throw new Error("Invalid CSV: every column must have a header");
  }

  if (new Set(headers).size !== headers.length) {
    throw new Error("Invalid CSV: column headers must be unique");
  }
}
