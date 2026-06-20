export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('vi-VN')
}

export function formatNumber(val: number): string {
  return val.toLocaleString('vi-VN')
}
