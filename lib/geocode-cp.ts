/**
 * Política CP columna vs Google (sin agregar variables nuevas):
 * - Caso A: CP de columna vacío o inválido → usar CP que devuelve Google al geocodificar la dirección.
 * - Caso B: CP de columna válido (aunque difiera de Google) → mantener CP de columna.
 */

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

/** Consideramos válido un CP que, limpio (solo dígitos), tenga entre 4 y 8 caracteres (Argentina). */
export function isCodigoPostalValido(cp: string | undefined | null): boolean {
  if (cp == null || typeof cp !== "string") return false
  const limpio = cp.trim().replace(/\D/g, "")
  if (limpio.length < 4 || limpio.length > 8) return false
  return /^\d+$/.test(limpio)
}

/** Limpia el CP dejando solo dígitos (para guardar en BD y zona). */
export function limpiarCodigoPostal(cp: string): string {
  return (cp || "").trim().replace(/\D/g, "")
}

/**
 * Geocodifica la dirección con Google y devuelve el código postal del primer resultado.
 * Usa NEXT_PUBLIC_GOOGLE_PLACES_API_KEY (misma key que Places suele servir para Geocoding).
 * @returns CP (solo dígitos) o null si falla o no hay postal_code.
 */
export async function geocodeAndGetPostalCode(address: string): Promise<string | null> {
  if (!address || !address.trim()) return null
  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
  if (!key || key === "YOUR_API_KEY") return null

  try {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(address.trim())}&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) return null

    const components = data.results[0]?.address_components
    if (!Array.isArray(components)) return null

    const postal = components.find((c: { types: string[] }) => c.types && c.types.includes("postal_code"))
    if (!postal) return null

    const raw = (postal.long_name || postal.short_name || "").trim()
    const limpio = raw.replace(/\D/g, "")
    return limpio.length >= 4 ? limpio : null
  } catch {
    return null
  }
}
