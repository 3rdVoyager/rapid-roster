export function parseCsv(csvText) {
  if (typeof csvText !== "string") {
    throw new TypeError("CSV input must be a string");
  }

  const rows = parseCsvRows(csvText.replace(/^\uFEFF/, ""));
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
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

function parseCellValue(value) {
  if (!value.includes(";")) {
    return value;
  }

  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
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
