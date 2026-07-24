/**
 * csv.js
 *
 * Turn CSV text into plain table data for the project workspace.
 * Kept separate so project.js does not grow with parsing details.
 *
 * Limitations (on purpose for now):
 *   - No quoted commas ( "a,b" ). Fine for our example files.
 *   - First row must be headers.
 */

/**
 * Split a whole CSV file into headers + data rows (arrays of strings).
 *
 * @param {string} text
 * @returns {{ headers: string[], dataRows: string[][] }|null}
 */
export function parseCsvText(text) {
  if (text === undefined || text === null || text === "") {
    return null;
  }

  // Normalize Windows (\r\n) and old Mac (\r) line endings to \n.
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const lines = [];

  for (let i = 0; i < rawLines.length; i = i + 1) {
    const line = rawLines[i].trim();
    if (line !== "") {
      lines.push(line);
    }
  }

  if (lines.length === 0) {
    return null;
  }

  const headers = splitCsvLine(lines[0]);
  const dataRows = [];

  for (let i = 1; i < lines.length; i = i + 1) {
    dataRows.push(splitCsvLine(lines[i]));
  }

  return {
    headers: headers,
    dataRows: dataRows
  };
}

/**
 * Split one CSV line on commas and trim each cell.
 *
 * @param {string} line
 * @returns {string[]}
 */
function splitCsvLine(line) {
  const parts = line.split(",");
  const cells = [];

  for (let i = 0; i < parts.length; i = i + 1) {
    cells.push(parts[i].trim());
  }

  return cells;
}

/**
 * Guess a people-column type from the header name.
 *
 * @param {string} header
 * @returns {string}
 */
export function guessEntriesColumnType(header) {
  const lower = header.toLowerCase();

  if (lower === "id") {
    return "id";
  }

  if (lower === "skill") {
    return "number";
  }

  // Preference columns named "1", "2", … stay text (cell = slot name).
  return "text";
}

/**
 * Guess a slots-column type from the header name.
 *
 * @param {string} header
 * @returns {string}
 */
export function guessSlotsColumnType(header) {
  const lower = header.toLowerCase();

  if (lower === "id" || lower === "slot_id") {
    return "id";
  }

  if (lower === "min" || lower === "min_size" || lower === "minsize") {
    return "minSize";
  }

  if (lower === "max" || lower === "max_size" || lower === "maxsize") {
    return "maxSize";
  }

  return "text";
}

/**
 * Build { columns, rows } for project.entries or project.slots.
 *
 * @param {{ headers: string[], dataRows: string[][] }} parsed
 * @param {string} tableKind - "entries" or "slots"
 * @returns {{ columns: Object[], rows: Object[] }}
 */
export function csvToTable(parsed, tableKind) {
  const columns = [];

  for (let i = 0; i < parsed.headers.length; i = i + 1) {
    const key = parsed.headers[i];
    let type = "text";

    if (tableKind === "entries") {
      type = guessEntriesColumnType(key);
    } else {
      type = guessSlotsColumnType(key);
    }

    columns.push({
      key: key,
      label: key,
      type: type
    });
  }

  let idHeader = null;
  for (let i = 0; i < parsed.headers.length; i = i + 1) {
    const lower = parsed.headers[i].toLowerCase();
    if (lower === "id" || lower === "slot_id") {
      idHeader = parsed.headers[i];
    }
  }

  const rows = [];

  for (let i = 0; i < parsed.dataRows.length; i = i + 1) {
    const cellsArray = parsed.dataRows[i];
    const cells = {};

    for (let j = 0; j < parsed.headers.length; j = j + 1) {
      let value = "";
      if (j < cellsArray.length) {
        value = cellsArray[j];
      }
      cells[parsed.headers[j]] = value;
    }

    let rowId = "row-" + i;
    if (
      idHeader !== null &&
      cells[idHeader] !== undefined &&
      cells[idHeader] !== ""
    ) {
      rowId = String(cells[idHeader]);
    }

    rows.push({
      id: rowId,
      cells: cells
    });
  }

  return {
    columns: columns,
    rows: rows
  };
}

