"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import jsPDF from "jspdf"
import QRCode from "qrcode"
import { getApiBaseUrl } from "@/lib/api-config"
import { getLabelIconDataUrls } from "@/lib/pdf-label-assets"
import { warnDev, errorDev } from "@/lib/logger"

interface EnvioNoflex {
  id: number
  fecha: string // Fecha de carga
  fechaVenta?: string
  fechaLlegue?: string
  fechaEntregado?: string
  origen: string
  tracking: string
  cliente: string
  direccion: string
  nombreDestinatario: string
  telefono: string
  impreso: string
  observaciones?: string
  totalACobrar?: string
  cambioRetiro?: string
  localidad?: string
  qrData?: string // QR data para reimpresión
}

export default function ReimprimirNoflexPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<string | null>(null)
  const [userCodigoCliente, setUserCodigoCliente] = useState<string | null>(null)
  const [envios, setEnvios] = useState<EnvioNoflex[]>([])
  const [filteredEnvios, setFilteredEnvios] = useState<EnvioNoflex[]>([])
  const [selectedEnvios, setSelectedEnvios] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState({
    tipoFecha: "fechaVenta",
    pendienteImprimir: "todos",
    fechaDesde: "",
    fechaHasta: "",
    origen: "todos",
    nombreFantasia: "",
    destinoDireccion: "",
    nombreDestinatario: "",
    zonasEntrega: "todos",
    trackings: "",
  })

  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const profile = sessionStorage.getItem("userProfile")
    
    if (!isAuthenticated) {
      router.push("/")
      return
    }

    setUserProfile(profile)

    // Si el usuario es Cliente, obtener su código de cliente desde el backend
    if (profile === "Cliente") {
      const loadUserInfo = async () => {
        const username = sessionStorage.getItem("username")
        if (!username) return

        try {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
          if (response.ok) {
            const data = await response.json()
            const content = data.content || []
            const user = content.find((u: any) => u.usuario === username)
            if (user && user.codigoCliente) setUserCodigoCliente(user.codigoCliente)
          }
        } catch (error) {
          warnDev("No se pudo cargar información del backend:", error)
        }
      }
      loadUserInfo()
    }

    // No cargar aquí; lo hace el effect que depende de userProfile + filtros
  }, [router, userProfile, userCodigoCliente])

  // Cargar envíos al tener perfil (y código cliente si es Cliente) y cuando cambien filtros del API
  useEffect(() => {
    if (!userProfile) return
    if (userProfile === "Cliente" && !userCodigoCliente) return
    loadEnvios()
  }, [userProfile, userCodigoCliente, filters.tipoFecha, filters.fechaDesde, filters.fechaHasta, filters.origen, filters.zonasEntrega])

  // Función para cargar envíos desde el backend (usa filtros actuales para el API)
  const loadEnvios = async () => {
    setIsLoading(true)
    try {
      const apiBaseUrl = getApiBaseUrl()
      const params = new URLSearchParams({
        page: "0",
        size: "1000", // Cargar muchos para reimprimir
        estado: "todos",
        tipoFecha: filters.tipoFecha || "fechaVenta",
        fechaDesde: filters.fechaDesde || "",
        fechaHasta: filters.fechaHasta || "",
        origen: filters.origen || "todos",
        nombreFantasia: filters.nombreFantasia || "",
        destinoNombre: filters.nombreDestinatario || "",
        destinoDireccion: filters.destinoDireccion || "",
        zonasEntrega: filters.zonasEntrega && filters.zonasEntrega !== "todos" ? filters.zonasEntrega : "",
      })

      if (userProfile === "Cliente" && userCodigoCliente) {
        params.append("codigoCliente", userCodigoCliente)
      }

      const response = await fetch(`${apiBaseUrl}/envios?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        const content = data.content ?? []
        // Convertir y excluir Flex y eliminados (Flex no se reimprime con NoFlex)
        const enviosFormateados = content
          .filter((envio: any) => envio.origen !== "Flex" && !envio.eliminado)
          .map((envio: any) => ({
            id: envio.id,
            fecha: envio.fecha ? new Date(envio.fecha).toISOString() : undefined,
            fechaVenta: envio.fechaVenta ? new Date(envio.fechaVenta).toISOString() : undefined,
            fechaLlegue: envio.fechaLlegue ? new Date(envio.fechaLlegue).toISOString() : undefined,
            fechaEntregado: envio.fechaEntregado ? new Date(envio.fechaEntregado).toISOString() : undefined,
            origen: envio.origen,
            tracking: envio.tracking,
            cliente: envio.cliente,
            direccion: envio.direccion,
            nombreDestinatario: envio.nombreDestinatario,
            telefono: envio.telefono,
            impreso: envio.impreso || "NO",
            observaciones: envio.observaciones,
            totalACobrar: envio.totalACobrar,
            cambioRetiro: envio.cambioRetiro,
            localidad: envio.localidad,
            qrData: envio.qrData || envio.tracking,
          }))
        setEnvios(enviosFormateados)
        // filteredEnvios se actualiza en el useEffect que aplica pendienteImprimir y trackings
      } else {
        throw new Error("Error al cargar envíos desde el backend")
      }
    } catch (error) {
      warnDev("Error al cargar desde backend, usando localStorage:", error)
      const enviosGuardados = JSON.parse(localStorage.getItem("enviosNoflex") || "[]")
      const enviosSinFlex = enviosGuardados.filter((envio: EnvioNoflex) => envio.origen !== "Flex")
      setEnvios(enviosSinFlex)
      setFilteredEnvios(enviosSinFlex)
    } finally {
      setIsLoading(false)
    }
  }

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...envios]

    // Si el usuario es Cliente, filtrar solo sus envíos
    if (userProfile === "Cliente" && userCodigoCliente) {
      filtered = filtered.filter((envio) => {
        // Comparar por código de cliente (puede estar en formato "codigo - nombre" o solo "codigo")
        const clienteCodigo = envio.cliente.split(" - ")[0].trim()
        return clienteCodigo.toLowerCase() === userCodigoCliente.toLowerCase()
      })
    }

    // Filtro por pendiente de imprimir
    if (filters.pendienteImprimir === "si") {
      filtered = filtered.filter((envio) => envio.impreso === "NO")
    } else if (filters.pendienteImprimir === "no") {
      filtered = filtered.filter((envio) => envio.impreso === "SI")
    }

    // Filtro por fechas según el tipo de fecha seleccionado
    if (filters.fechaDesde || filters.fechaHasta) {
      filtered = filtered.filter((envio) => {
        let fechaComparar: Date | null = null
        
        if (filters.tipoFecha === "fechaVenta") {
          fechaComparar = envio.fechaVenta ? new Date(envio.fechaVenta) : null
        } else if (filters.tipoFecha === "fechaLlegue") {
          fechaComparar = envio.fechaLlegue ? new Date(envio.fechaLlegue) : null
        } else if (filters.tipoFecha === "fechaEntregado") {
          fechaComparar = envio.fechaEntregado ? new Date(envio.fechaEntregado) : null
        }
        
        // Si no hay fecha del tipo seleccionado, usar fecha de carga como fallback
        if (!fechaComparar) {
          fechaComparar = new Date(envio.fecha)
        }
        
        if (filters.fechaDesde) {
          const fechaDesde = new Date(filters.fechaDesde)
          if (fechaComparar < fechaDesde) return false
        }
        if (filters.fechaHasta) {
          const fechaHasta = new Date(filters.fechaHasta)
          fechaHasta.setHours(23, 59, 59, 999)
          if (fechaComparar > fechaHasta) return false
        }
        return true
      })
    }
    
    // Filtro por origen
    if (filters.origen !== "todos") {
      filtered = filtered.filter((envio) => envio.origen === filters.origen)
    }
    
    // Excluir siempre los envíos Flex (no se reimprimen con NoFlex)
    filtered = filtered.filter((envio) => envio.origen !== "Flex")

    // Filtro por nombre fantasía (cliente)
    if (filters.nombreFantasia) {
      filtered = filtered.filter((envio) =>
        envio.cliente.toLowerCase().includes(filters.nombreFantasia.toLowerCase())
      )
    }

    // Filtro por dirección destino
    if (filters.destinoDireccion) {
      filtered = filtered.filter((envio) =>
        envio.direccion.toLowerCase().includes(filters.destinoDireccion.toLowerCase())
      )
    }

    // Filtro por nombre destinatario
    if (filters.nombreDestinatario) {
      filtered = filtered.filter((envio) =>
        envio.nombreDestinatario.toLowerCase().includes(filters.nombreDestinatario.toLowerCase())
      )
    }

    // Filtro por zonas de entrega
    if (filters.zonasEntrega && filters.zonasEntrega !== "todos") {
      filtered = filtered.filter((envio) => {
        const localidad = (envio.localidad || "").toUpperCase()
        if (filters.zonasEntrega === "CABA") {
          return localidad.includes("CABA") || localidad.includes("CIUDAD AUTÓNOMA")
        } else if (filters.zonasEntrega === "Zona 1") {
          return localidad.includes("ZONA 1") || localidad.includes("PRIMER CORDÓN") || localidad.includes("PRIMER CORDON")
        } else if (filters.zonasEntrega === "Zona 2") {
          return localidad.includes("ZONA 2") || localidad.includes("SEGUNDO CORDÓN") || localidad.includes("SEGUNDO CORDON")
        } else if (filters.zonasEntrega === "Zona 3") {
          return localidad.includes("ZONA 3") || localidad.includes("TERCER CORDÓN") || localidad.includes("TERCER CORDON")
        }
        return false
      })
    }

    // Filtro por trackings (separados por comas)
    if (filters.trackings) {
      const trackingsList = filters.trackings
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t)
      filtered = filtered.filter((envio) =>
        trackingsList.some((tracking) =>
          envio.tracking.toLowerCase().includes(tracking.toLowerCase())
        )
      )
    }

    // Ordenar por fecha descendente (más nuevos primero)
    filtered.sort((a, b) => {
      const fechaA = new Date(a.fecha).getTime()
      const fechaB = new Date(b.fecha).getTime()
      return fechaB - fechaA // Descendente: más reciente primero
    })

    setFilteredEnvios(filtered)
    setCurrentPage(0) // Resetear a primera página cuando cambian los filtros
  }, [envios, filters, userProfile, userCodigoCliente])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleClearFilters = () => {
    setFilters({
      tipoFecha: "fechaVenta",
      pendienteImprimir: "todos",
      fechaDesde: "",
      fechaHasta: "",
      origen: "todos",
      nombreFantasia: "",
      destinoDireccion: "",
      nombreDestinatario: "",
      zonasEntrega: "todos",
      trackings: "",
    })
  }

  const handleToggleSelect = (envioId: number) => {
    setSelectedEnvios((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(envioId)) {
        newSet.delete(envioId)
      } else {
        newSet.add(envioId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedEnvios.size === filteredEnvios.length) {
      setSelectedEnvios(new Set())
    } else {
      setSelectedEnvios(new Set(filteredEnvios.map((envio) => envio.id)))
    }
  }

  const formatFecha = (fechaISO: string) => {
    const fecha = new Date(fechaISO)
    const dia = fecha.getDate().toString().padStart(2, "0")
    const mes = (fecha.getMonth() + 1).toString().padStart(2, "0")
    const año = fecha.getFullYear()
    const horas = fecha.getHours().toString().padStart(2, "0")
    const minutos = fecha.getMinutes().toString().padStart(2, "0")
    return `${dia}/${mes}/${año} ${horas}:${minutos}`
  }

  const handleReimprimirA4 = async (envioIds: number[]) => {
    try {
      const enviosAReimprimir = envios.filter((envio) => envioIds.includes(envio.id))

      if (enviosAReimprimir.length === 0) {
        return
      }

      const a4Width = 595.28
      const a4Height = 841.89
      const margin = 6
      const gap = 4
      const labelWidth = (a4Width - margin * 2 - gap) / 2
      const labelHeight = (a4Height - margin * 2 - gap * 2) / 3
      const labelsPerPage = 6

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      })

      let logoMvgDataUrl: string | null = null
      let iconCalendarDataUrl: string | null = null
      let iconUserDataUrl: string | null = null
      let iconFileTextDataUrl: string | null = null
      let iconPackageDataUrl: string | null = null
      let iconPhoneDataUrl: string | null = null
      let iconMapPinDataUrl: string | null = null
      let iconMailDataUrl: string | null = null
      let iconClienteDataUrl: string | null = null
      try {
        const assets = await getLabelIconDataUrls()
        logoMvgDataUrl = assets.logo || null
        iconCalendarDataUrl = assets.calendar || null
        iconUserDataUrl = assets.person || null
        iconClienteDataUrl = assets.business || null
        iconFileTextDataUrl = assets.document || null
        iconPackageDataUrl = assets.package || null
        iconPhoneDataUrl = assets.phone || null
        iconMapPinDataUrl = assets.location || null
        iconMailDataUrl = assets.mail || null
      } catch (e) {
        warnDev("Error generando logo/íconos para PDF:", e)
      }

      const iconSizePdf = 14

      const drawIconCalendar = (cx: number, cy: number) => {
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
      const drawIconPerson = (cx: number, cy: number) => {
        pdf.setFillColor(0, 0, 0)
        pdf.circle(cx, cy - 2.2, 3.4, "F")
        pdf.circle(cx, cy + 3.4, 4.2, "F")
      }
      const drawIconDoc = (cx: number, cy: number) => {
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.5)
        pdf.roundedRect(cx - 2.6, cy - 3.2, 5.2, 6.4, 0.5, 0.5, "S")
        pdf.line(cx - 1.8, cy - 1.6, cx + 1.8, cy - 1.6)
        pdf.line(cx - 1.8, cy + 0.2, cx + 1.6, cy + 0.2)
        pdf.line(cx - 1.8, cy + 1.9, cx + 1.4, cy + 1.9)
      }
      const drawIconBusiness = (cx: number, cy: number) => {
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.45)
        pdf.line(cx - 2.5, cy + 2.2, cx, cy - 2)
        pdf.line(cx, cy - 2, cx + 2.5, cy + 2.2)
        pdf.line(cx + 2.5, cy + 2.2, cx - 2.5, cy + 2.2)
        pdf.rect(cx - 2.2, cy - 0.5, 1.2, 1.8, "S")
        pdf.rect(cx + 0.2, cy - 0.5, 1.2, 1.8, "S")
      }
      const drawIconPhone = (cx: number, cy: number) => {
        pdf.setFillColor(0, 0, 0)
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.4)
        const r = 2.2
        pdf.circle(cx, cy - 2.8, r, "F")
        pdf.circle(cx, cy + 2.8, r, "F")
        pdf.roundedRect(cx - 1.3, cy - 1.1, 2.6, 2.2, 0.8, 0.8, "F")
      }
      const drawIconPackage = (cx: number, cy: number) => {
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.85)
        pdf.rect(cx - 3.8, cy - 2.6, 7.6, 5.2, "S")
        pdf.line(cx - 3.8, cy - 2.6, cx + 3.8, cy + 2.6)
        pdf.line(cx + 3.8, cy - 2.6, cx - 3.8, cy + 2.6)
      }
      const drawIconPin = (cx: number, cy: number) => {
        pdf.setFillColor(0, 0, 0)
        pdf.circle(cx, cy - 1.6, 3.2, "F")
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(1)
        pdf.line(cx, cy + 1.9, cx, cy + 7.2)
      }
      const drawIconMail = (cx: number, cy: number) => {
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.5)
        const w = 4.8
        const h = 3.6
        pdf.rect(cx - w / 2, cy - h / 2 + 0.5, w, h, "S")
        pdf.line(cx - w / 2, cy - h / 2 + 0.5, cx, cy - h / 2 - 0.5)
        pdf.line(cx, cy - h / 2 - 0.5, cx + w / 2, cy - h / 2 + 0.5)
      }
      const drawIconCircle = (cx: number, cy: number) => {
        pdf.setFillColor(0, 0, 0)
        pdf.circle(cx, cy, 2.8, "F")
      }

      for (let i = 0; i < enviosAReimprimir.length; i++) {
        const envio = enviosAReimprimir[i]
        const labelIndexInPage = i % labelsPerPage
        if (i > 0 && labelIndexInPage === 0) pdf.addPage()

        const col = labelIndexInPage % 2
        const row = Math.floor(labelIndexInPage / 2)
        const startX = margin + col * (labelWidth + gap)
        const startY = margin + row * (labelHeight + gap)

        const addIcon = (
          dataUrl: string | null,
          cx: number,
          cy: number,
          drawFallback: () => void
        ) => {
          if (dataUrl) {
            const w = iconSizePdf
            const h = iconSizePdf
            try {
              pdf.addImage(dataUrl, "PNG", cx - w / 2, cy - h / 2, w, h)
              return
            } catch {
              // fallback si addImage falla
            }
          }
          drawFallback()
        }

        const qrDataToUse = envio.qrData || `${envio.tracking}-${envio.id}`
        const qrCodeDataUrl = await QRCode.toDataURL(qrDataToUse, { width: 64, margin: 1 })

        const fecha = new Date(envio.fecha)
        const fechaFormateada = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`

        const pad = 6
        const qrSize = 48
        const lineH = 11
        const lineGap = 7
        const iconTextOffset = 40
        let y = startY

        // 1) Barra negra con zona
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

        // 2) Recuadro al QR + imagen
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
        addIcon(iconCalendarDataUrl, iconX, infoY - 0.5, () => drawIconCalendar(iconX, infoY - 0.5))
        pdf.text(fechaFormateada, qrRight + iconTextOffset, infoY)
        infoY += lineH + lineGap
        addIcon(iconClienteDataUrl, iconX, infoY - 0.5, () => drawIconBusiness(iconX, infoY - 0.5))
        const clienteShort = (envio.cliente || "").length > 24 ? (envio.cliente || "").slice(0, 23) + "…" : (envio.cliente || "")
        pdf.text(`Cliente: ${clienteShort}`, qrRight + iconTextOffset, infoY)
        infoY += lineH + lineGap
        addIcon(iconFileTextDataUrl, iconX, infoY - 0.5, () => drawIconDoc(iconX, infoY - 0.5))
        pdf.setFont("helvetica", "normal")
        pdf.text("Venta: ", qrRight + iconTextOffset, infoY)
        pdf.setFont("helvetica", "bold")
        pdf.text(getOrigenVentaLabel(envio.origen), qrRight + iconTextOffset + pdf.getTextWidth("Venta: "), infoY)
        infoY += lineH + lineGap
        pdf.setFont("helvetica", "normal")
        addIcon(iconPackageDataUrl, iconX, infoY - 0.5, () => drawIconPackage(iconX, infoY - 0.5))
        pdf.text("Envio: ", qrRight + iconTextOffset, infoY)
        pdf.setFont("helvetica", "bold")
        pdf.text(String(envio.tracking || envio.id), qrRight + iconTextOffset + pdf.getTextWidth("Envio: "), infoY)
        y = infoY + 14

        // 3) Línea separadora (bajada para que el ícono de Envio no la sobrepase)
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

        // 4) Destinatario: más espacio entre ícono y texto para que no se solapen
        const destIconX = startX + pad + 6
        const destTextX = startX + pad + 48
        const destTextW = labelWidth - pad * 2 - 54
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "bold")
        pdf.text("Destinatario", startX + pad, y)
        y += lineH + 8
        addIcon(iconUserDataUrl, destIconX, y - 0.5, () => drawIconPerson(destIconX, y - 0.5))
        pdf.setFont("helvetica", "bold")
        const nomLines = pdf.splitTextToSize(envio.nombreDestinatario || "", destTextW)
        pdf.text(nomLines, destTextX, y)
        y += nomLines.length * (lineH + 3) + 6
        pdf.setFont("helvetica", "normal")
        addIcon(iconPhoneDataUrl, destIconX, y - 0.5, () => drawIconPhone(destIconX, y - 0.5))
        pdf.text(String(envio.telefono || ""), destTextX, y)
        y += lineH + lineGap
        addIcon(iconMapPinDataUrl, destIconX, y - 0.5, () => drawIconPin(destIconX, y - 0.5))
        pdf.setFont("helvetica", "normal")
        const dirLines = pdf.splitTextToSize(envio.direccion || "", destTextW)
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

        // 5) Logo MVG: dentro del recuadro gris, abajo a la derecha (sin pisar)
        const logoBoxW = 36
        const logoBoxH = 36
        const logoBoxX = startX + labelWidth - pad - logoBoxW - 6
        const logoY = destSectionBottom - logoBoxH - 6
        let logoDrawn = false
        if (logoMvgDataUrl) {
          try {
            pdf.addImage(logoMvgDataUrl, "PNG", logoBoxX, logoY - 2, logoBoxW, logoBoxH)
            logoDrawn = true
          } catch {
            // fallback abajo
          }
        }
        if (!logoDrawn) {
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

        // Borde
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.25)
        pdf.rect(startX, startY, labelWidth, labelHeight)
      }

      // Descargar PDF
      const fechaDescarga = new Date().toISOString().split("T")[0]
      // Construir nombre con tracking(s)
      let nombreArchivo: string
      if (enviosAReimprimir.length === 1) {
        nombreArchivo = `reimpresion-A4-${enviosAReimprimir[0].tracking || "sin-tracking"}-${fechaDescarga}.pdf`
      } else {
        const primerTracking = enviosAReimprimir[0].tracking || "sin-tracking"
        const ultimoTracking = enviosAReimprimir[enviosAReimprimir.length - 1].tracking || "sin-tracking"
        nombreArchivo = `reimpresion-A4-${primerTracking}-${ultimoTracking}-${fechaDescarga}.pdf`
      }
      pdf.save(nombreArchivo)

      // Actualizar estado "Impreso" a "SI" para los envíos reimpresos
      const enviosActualizados = envios.map((envio) => {
        if (envioIds.includes(envio.id)) {
          return { ...envio, impreso: "SI" }
        }
        return envio
      })

      setEnvios(enviosActualizados)
      localStorage.setItem("enviosNoflex", JSON.stringify(enviosActualizados))

      // Limpiar selección
      setSelectedEnvios(new Set())
    } catch (error) {
      errorDev("Error al reimprimir A4:", error)
      alert("Error al reimprimir el PDF A4. Por favor, intente nuevamente.")
    }
  }

  /** Etiqueta de origen para "Venta": Meli, Shopify, VTEX, Tienda Nube o Venta x afuera (directo). */
  const getOrigenVentaLabel = (origen: string): string => {
    if (!origen || !String(origen).trim()) return "Venta x afuera"
    const o = String(origen).trim()
    if (o === "Flex" || o === "MercadoLibre" || /meli|mercado|flex/i.test(o)) return "Meli"
    if (o === "Shopify") return "Shopify"
    if (o === "VTEX" || o === "Vtex") return "VTEX"
    if (o === "Tienda Nube") return "Tienda Nube"
    return "Venta x afuera"
  }

  const handleReimprimir = async (envioIds: number[], formato: "10x15" | "10x10") => {
    try {
      const enviosAReimprimir = envios.filter((envio) => envioIds.includes(envio.id))

      if (enviosAReimprimir.length === 0) {
        return
      }

      let iconAssets: Awaited<ReturnType<typeof getLabelIconDataUrls>> | null = null
      try {
        iconAssets = await getLabelIconDataUrls()
      } catch {
        warnDev("No se pudieron cargar íconos para 10x15/10x10")
      }

      // Determinar dimensiones según el formato
      let width: number, height: number
      if (formato === "10x15") {
        width = 283.46 // 10cm en puntos
        height = 425.2 // 15cm en puntos
      } else {
        // 10x10
        width = 283.46 // 10cm en puntos
        height = 283.46 // 10cm en puntos
      }

      // Crear un solo PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [width, height],
      })

      const iconSz = formato === "10x15" ? 12 : 10
      const bulletR = 1.4
      const addIcon = (dataUrl: string | null, cx: number, cy: number) => {
        if (dataUrl) {
          try {
            pdf.addImage(dataUrl, "PNG", cx - iconSz / 2, cy - iconSz / 2, iconSz, iconSz)
            return
          } catch {
            // fallback a bullet
          }
        }
        pdf.setFillColor(0, 0, 0)
        pdf.circle(cx, cy, bulletR, "F")
      }

      // Procesar cada envío y agregarlo como una página
      for (let i = 0; i < enviosAReimprimir.length; i++) {
        const envio = enviosAReimprimir[i]

        // Si no es la primera página, agregar una nueva página
        if (i > 0) {
          pdf.addPage([width, height], "portrait")
        }

        // Generar QR usando el mismo QR data guardado, o generar uno nuevo si no existe
        const qrDataToUse = envio.qrData || `${envio.tracking}-${envio.id}`
        const qrCodeDataUrl = await QRCode.toDataURL(qrDataToUse, {
          width: 120,
          margin: 1,
        })

        // Obtener fecha de carga formateada
        const fecha = new Date(envio.fecha)
        const fechaFormateada = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`

        const marginLeft = 18
        const marginRight = 18
        const marginTop = 14
        const bulletR = 1.4
        const bulletX = marginLeft + bulletR + 1
        let currentY = marginTop

        // Título MVG (barra negra superior)
        const barMvgHeight = 20
        pdf.setFillColor(0, 0, 0)
        pdf.rect(0, currentY - 8, width, barMvgHeight, "F")
        pdf.setFontSize(14)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(255, 255, 255)
        const titleWidth = pdf.getTextWidth("MVG")
        pdf.text("MVG", (width - titleWidth) / 2, currentY)
        pdf.setTextColor(0, 0, 0)
        currentY += barMvgHeight + 6

        // Barra negra con zona (CABA)
        const barHeight = 20
        pdf.setFillColor(0, 0, 0)
        pdf.rect(0, currentY - 8, width, barHeight, "F")
        const zonaText = (envio.localidad || "Sin zona").toUpperCase()
        pdf.setFontSize(formato === "10x15" ? 12 : 11)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(255, 255, 255)
        const zonaW = pdf.getTextWidth(zonaText)
        pdf.text(zonaText, (width - zonaW) / 2, currentY + 6)
        pdf.setTextColor(0, 0, 0)
        currentY += barHeight + 14

        // QR Code
        const qrSize = formato === "10x15" ? 72 : 62
        const qrX = marginLeft
        const qrY = currentY
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(1)
        pdf.roundedRect(qrX, qrY, qrSize, qrSize, 2, 2, "S")
        pdf.addImage(qrCodeDataUrl, "PNG", qrX + 2, qrY + 2, qrSize - 4, qrSize - 4)
        const qrRight = qrX + qrSize + 12
        const qrBottom = qrY + qrSize
        const iconX = qrRight - 2

        // Bloque datos: íconos nuevos en lugar de bullets (mismo layout que antes)
        const infoLineH = formato === "10x15" ? 11 : 10
        let infoY = currentY + 4
        pdf.setFontSize(formato === "10x15" ? 7.5 : 7)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(0, 0, 0)
        addIcon(iconAssets?.calendar ?? null, iconX, infoY - 1.8)
        pdf.text(fechaFormateada, qrRight + 2, infoY)
        infoY += infoLineH
        addIcon(iconAssets?.business ?? null, iconX, infoY - 1.8)
        const clienteText = `Cliente: ${envio.cliente || ""}`
        const clienteLines = pdf.splitTextToSize(clienteText, width - qrRight - marginRight - 8)
        pdf.text(clienteLines, qrRight + 2, infoY)
        infoY += clienteLines.length * infoLineH
        addIcon(iconAssets?.document ?? null, iconX, infoY - 1.8)
        pdf.text(`Venta: ${getOrigenVentaLabel(envio.origen)}`, qrRight + 2, infoY)
        infoY += infoLineH
        addIcon(iconAssets?.package ?? null, iconX, infoY - 1.8)
        pdf.text(`Envio: ${envio.tracking || String(envio.id)}`, qrRight + 2, infoY)

        currentY = qrBottom + 14
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.5)
        pdf.line(marginLeft, currentY, width - marginRight, currentY)
        currentY += 14

        // Sección Destinatario (íconos en lugar de bullets)
        pdf.setFontSize(formato === "10x15" ? 7.5 : 7)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        pdf.text("Destinatario", marginLeft, currentY)
        const destinatarioWidth = pdf.getTextWidth("Destinatario")
        pdf.setLineWidth(0.4)
        pdf.line(marginLeft, currentY + 2, marginLeft + destinatarioWidth, currentY + 2)
        currentY += 14

        const destIconX = marginLeft + bulletR + 1
        addIcon(iconAssets?.person ?? null, destIconX, currentY - 2)
        pdf.setFontSize(formato === "10x15" ? 10 : 9)
        pdf.setFont("helvetica", "bold")
        const nombreLines = pdf.splitTextToSize(envio.nombreDestinatario, width - marginLeft * 2 - 24)
        pdf.text(nombreLines, bulletX + 4, currentY)
        currentY += nombreLines.length * (formato === "10x15" ? 12 : 11) + 6

        if (envio.telefono && envio.telefono !== "null") {
          addIcon(iconAssets?.phone ?? null, destIconX, currentY - 2)
          pdf.setFontSize(formato === "10x15" ? 8 : 7.5)
          pdf.setFont("helvetica", "normal")
          pdf.text(`Tel: ${envio.telefono}`, bulletX + 4, currentY)
          currentY += infoLineH + 2
        }

        addIcon(iconAssets?.location ?? null, destIconX, currentY - 2)
        pdf.setFontSize(formato === "10x15" ? 8 : 7.5)
        const direccionLines = pdf.splitTextToSize(envio.direccion, width - marginLeft * 2 - 24)
        pdf.text(direccionLines, bulletX + 4, currentY)
        currentY += direccionLines.length * (formato === "10x15" ? 11 : 10) + 8

        if (envio.observaciones) {
          pdf.setFontSize(formato === "10x15" ? 7.5 : 7)
          pdf.setFont("helvetica", "italic")
          const obsLines = pdf.splitTextToSize(`Obs: ${envio.observaciones}`, width - marginLeft * 2 - 24)
          pdf.text(obsLines, bulletX + 4, currentY)
          currentY += obsLines.length * (formato === "10x15" ? 10 : 9) + 6
          pdf.setFont("helvetica", "normal")
        }

        if (envio.totalACobrar && String(envio.totalACobrar).trim() !== "") {
          pdf.setFontSize(formato === "10x15" ? 8.5 : 8)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(0, 0, 0)
          pdf.text(`Cobrar en Efectivo: $ ${String(envio.totalACobrar).trim()}`, marginLeft, currentY)
          currentY += 14
        }

        if (envio.cambioRetiro && String(envio.cambioRetiro).trim() !== "") {
          const valor = String(envio.cambioRetiro).trim().toUpperCase()
          pdf.setFontSize(formato === "10x15" ? 9 : 8)
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

      // Descargar un solo PDF con todas las páginas
      const fechaDescarga = new Date().toISOString().split("T")[0]
      // Construir nombre con tracking(s)
      let nombreArchivo: string
      if (enviosAReimprimir.length === 1) {
        nombreArchivo = `reimpresion-${formato}-${enviosAReimprimir[0].tracking || "sin-tracking"}-${fechaDescarga}.pdf`
      } else {
        const primerTracking = enviosAReimprimir[0].tracking || "sin-tracking"
        const ultimoTracking = enviosAReimprimir[enviosAReimprimir.length - 1].tracking || "sin-tracking"
        nombreArchivo = `reimpresion-${formato}-${primerTracking}-${ultimoTracking}-${fechaDescarga}.pdf`
      }
      pdf.save(nombreArchivo)

      // Actualizar estado "Impreso" a "SI" para los envíos reimpresos
      const enviosActualizados = envios.map((envio) => {
        if (envioIds.includes(envio.id)) {
          return { ...envio, impreso: "SI" }
        }
        return envio
      })

      setEnvios(enviosActualizados)
      localStorage.setItem("enviosNoflex", JSON.stringify(enviosActualizados))

      // Limpiar selección
      setSelectedEnvios(new Set())
    } catch (error) {
      errorDev("Error al reimprimir:", error)
      alert("Error al reimprimir los PDFs. Por favor, intente nuevamente.")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50" suppressHydrationWarning>
      <ModernHeader />
      <main className="p-4">
        <div className="mx-auto max-w-7xl">

          {/* Main Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h1 className="text-xl font-bold text-[#6B46FF]">REIMPRESIÓN DE ETIQUETAS NOFLEX</h1>
              <Button
                onClick={loadEnvios}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? "Cargando..." : "Actualizar"}
              </Button>
            </div>

            {/* Filters */}
            <div className="p-4 space-y-4 border-b border-gray-200">
              {/* Row 1 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Tipo de fecha</label>
                  <Select
                    value={filters.tipoFecha}
                    onValueChange={(value) => handleFilterChange("tipoFecha", value)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fechaVenta">Fecha de venta</SelectItem>
                      <SelectItem value="fechaLlegue">Fecha Llegué</SelectItem>
                      <SelectItem value="fechaEntregado">Fecha entregado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Pendiente de imprimir</label>
                  <Select
                    value={filters.pendienteImprimir}
                    onValueChange={(value) => handleFilterChange("pendienteImprimir", value)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="si">Si</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Fecha desde</label>
                  <Input
                    type="date"
                    value={filters.fechaDesde}
                    onChange={(e) => handleFilterChange("fechaDesde", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Fecha hasta</label>
                  <Input
                    type="date"
                    value={filters.fechaHasta}
                    onChange={(e) => handleFilterChange("fechaHasta", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Origen</label>
                  <Select
                    value={filters.origen}
                    onValueChange={(value) => handleFilterChange("origen", value)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Directo">Directo</SelectItem>
                      <SelectItem value="Tienda Nube">Tienda Nube</SelectItem>
                      <SelectItem value="Shopify">Shopify</SelectItem>
                      <SelectItem value="Vtex">Vtex</SelectItem>
                      <SelectItem value="Mercado Libre">Mercado Libre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Nombre fantasía</label>
                  <Input
                    value={filters.nombreFantasia}
                    onChange={(e) => handleFilterChange("nombreFantasia", e.target.value)}
                    placeholder="Nombre fantasía"
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Destino dirección</label>
                  <Input
                    value={filters.destinoDireccion}
                    onChange={(e) => handleFilterChange("destinoDireccion", e.target.value)}
                    placeholder="Destino dirección"
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Nombre destinatario</label>
                  <Input
                    value={filters.nombreDestinatario}
                    onChange={(e) => handleFilterChange("nombreDestinatario", e.target.value)}
                    placeholder="Nombre destinatario"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Zonas de entrega</label>
                  <Select
                    value={filters.zonasEntrega}
                    onValueChange={(value) => handleFilterChange("zonasEntrega", value)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Todas las zonas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="CABA">CABA</SelectItem>
                      <SelectItem value="Zona 1">Zona 1</SelectItem>
                      <SelectItem value="Zona 2">Zona 2</SelectItem>
                      <SelectItem value="Zona 3">Zona 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 col-span-3">
                  <label className="block text-xs font-medium text-gray-700">Trackings</label>
                  <textarea
                    value={filters.trackings}
                    onChange={(e) => handleFilterChange("trackings", e.target.value)}
                    placeholder="Lista de Trackings separados por comas (Ejemplo: 100,101,102)"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6B46FF] focus:border-transparent resize-none"
                    rows={2}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={loadEnvios}
                  disabled={isLoading}
                  className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-8 px-4"
                >
                  FILTRAR
                </Button>
                <Button
                  onClick={handleClearFilters}
                  variant="outline"
                  className="border-orange-500 text-orange-500 hover:bg-orange-50 h-8 px-4"
                >
                  LIMPIAR
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Tracking</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Cliente</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Dirección</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Nombre destinatario</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Teléfono</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Impreso</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Imprimir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Calcular envíos paginados
                      const startIndex = currentPage * itemsPerPage
                      const endIndex = startIndex + itemsPerPage
                      const paginatedEnvios = filteredEnvios.slice(startIndex, endIndex)

                      if (filteredEnvios.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">
                              No hay envíos para mostrar
                            </td>
                          </tr>
                        )
                      }

                      return paginatedEnvios.map((envio) => (
                        <tr
                          key={envio.id}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-3 py-2 text-sm text-gray-900">{formatFecha(envio.fecha)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{envio.tracking}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{envio.cliente}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{envio.direccion}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{envio.nombreDestinatario}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{envio.telefono}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{envio.impreso}</td>
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={selectedEnvios.has(envio.id)}
                              onCheckedChange={() => handleToggleSelect(envio.id)}
                            />
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredEnvios.length > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700">
                    Total de registros: <span className="text-[#6B46FF] font-bold">{filteredEnvios.length}</span>
                    {" | "}
                    Mostrando: <span className="text-[#6B46FF] font-bold">
                      {Math.min(currentPage * itemsPerPage + 1, filteredEnvios.length)} - {Math.min((currentPage + 1) * itemsPerPage, filteredEnvios.length)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(0)}
                      disabled={currentPage === 0}
                      className="h-8"
                    >
                      {"<<"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                      disabled={currentPage === 0}
                      className="h-8"
                    >
                      {"<"}
                    </Button>
                    {Array.from({ length: Math.min(5, Math.ceil(filteredEnvios.length / itemsPerPage)) }, (_, i) => {
                      const totalPages = Math.ceil(filteredEnvios.length / itemsPerPage)
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i
                      } else if (currentPage <= 2) {
                        pageNum = i
                      } else if (currentPage >= totalPages - 3) {
                        pageNum = totalPages - 5 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      if (pageNum >= totalPages) return null
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-8 ${
                            currentPage === pageNum
                              ? "bg-[#6B46FF] hover:bg-[#5a3ae6] text-white"
                              : ""
                          }`}
                        >
                          {pageNum + 1}
                        </Button>
                      )
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(filteredEnvios.length / itemsPerPage) - 1, prev + 1))}
                      disabled={currentPage >= Math.ceil(filteredEnvios.length / itemsPerPage) - 1}
                      className="h-8"
                    >
                      {">"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.ceil(filteredEnvios.length / itemsPerPage) - 1)}
                      disabled={currentPage >= Math.ceil(filteredEnvios.length / itemsPerPage) - 1}
                      className="h-8"
                    >
                      {">>"}
                    </Button>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value))
                        setCurrentPage(0)
                      }}
                    >
                      <SelectTrigger className="h-8 w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with selection count and print buttons */}
            <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Seleccionaste {selectedEnvios.size} de {filteredEnvios.length} Paquetes
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleReimprimirA4(Array.from(selectedEnvios))}
                  className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-8 px-4"
                  disabled={selectedEnvios.size === 0}
                >
                  REIMPRIMIR (A4)
                </Button>
                <Button
                  onClick={() => handleReimprimir(Array.from(selectedEnvios), "10x15")}
                  className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-8 px-4"
                  disabled={selectedEnvios.size === 0}
                >
                  REIMPRIMIR (10X15)
                </Button>
                <Button
                  onClick={() => handleReimprimir(Array.from(selectedEnvios), "10x10")}
                  className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-8 px-4"
                  disabled={selectedEnvios.size === 0}
                >
                  REIMPRIMIR (10X10)
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

