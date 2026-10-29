/** Huso único de la app. Argentina no tiene DST. */
export const TZ_AR = "America/Argentina/Buenos_Aires"

/**
 * El backend persiste LocalDateTime en UTC (ECS) y Jackson lo manda sin zona
 * (`2026-10-29T18:30:00`). Sin la Z, JS lo toma como hora local del browser
 * y en Argentina se ve GMT. Si ya trae Z u offset, se respeta.
 */
export function parseApiDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const s = String(value).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00-03:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)
  const normalized = hasZone ? s : /T/.test(s) ? `${s}Z` : `${s}T00:00:00Z`
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

const ar = { timeZone: TZ_AR, hour12: false as const }

export function formatFechaAR(value?: string | Date | null): string {
  const d = parseApiDate(value)
  if (!d) return ""
  return d.toLocaleDateString("es-AR", { ...ar, day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatHoraAR(value?: string | Date | null): string {
  const d = parseApiDate(value)
  if (!d) return ""
  return d.toLocaleTimeString("es-AR", { ...ar, hour: "2-digit", minute: "2-digit" })
}

export function formatFechaHoraAR(value?: string | Date | null): string {
  const d = parseApiDate(value)
  if (!d) return ""
  const fecha = formatFechaAR(d)
  const hora = formatHoraAR(d)
  return hora ? `${fecha} ${hora}` : fecha
}

/** `YYYY-MM-DD` del calendario argentino (inputs type=date). */
export function todayDateInputAR(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

/** `HH:mm` en Argentina (inputs de horario). */
export function nowTimeInputAR(d = new Date()): string {
  return d.toLocaleTimeString("es-AR", { ...ar, hour: "2-digit", minute: "2-digit" })
}
