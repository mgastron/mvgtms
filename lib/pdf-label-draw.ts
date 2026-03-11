/**
 * Dibujado de etiquetas PDF (A4, 10x15, 10x10) con el diseño actual.
 * Usado por Reimprimir NoFlex y por Subir Envíos para que las etiquetas sean iguales.
 */

import type { jsPDF } from "jspdf"
import QRCode from "qrcode"

export type LabelAssets = Awaited<ReturnType<typeof import("./pdf-label-assets").getLabelIconDataUrls>>

export interface EnvioLabel {
  id?: number
  fecha: string
  tracking: string
  nombreDestinatario: string
  direccion: string
  telefono: string
  localidad?: string
  cliente?: string
  origen?: string
  observaciones?: string
  totalACobrar?: string
  cambioRetiro?: string
  qrData?: string
}

export function getOrigenVentaLabel(origen: string): string {
  if (!origen || !String(origen).trim()) return "Venta x afuera"
  const o = String(origen).trim()
  if (o === "Flex" || o === "MercadoLibre" || /meli|mercado|flex/i.test(o)) return "Meli"
  if (o === "Shopify") return "Shopify"
  if (o === "VTEX" || o === "Vtex") return "VTEX"
  if (o === "Tienda Nube") return "Tienda Nube"
  return "Venta x afuera"
}

function drawIconCalendar(pdf: jsPDF, cx: number, cy: number) {
  pdf.setFillColor(0, 0, 0)
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.4)
  const W = 10
  const H = 7.2
  pdf.rect(cx - W / 2, cy - H / 2 - 1.1, W, 1.4, "F")
  pdf.roundedRect(cx - W / 2, cy - H / 2 + 0.2, W, H, 0.5, 0.5, "S")
  pdf.line(cx - W / 2 + 0.8, cy - 1.4, cx + W / 2 - 0.8, cy - 1.4)
  pdf.line(cx - W / 2 + 0.8, cy - 0.2, cx + W / 2 - 0.8, cy - 0.2)
  pdf.line(cx - W / 2 + 0.8, cy + 1, cx + W / 2 - 0.8, cy + 1)
}
function drawIconPerson(pdf: jsPDF, cx: number, cy: number) {
  pdf.setFillColor(0, 0, 0)
  pdf.circle(cx, cy - 2.2, 3.4, "F")
  pdf.circle(cx, cy + 3.4, 4.2, "F")
}
function drawIconDoc(pdf: jsPDF, cx: number, cy: number) {
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.5)
  pdf.roundedRect(cx - 2.6, cy - 3.2, 5.2, 6.4, 0.5, 0.5, "S")
  pdf.line(cx - 1.8, cy - 1.6, cx + 1.8, cy - 1.6)
  pdf.line(cx - 1.8, cy + 0.2, cx + 1.6, cy + 0.2)
  pdf.line(cx - 1.8, cy + 1.9, cx + 1.4, cy + 1.9)
}
function drawIconBusiness(pdf: jsPDF, cx: number, cy: number) {
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.45)
  pdf.line(cx - 2.5, cy + 2.2, cx, cy - 2)
  pdf.line(cx, cy - 2, cx + 2.5, cy + 2.2)
  pdf.line(cx + 2.5, cy + 2.2, cx - 2.5, cy + 2.2)
  pdf.rect(cx - 2.2, cy - 0.5, 1.2, 1.8, "S")
  pdf.rect(cx + 0.2, cy - 0.5, 1.2, 1.8, "S")
}
function drawIconPhone(pdf: jsPDF, cx: number, cy: number) {
  pdf.setFillColor(0, 0, 0)
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.4)
  const r = 2.2
  pdf.circle(cx, cy - 2.8, r, "F")
  pdf.circle(cx, cy + 2.8, r, "F")
  pdf.roundedRect(cx - 1.3, cy - 1.1, 2.6, 2.2, 0.8, 0.8, "F")
}
function drawIconPackage(pdf: jsPDF, cx: number, cy: number) {
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.85)
  pdf.rect(cx - 3.8, cy - 2.6, 7.6, 5.2, "S")
  pdf.line(cx - 3.8, cy - 2.6, cx + 3.8, cy + 2.6)
  pdf.line(cx + 3.8, cy - 2.6, cx - 3.8, cy + 2.6)
}
function drawIconPin(pdf: jsPDF, cx: number, cy: number) {
  pdf.setFillColor(0, 0, 0)
  pdf.circle(cx, cy - 1.6, 3.2, "F")
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(1)
  pdf.line(cx, cy + 1.9, cx, cy + 7.2)
}

const iconSizePdf = 14

function addIcon(
  pdf: jsPDF,
  dataUrl: string | null,
  cx: number,
  cy: number,
  drawFallback: () => void
) {
  if (dataUrl) {
    const w = iconSizePdf
    const h = iconSizePdf
    try {
      pdf.addImage(dataUrl, "PNG", cx - w / 2, cy - h / 2, w, h)
      return
    } catch {
      // fallback
    }
  }
  drawFallback()
}

/** Dibuja una etiqueta A4 en el rectángulo (startX, startY, labelWidth, labelHeight). */
export async function drawA4Label(
  pdf: jsPDF,
  envio: EnvioLabel,
  startX: number,
  startY: number,
  labelWidth: number,
  labelHeight: number,
  assets: LabelAssets | null
): Promise<void> {
  const qrDataToUse = envio.qrData || `${envio.tracking}-${envio.id ?? ""}`
  const qrCodeDataUrl = await QRCode.toDataURL(qrDataToUse, { width: 64, margin: 1 })

  const fecha = new Date(envio.fecha)
  const fechaFormateada = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`

  const pad = 6
  const qrSize = 48
  const lineH = 11
  const lineGap = 7
  const iconTextOffset = 40
  let y = startY

  const barH = 18
  pdf.setFillColor(0, 0, 0)
  pdf.rect(startX, y, labelWidth, barH, "F")
  const zonaText = (envio.localidad || "Sin zona").toUpperCase()
  pdf.setFontSize(10)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(255, 255, 255)
  const zw = pdf.getTextWidth(zonaText)
  pdf.text(zonaText, startX + (labelWidth - zw) / 2, y + 12)
  pdf.setTextColor(0, 0, 0)
  y += barH + 14

  const qrLeft = startX + pad
  pdf.setDrawColor(80, 80, 80)
  pdf.setLineWidth(0.6)
  pdf.roundedRect(qrLeft - 2, y - 2, qrSize + 4, qrSize + 4, 3, 3, "S")
  pdf.setDrawColor(0, 0, 0)
  pdf.addImage(qrCodeDataUrl, "PNG", qrLeft, y, qrSize, qrSize)
  const qrRight = startX + pad + qrSize + 12
  const iconX = qrRight + 6
  let infoY = y + 6
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(0, 0, 0)
  addIcon(pdf, assets?.calendar ?? null, iconX, infoY - 0.5, () => drawIconCalendar(pdf, iconX, infoY - 0.5))
  pdf.text(fechaFormateada, qrRight + iconTextOffset, infoY)
  infoY += lineH + lineGap
  addIcon(pdf, assets?.business ?? null, iconX, infoY - 0.5, () => drawIconBusiness(pdf, iconX, infoY - 0.5))
  const clienteShort = (envio.cliente ?? "").length > 24 ? (envio.cliente ?? "").slice(0, 23) + "…" : (envio.cliente ?? "")
  pdf.text(`Cliente: ${clienteShort}`, qrRight + iconTextOffset, infoY)
  infoY += lineH + lineGap
  addIcon(pdf, assets?.document ?? null, iconX, infoY - 0.5, () => drawIconDoc(pdf, iconX, infoY - 0.5))
  pdf.setFont("helvetica", "normal")
  pdf.text("Venta: ", qrRight + iconTextOffset, infoY)
  pdf.setFont("helvetica", "bold")
  pdf.text(getOrigenVentaLabel(envio.origen ?? ""), qrRight + iconTextOffset + pdf.getTextWidth("Venta: "), infoY)
  infoY += lineH + lineGap
  pdf.setFont("helvetica", "normal")
  addIcon(pdf, assets?.package ?? null, iconX, infoY - 0.5, () => drawIconPackage(pdf, iconX, infoY - 0.5))
  pdf.text("Envio: ", qrRight + iconTextOffset, infoY)
  pdf.setFont("helvetica", "bold")
  pdf.text(String((envio.tracking || envio.id) ?? ""), qrRight + iconTextOffset + pdf.getTextWidth("Envio: "), infoY)
  y = infoY + 14

  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.5)
  pdf.line(startX + pad, y, startX + labelWidth - pad, y)
  y += 14

  const destSectionTop = y
  const destSectionBottom = startY + labelHeight - pad - 8
  const destSectionHeight = destSectionBottom - destSectionTop
  pdf.setFillColor(248, 248, 250)
  pdf.setDrawColor(220, 220, 224)
  pdf.setLineWidth(0.2)
  pdf.roundedRect(startX + pad, destSectionTop, labelWidth - pad * 2, destSectionHeight, 4, 4, "FD")
  pdf.setDrawColor(0, 0, 0)

  const destIconX = startX + pad + 6
  const destTextX = startX + pad + 48
  const destTextW = labelWidth - pad * 2 - 54
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "bold")
  pdf.text("Destinatario", startX + pad, y)
  y += lineH + 8
  addIcon(pdf, assets?.person ?? null, destIconX, y - 0.5, () => drawIconPerson(pdf, destIconX, y - 0.5))
  pdf.setFont("helvetica", "bold")
  const nomLines = pdf.splitTextToSize(envio.nombreDestinatario ?? "", destTextW)
  pdf.text(nomLines, destTextX, y)
  y += nomLines.length * (lineH + 3) + 6
  pdf.setFont("helvetica", "normal")
  addIcon(pdf, assets?.phone ?? null, destIconX, y - 0.5, () => drawIconPhone(pdf, destIconX, y - 0.5))
  pdf.text(String(envio.telefono ?? ""), destTextX, y)
  y += lineH + lineGap
  addIcon(pdf, assets?.location ?? null, destIconX, y - 0.5, () => drawIconPin(pdf, destIconX, y - 0.5))
  pdf.setFont("helvetica", "normal")
  const dirLines = pdf.splitTextToSize(envio.direccion ?? "", destTextW)
  pdf.text(dirLines, destTextX, y)
  y += dirLines.length * (lineH + 2.5) + 6
  if (envio.observaciones) {
    pdf.setFont("helvetica", "italic")
    const obsLines = pdf.splitTextToSize(`Obs: ${envio.observaciones}`, destTextW)
    pdf.text(obsLines, destTextX, y)
    y += obsLines.length * (lineH + 1.5) + 6
    pdf.setFont("helvetica", "normal")
  }
  if (envio.totalACobrar && String(envio.totalACobrar).trim() !== "") {
    pdf.setFont("helvetica", "bold")
    pdf.text(`Cobrar: $ ${String(envio.totalACobrar).trim()}`, startX + pad, y)
    y += lineH + lineGap
  }
  if (envio.cambioRetiro && String(envio.cambioRetiro).trim() !== "") {
    const v = String(envio.cambioRetiro).trim().toUpperCase()
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.5)
    const bw = Math.max(pdf.getTextWidth(v) + 10, 32)
    pdf.roundedRect(startX + pad, y - 6, bw, 12, 2, 2, "S")
    pdf.setFont("helvetica", "bold")
    pdf.text(v, startX + pad + bw / 2 - pdf.getTextWidth(v) / 2, y + 1.5)
    y += 18
  }

  const logoBoxW = 36
  const logoBoxH = 36
  const logoBoxX = startX + labelWidth - pad - logoBoxW - 6
  const logoY = destSectionBottom - logoBoxH - 6
  if (assets?.logo) {
    try {
      pdf.addImage(assets.logo, "PNG", logoBoxX, logoY - 2, logoBoxW, logoBoxH)
    } catch {
      drawLogoFallback(pdf, logoBoxX, logoY)
    }
  } else {
    drawLogoFallback(pdf, logoBoxX, logoY)
  }

  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.25)
  pdf.rect(startX, startY, labelWidth, labelHeight)
}

function drawLogoFallback(pdf: jsPDF, logoBoxX: number, logoY: number) {
  const logoBoxW = 36
  const logoBoxH = 36
  pdf.setFillColor(79, 70, 229)
  pdf.roundedRect(logoBoxX, logoY - 2, logoBoxW, logoBoxH, 4, 4, "F")
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(255, 255, 255)
  const mvgW = pdf.getTextWidth("MVG")
  pdf.text("MVG", logoBoxX + (logoBoxW - mvgW) / 2, logoY - 2 + logoBoxH / 2 + 4)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(0, 0, 0)
}

/** Dibuja una página de etiqueta 10x15 o 10x10 (una página = un envío). */
export async function drawSmallLabel(
  pdf: jsPDF,
  envio: EnvioLabel,
  format: "10x15" | "10x10",
  assets: LabelAssets | null
): Promise<void> {
  const width = 283.46
  const height = format === "10x15" ? 425.2 : 283.46

  const qrDataToUse = envio.qrData || `${envio.tracking}-${envio.id ?? ""}`
  const qrCodeDataUrl = await QRCode.toDataURL(qrDataToUse, { width: 120, margin: 1 })

  const fecha = new Date(envio.fecha)
  const fechaFormateada = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`

  const iconSz = format === "10x15" ? 12 : 10
  const addIcon = (dataUrl: string | null, cx: number, cy: number) => {
    if (dataUrl) {
      try {
        pdf.addImage(dataUrl, "PNG", cx - iconSz / 2, cy - iconSz / 2, iconSz, iconSz)
        return
      } catch {
        // fallback
      }
    }
    pdf.setFillColor(0, 0, 0)
    pdf.circle(cx, cy, 1.4, "F")
  }

  const marginLeft = 18
  const marginRight = 18
  const marginTop = 14
  let currentY = marginTop

  pdf.setFontSize(14)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(0, 0, 0)
  const titleWidth = pdf.getTextWidth("MVG")
  pdf.text("MVG", (width - titleWidth) / 2, currentY)
  currentY += 14

  const barHeight = 20
  pdf.setFillColor(0, 0, 0)
  pdf.rect(0, currentY - 8, width, barHeight, "F")
  const zonaText = (envio.localidad || "Sin zona").toUpperCase()
  pdf.setFontSize(format === "10x15" ? 12 : 11)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(255, 255, 255)
  const zonaW = pdf.getTextWidth(zonaText)
  pdf.text(zonaText, (width - zonaW) / 2, currentY + 6)
  pdf.setTextColor(0, 0, 0)
  currentY += barHeight + 14

  const qrSize = format === "10x15" ? 72 : 62
  const qrX = marginLeft
  const qrY = currentY
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(1)
  pdf.roundedRect(qrX, qrY, qrSize, qrSize, 2, 2, "S")
  pdf.addImage(qrCodeDataUrl, "PNG", qrX + 2, qrY + 2, qrSize - 4, qrSize - 4)
  const qrRight = qrX + qrSize + 10
  const qrBottom = qrY + qrSize
  const iconTextGap = 8
  const textStartX = qrRight + iconSz + iconTextGap

  const infoLineH = format === "10x15" ? 12 : 11
  const infoLineGap = 3
  let infoY = currentY + 5
  pdf.setFontSize(format === "10x15" ? 7.5 : 7)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(0, 0, 0)
  addIcon(assets?.calendar ?? null, qrRight + iconSz / 2, infoY - 0.5)
  pdf.text(fechaFormateada, textStartX, infoY)
  infoY += infoLineH + infoLineGap
  addIcon(assets?.business ?? null, qrRight + iconSz / 2, infoY - 0.5)
  const clienteText = `Cliente: ${envio.cliente ?? ""}`
  const clienteLines = pdf.splitTextToSize(clienteText, width - textStartX - marginRight)
  pdf.text(clienteLines, textStartX, infoY)
  infoY += clienteLines.length * infoLineH + infoLineGap
  addIcon(assets?.document ?? null, qrRight + iconSz / 2, infoY - 0.5)
  pdf.text(`Venta: ${getOrigenVentaLabel(envio.origen ?? "")}`, textStartX, infoY)
  infoY += infoLineH + infoLineGap
  addIcon(assets?.package ?? null, qrRight + iconSz / 2, infoY - 0.5)
  pdf.text(`Envio: ${envio.tracking || String(envio.id ?? "")}`, textStartX, infoY)

  currentY = qrBottom + 14
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.5)
  pdf.line(marginLeft, currentY, width - marginRight, currentY)
  currentY += 14

  pdf.setFontSize(format === "10x15" ? 7.5 : 7)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(0, 0, 0)
  pdf.text("Destinatario", marginLeft, currentY)
  const destinatarioWidth = pdf.getTextWidth("Destinatario")
  pdf.setLineWidth(0.4)
  pdf.line(marginLeft, currentY + 2, marginLeft + destinatarioWidth, currentY + 2)
  currentY += 14

  const destIconX = marginLeft + iconSz / 2 + 2
  const destTextX = marginLeft + iconSz + 10
  const destTextW = width - marginLeft - marginRight - iconSz - 14
  addIcon(assets?.person ?? null, destIconX, currentY - 0.5)
  pdf.setFontSize(format === "10x15" ? 10 : 9)
  pdf.setFont("helvetica", "bold")
  const nombreLines = pdf.splitTextToSize(envio.nombreDestinatario, destTextW)
  pdf.text(nombreLines, destTextX, currentY)
  currentY += nombreLines.length * (format === "10x15" ? 12 : 11) + 6

  if (envio.telefono && envio.telefono !== "null") {
    addIcon(assets?.phone ?? null, destIconX, currentY - 0.5)
    pdf.setFontSize(format === "10x15" ? 8 : 7.5)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Tel: ${envio.telefono}`, destTextX, currentY)
    currentY += infoLineH + infoLineGap + 2
  }

  addIcon(assets?.location ?? null, destIconX, currentY - 0.5)
  pdf.setFontSize(format === "10x15" ? 8 : 7.5)
  const direccionLines = pdf.splitTextToSize(envio.direccion, destTextW)
  pdf.text(direccionLines, destTextX, currentY)
  currentY += direccionLines.length * (format === "10x15" ? 11 : 10) + 8

  if (envio.observaciones) {
    pdf.setFontSize(format === "10x15" ? 7.5 : 7)
    pdf.setFont("helvetica", "italic")
    const obsLines = pdf.splitTextToSize(`Obs: ${envio.observaciones}`, destTextW)
    pdf.text(obsLines, destTextX, currentY)
    currentY += obsLines.length * (format === "10x15" ? 10 : 9) + 6
    pdf.setFont("helvetica", "normal")
  }

  if (envio.totalACobrar && String(envio.totalACobrar).trim() !== "") {
    pdf.setFontSize(format === "10x15" ? 8.5 : 8)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(0, 0, 0)
    pdf.text(`Cobrar en Efectivo: $ ${String(envio.totalACobrar).trim()}`, marginLeft, currentY)
    currentY += 14
  }

  if (envio.cambioRetiro && String(envio.cambioRetiro).trim() !== "") {
    const valor = String(envio.cambioRetiro).trim().toUpperCase()
    pdf.setFontSize(format === "10x15" ? 9 : 8)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(0, 0, 0)
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.8)
    const badgeW = Math.max(pdf.getTextWidth(valor) + 12, 40)
    pdf.roundedRect(marginLeft, currentY - 8, badgeW, 15, 2, 2, "S")
    pdf.text(valor, marginLeft + badgeW / 2 - pdf.getTextWidth(valor) / 2, currentY + 2)
    currentY += 20
  }

  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.5)
  pdf.line(marginLeft, currentY + 4, width - marginRight, currentY + 4)
}
