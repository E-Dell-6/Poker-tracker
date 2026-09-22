// Binary units (1024-based) with the short KB/MB/GB labels, deliberately:
// the backend's limits.js defines `MB = 1024 * 1024`, so a 2147483648-byte
// quota has to read as "2 GB" here. Formatting it decimally would show
// "2.15 GB" against a limit the server calls 2GB in its own error messages.

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 B";

  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  // Bytes are never fractional; above that, enough precision to see a
  // number move after a single import without a wall of digits. Trailing
  // zeros are trimmed so a round limit reads "2 GB", not "2.00 GB".
  // parseFloat rather than a trailing-zero regex: a regex that strips "0"s
  // off the end also eats the zero in "1020 B", which has no decimal point.
  const decimals = unit === 0 ? 0 : value < 10 ? 2 : 1;
  return `${parseFloat(value.toFixed(decimals))} ${UNITS[unit]}`;
}
