/** Beträge aus deutschen (oder englischen) Eingaben robust lesen. */
export function parseAmount(raw: string): number | null {
  let t = raw.trim().replace(/[\s€]/g, '')
  if (!t) return null
  if (t.includes(',') && t.includes('.')) {
    // Letztes Trennzeichen entscheidet: 1.234,56 (DE) vs. 1,234.56 (EN)
    t = t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '')
  }
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, '')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  else t = t.replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
