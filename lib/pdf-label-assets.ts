/**
 * Logo Nexo (ISO en A4) e íconos como PNG data URLs para PDFs,
 * sin depender del DOM ni html2canvas.
 */

const NEXO_BLUE = "#1459e9"

/** Carga el isotipo desde /public y lo escala a un tamaño máximo (mantiene proporción). */
export async function getNexoIsoDataUrl(maxSize = 160): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (!w || !h) {
        resolve("")
        return
      }
      const scale = Math.min(maxSize / w, maxSize / h)
      const cw = Math.max(1, Math.round(w * scale))
      const ch = Math.max(1, Math.round(h * scale))
      const canvas = document.createElement("canvas")
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve("")
        return
      }
      ctx.drawImage(img, 0, 0, cw, ch)
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = () => resolve("")
    img.src = "/logos/nexo-iso.png"
  })
}

/** Marca texto “NEXO” sobre fondo azul (respaldo si no carga el ISO o para usos legacy). */
export function getNexoWordBadgeDataUrl(width: number = 80, height: number = 80): string {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""

  const r = 12
  const x = 0
  const y = 0
  const w = width
  const h = height
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fillStyle = NEXO_BLUE
  ctx.fill()

  ctx.fillStyle = "#ffffff"
  const fontPx = width >= 72 ? 28 : 22
  ctx.font = `bold ${fontPx}px system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("NEXO", w / 2, h / 2)

  return canvas.toDataURL("image/png")
}

/** Convierte un SVG string a PNG data URL (para íconos). */
export function svgToPngDataUrl(svgString: string, size: number = 48): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve("")
        return
      }
      ctx.fillStyle = "#000000"
      ctx.drawImage(img, 0, 0, size, size)
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = () => resolve("")
    img.src = "data:image/svg+xml," + encodeURIComponent(svgString)
  })
}

/** SVGs Material Design style (24x24 viewBox, path negro). */
const iconSvg = {
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  person: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`,
  document: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  package: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 9.4l-9-5.19"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  phone: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  location: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  mail: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  business: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-4 9 4v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/><polyline points="3 9 12 5 21 9"/></svg>`,
} as const

const iconSize = 48

export async function getLabelIconDataUrls(): Promise<{
  /** Isotipo Nexo para recuadro A4 (etiquetas). */
  logoA4: string
  calendar: string
  person: string
  document: string
  package: string
  phone: string
  location: string
  mail: string
  business: string
}> {
  const iso = await getNexoIsoDataUrl(160)
  const [
    calendar,
    person,
    document,
    packageIcon,
    phone,
    location,
    mail,
    business,
  ] = await Promise.all([
    svgToPngDataUrl(iconSvg.calendar.replace("currentColor", "#000"), iconSize),
    svgToPngDataUrl(iconSvg.person.replace("currentColor", "#000"), iconSize),
    svgToPngDataUrl(iconSvg.document.replace("currentColor", "#000"), iconSize),
    svgToPngDataUrl(iconSvg.package.replace("currentColor", "#000"), iconSize),
    svgToPngDataUrl(iconSvg.phone.replace("currentColor", "#000"), iconSize),
    svgToPngDataUrl(iconSvg.location.replace("currentColor", "#000"), iconSize),
    svgToPngDataUrl(iconSvg.mail.replace("currentColor", "#000"), iconSize),
    svgToPngDataUrl(iconSvg.business.replace("currentColor", "#000"), iconSize),
  ])

  return {
    logoA4: iso || getNexoWordBadgeDataUrl(80, 80),
    calendar,
    person,
    document,
    package: packageIcon,
    phone,
    location,
    mail,
    business,
  }
}
