export function exportCsv(records) {
  if (!Array.isArray(records)) {
    throw new TypeError("JSON input must be an array of records");
  }

  if (records.length === 0) {
    return "";
  }

  if (
    records.some(
      (record) =>
        typeof record !== "object" || record === null || Array.isArray(record),
    )
  ) {
    throw new TypeError("JSON input must contain only record objects");
  }

  const headers = [
    ...new Set(records.flatMap((record) => Object.keys(record))),
  ];
  const rows = [
    headers,
    ...records.map((record) =>
      headers.map((header) => formatCellValue(record[header])),
    ),
  ];

  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function formatCellValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join("; ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeCsvValue(value) {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
