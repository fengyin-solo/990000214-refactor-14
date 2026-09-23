// Parse a created_at/updated_at value that may be stored either as
// ISO 8601 ("2026-09-23T08:00:00.000Z") or as SQLite CURRENT_TIMESTAMP
// ("2026-09-23 08:00:00", UTC). Returns null for unparseable values.
export function parseDate(dateStr) {
  if (!dateStr) return null
  const normalized = typeof dateStr === 'string' && dateStr.includes(' ')
    ? dateStr.replace(' ', 'T') + 'Z'
    : dateStr
  const date = new Date(normalized)
  return isNaN(date.getTime()) ? null : date
}

export function formatDate(dateStr) {
  const date = parseDate(dateStr)
  return date ? date.toLocaleDateString('zh-CN') : ''
}
