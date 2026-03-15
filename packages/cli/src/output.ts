/**
 * Output formatting — supports both human-readable and JSON modes.
 * JSON mode is agent-friendly: always structured, parseable output.
 */

let jsonMode = false;

export function setJsonMode(enabled: boolean) {
  jsonMode = enabled;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function output(data: unknown) {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

export function outputTable(rows: Record<string, unknown>[]) {
  if (jsonMode) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log("No results.");
    return;
  }

  // Simple aligned table output
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)),
  );

  const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");

  console.log(header);
  console.log(separator);
  for (const row of rows) {
    const line = keys.map((k, i) => String(row[k] ?? "").padEnd(widths[i])).join("  ");
    console.log(line);
  }
}

export function outputSuccess(message: string) {
  if (jsonMode) {
    console.log(JSON.stringify({ success: true, message }));
  } else {
    console.log(`✓ ${message}`);
  }
}

export function outputError(message: string) {
  if (jsonMode) {
    console.error(JSON.stringify({ success: false, error: message }));
  } else {
    console.error(`✗ ${message}`);
  }
}
