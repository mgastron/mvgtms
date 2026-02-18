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

    // Cargar envíos desde el backend primero
    loadEnvios()
  }, [router, userProfile, userCodigoCliente])

  // Función para cargar envíos desde el backend
  const loadEnvios = async () => {
    setIsLoading(true)
    try {
      const apiBaseUrl = getApiBaseUrl()
      const params = new URLSearchParams({
        page: "0",
        size: "1000", // Cargar muchos para reimprimir
        estado: "todos", // Todos los estados excepto eliminados
        origen: "todos", // Todos los orígenes excepto Flex
      })

      // Si el usuario es Cliente, agregar filtro de código de cliente
      if (userProfile === "Cliente" && userCodigoCliente) {
        params.append("codigoCliente", userCodigoCliente)
      }

      const response = await fetch(`${apiBaseUrl}/envios?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        if (data.content && data.content.length > 0) {
          // Convertir y filtrar envíos (excluir Flex y eliminados)
          const enviosFormateados = data.content
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
              qrData: envio.qrData || envio.tracking, // Usar tracking como fallback si no hay qrData
            }))
          setEnvios(enviosFormateados)
          setFilteredEnvios(enviosFormateados)
        } else {
          // Si el backend no tiene datos, intentar localStorage
          warnDev("Backend no tiene datos, usando localStorage")
          const enviosGuardados = JSON.parse(localStorage.getItem("enviosNoflex") || "[]")
          const enviosSinFlex = enviosGuardados.filter((envio: EnvioNoflex) => envio.origen !== "Flex")
          setEnvios(enviosSinFlex)
          setFilteredEnvios(enviosSinFlex)
        }
      } else {
        throw new Error("Error al cargar envíos desde el backend")
      }
    } catch (error) {
      warnDev("Error al cargar desde backend, usando localStorage:", error)
      // Fallback a localStorage
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

      // Formato A4 en puntos (595.28 x 841.89)
      const a4Width = 595.28
      const a4Height = 841.89
      const margin = 5
      const padding = 3

      // Dimensiones de cada etiqueta compacta - aprovechar mejor el espacio
      const labelWidth = (a4Width - margin * 2 - padding) / 2 // 2 columnas
      const labelHeight = (a4Height - margin * 2 - padding * 2) / 3 // 3 filas
      const labelsPerPage = 6 // 2 columnas x 3 filas

      // Crear PDF A4
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      })

      // Procesar cada envío
      for (let i = 0; i < enviosAReimprimir.length; i++) {
        const envio = enviosAReimprimir[i]
        const pageIndex = Math.floor(i / labelsPerPage)
        const labelIndexInPage = i % labelsPerPage

        // Agregar nueva página si es necesario
        if (i > 0 && labelIndexInPage === 0) {
          pdf.addPage()
        }

        // Calcular posición de la etiqueta en la página
        const col = labelIndexInPage % 2 // 0 o 1
        const row = Math.floor(labelIndexInPage / 2) // 0, 1 o 2

        const startX = margin + col * (labelWidth + padding)
        const startY = margin + row * (labelHeight + padding)

        // Generar QR usando el mismo QR data guardado
        const qrDataToUse = envio.qrData || `${envio.tracking}-${envio.id}`
        const qrCodeDataUrl = await QRCode.toDataURL(qrDataToUse, {
          width: 80,
          margin: 1,
        })

        // Obtener fecha formateada
        const fecha = new Date(envio.fecha)
        const fechaFormateada = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`

        // Calcular espacio disponible y distribuir mejor el contenido
        const innerPadding = 4
        let currentY = startY + innerPadding

        // Localidad con fondo violeta (arriba a la izquierda)
        const localidadText = (envio.localidad || "Sin localidad").toUpperCase()
        pdf.setFontSize(13)
        pdf.setFont("helvetica", "bold")
        
        // Fondo violeta para localidad
        const localidadTextWidth = pdf.getTextWidth(localidadText)
        const localidadBoxHeight = 16
        pdf.setFillColor(124, 58, 237) // Violeta
        pdf.setDrawColor(124, 58, 237)
        pdf.roundedRect(startX + innerPadding, currentY - 12, localidadTextWidth + 8, localidadBoxHeight, 2, 2, "F")
        
        pdf.setTextColor(255, 255, 255) // Texto blanco
        pdf.text(localidadText, startX + innerPadding + 4, currentY - 2)
        
        // Nombre destinatario a la derecha (arriba a la derecha)
        pdf.setFontSize(7.5)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(0, 0, 0)
        const nombreDestinatario = envio.nombreDestinatario || ""
        const nombreWidth = pdf.getTextWidth(nombreDestinatario)
        const nombreX = startX + labelWidth - nombreWidth - innerPadding
        if (nombreX > startX + localidadTextWidth + innerPadding + 12) {
          pdf.text(nombreDestinatario, nombreX, currentY - 2)
        }
        currentY += 10

        // QR Code (izquierda) - tamaño ajustado
        const qrSize = 55
        const qrX = startX + innerPadding
        const qrY = currentY
        pdf.addImage(qrCodeDataUrl, "PNG", qrX, qrY, qrSize, qrSize)
        const qrRight = qrX + qrSize + 5
        const qrBottom = qrY + qrSize
        const availableWidth = labelWidth - qrSize - innerPadding * 3

        // Información a la derecha del QR
        pdf.setFontSize(7)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(40, 40, 40)
        let infoY = qrY + 3
        pdf.text(fechaFormateada, qrRight, infoY)
        infoY += 8
        const rteText = pdf.splitTextToSize(`Rte.: ${envio.cliente}`, availableWidth)
        pdf.text(rteText, qrRight, infoY)
        infoY += rteText.length * 8
        const ventaText = pdf.splitTextToSize(`Venta: ${envio.nombreDestinatario}`, availableWidth)
        pdf.text(ventaText, qrRight, infoY)
        infoY += ventaText.length * 8
        const envioText = pdf.splitTextToSize(`Envio: ${envio.nombreDestinatario}`, availableWidth)
        pdf.text(envioText, qrRight, infoY)

        // Calcular espacio restante y distribuir contenido inferior
        const bottomSectionStart = qrBottom + 6
        const bottomSectionHeight = labelHeight - (bottomSectionStart - startY) - innerPadding - 15 // 15 para logo
        const bottomY = bottomSectionStart

        // Información del destinatario (distribuida mejor)
        pdf.setFontSize(7)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(0, 0, 0)
        let destY = bottomY

        // Nombre destinatario
        pdf.setFont("helvetica", "bold")
        const nombreLines = pdf.splitTextToSize(envio.nombreDestinatario, labelWidth - innerPadding * 2)
        pdf.text(nombreLines, startX + innerPadding, destY)
        destY += nombreLines.length * 8 + 2

        // Teléfono
        pdf.setFont("helvetica", "normal")
        pdf.text(envio.telefono, startX + innerPadding, destY)
        destY += 8

        // Peso
        pdf.text("Sin información", startX + innerPadding, destY)
        destY += 8

        // Dirección
        const direccionLines = pdf.splitTextToSize(envio.direccion, labelWidth - innerPadding * 2)
        pdf.text(direccionLines, startX + innerPadding, destY)
        destY += direccionLines.length * 8 + 3

        // Observación
        if (envio.observaciones) {
          pdf.setFontSize(6.5)
          pdf.setTextColor(60, 60, 60)
          const obsLines = pdf.splitTextToSize(`Observación: ${envio.observaciones}`, labelWidth - innerPadding * 2)
          pdf.text(obsLines, startX + innerPadding, destY)
          destY += obsLines.length * 7.5 + 2
        }

        // Campos extra
        if (envio.cambioRetiro) {
          pdf.setFontSize(6)
          pdf.setTextColor(100, 100, 100)
          pdf.text("Campos extra", startX + innerPadding, destY)
          destY += 6
          pdf.setFontSize(7)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(0, 0, 0)
          const cambioRetiroLines = pdf.splitTextToSize(`Cambio / Retiro: ${envio.cambioRetiro}`, labelWidth - innerPadding * 2)
          pdf.text(cambioRetiroLines, startX + innerPadding, destY)
          destY += cambioRetiroLines.length * 7.5 + 2
        }

        // Logo ZETA LLEGUE (abajo a la derecha) con color
        const logoText = "ZETA LLEGUE"
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(124, 58, 237) // Violeta para el logo
        const logoWidth = pdf.getTextWidth(logoText)
        const logoX = startX + labelWidth - logoWidth - innerPadding
        const logoY = startY + labelHeight - innerPadding - 2
        pdf.text(logoText, logoX, logoY)

        // Borde de la etiqueta (para visualización)
        pdf.setDrawColor(200, 200, 200)
        pdf.setLineWidth(0.5)
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

  const handleReimprimir = async (envioIds: number[], formato: "10x15" | "10x10") => {
    try {
      const enviosAReimprimir = envios.filter((envio) => envioIds.includes(envio.id))

      if (enviosAReimprimir.length === 0) {
        return
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

        // Configuración de márgenes y posiciones (blanco y negro)
        const marginLeft = 12
        const marginTop = 12
        const marginRight = 12
        let currentY = marginTop
        
        // Título centrado (primero el texto)
        pdf.setFontSize(14)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        const titleWidth = pdf.getTextWidth("Zeta Llegue")
        const titleX = (width - titleWidth) / 2
        pdf.text("Zeta Llegue", titleX, currentY)
        
        // Línea superior (debajo del texto, no lo corta)
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(2)
        pdf.line(marginLeft, currentY - 12, width - marginRight, currentY - 12)
        
        // Línea inferior (debajo del título)
        currentY += 18
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(1)
        pdf.line(marginLeft, currentY - 3, width - marginRight, currentY - 3)
        currentY += 5

        // QR Code con borde negro
        const qrSize = formato === "10x15" ? 75 : 65
        const qrX = marginLeft
        const qrY = currentY
        
        // Borde del QR (negro, sin fondo)
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(1.5)
        pdf.roundedRect(qrX, qrY, qrSize, qrSize, 2, 2, "S")
        
        // QR Code
        pdf.addImage(qrCodeDataUrl, "PNG", qrX + 2, qrY + 2, qrSize - 4, qrSize - 4)
        
        const qrRight = qrX + qrSize + 10
        const qrBottom = qrY + qrSize

        // Localidad con borde (sin fondo de color)
        const localidadText = (envio.localidad || "Sin localidad").toUpperCase()
        pdf.setFontSize(formato === "10x15" ? 16 : 14)
        pdf.setFont("helvetica", "bold")

        // Calcular dimensiones del texto
        const localidadLines = pdf.splitTextToSize(localidadText, width - qrRight - marginRight - 8)
        const localidadTextWidth = Math.max(...localidadLines.map((line: string) => pdf.getTextWidth(line)))
        const lineHeight = formato === "10x15" ? 14 : 12
        const localidadTextHeight = localidadLines.length * lineHeight
        const padding = 8
        const boxWidth = Math.min(localidadTextWidth + (padding * 2), width - qrRight - marginRight - 8)
        const boxHeight = localidadTextHeight + (padding * 2)
        const boxX = qrRight
        const boxY = currentY
        const borderRadius = 3

        // Borde negro (sin relleno)
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(2)
        pdf.roundedRect(boxX, boxY, boxWidth, boxHeight, borderRadius, borderRadius, "S")

        // Texto en negro
        pdf.setTextColor(0, 0, 0)
        const totalTextHeight = localidadLines.length * lineHeight
        const startY = boxY + (boxHeight - totalTextHeight) / 2 + lineHeight - 2

        localidadLines.forEach((line: string, index: number) => {
          const lineWidth = pdf.getTextWidth(line)
          const textX = boxX + (boxWidth - lineWidth) / 2
          const textY = startY + (index * lineHeight)
          pdf.text(line, textX, textY)
        })

        // Información del envío con bullets negros
        let infoY = currentY + boxHeight + 10
        pdf.setFontSize(formato === "10x15" ? 7.5 : 6.5)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(0, 0, 0)
        
        // Fecha con bullet negro
        pdf.setFillColor(0, 0, 0)
        pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
        pdf.text(fechaFormateada, qrRight + 2, infoY)
        infoY += formato === "10x15" ? 10 : 9
        
        // Remitente
        pdf.setFillColor(0, 0, 0)
        pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
        const clienteText = `Rte.: ${envio.cliente}`
        const clienteLines = pdf.splitTextToSize(clienteText, width - qrRight - marginRight - 8)
        pdf.text(clienteLines, qrRight + 2, infoY)
        infoY += clienteLines.length * (formato === "10x15" ? 10 : 9)
        
        // Venta
        pdf.setFillColor(0, 0, 0)
        pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
        pdf.text(`Venta: ${envio.nombreDestinatario}`, qrRight + 2, infoY)
        infoY += formato === "10x15" ? 10 : 9
        
        // Envío
        pdf.setFillColor(0, 0, 0)
        pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
        pdf.text(`Envio: ${envio.nombreDestinatario}`, qrRight + 2, infoY)

        // Espacio después del bloque superior
        currentY = qrBottom + 12

        // Línea separadora negra
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(1)
        pdf.line(marginLeft, currentY, width - marginRight, currentY)
        currentY += 8

        // Sección Destinatario con subrayado
        pdf.setFontSize(formato === "10x15" ? 7 : 6)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        const destinatarioY = currentY
        pdf.text("DESTINATARIO", marginLeft, currentY)
        // Subrayado
        const destinatarioWidth = pdf.getTextWidth("DESTINATARIO")
        pdf.setLineWidth(0.5)
        pdf.line(marginLeft, currentY + 2, marginLeft + destinatarioWidth, currentY + 2)
        currentY += formato === "10x15" ? 10 : 9

        // Nombre destacado
        pdf.setFontSize(formato === "10x15" ? 9.5 : 8.5)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        const nombreLines = pdf.splitTextToSize(envio.nombreDestinatario, width - marginLeft * 2 - 20)
        pdf.text(nombreLines, marginLeft, currentY)
        currentY += nombreLines.length * (formato === "10x15" ? 11 : 10) + 3

        // Teléfono
        if (envio.telefono && envio.telefono !== "null") {
          pdf.setFontSize(formato === "10x15" ? 8 : 7)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(0, 0, 0)
          pdf.text(`Tel: ${envio.telefono}`, marginLeft, currentY)
          currentY += formato === "10x15" ? 10 : 9
        }

        // Dirección
        pdf.setFontSize(formato === "10x15" ? 8 : 7)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(0, 0, 0)
        const direccionLines = pdf.splitTextToSize(envio.direccion, width - marginLeft * 2 - 20)
        pdf.text(direccionLines, marginLeft, currentY)
        currentY += direccionLines.length * (formato === "10x15" ? 10 : 9) + 5

        // Observación
        if (envio.observaciones) {
          pdf.setFontSize(formato === "10x15" ? 7.5 : 6.5)
          pdf.setFont("helvetica", "italic")
          pdf.setTextColor(60, 60, 60)
          const obsLines = pdf.splitTextToSize(`Obs: ${envio.observaciones}`, width - marginLeft * 2 - 20)
          pdf.text(obsLines, marginLeft, currentY)
          currentY += obsLines.length * (formato === "10x15" ? 9 : 8) + 3
        }

        // Campos extra
        if (envio.cambioRetiro) {
          pdf.setFontSize(formato === "10x15" ? 7 : 6)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(0, 0, 0)
          const adicionalY = currentY
          pdf.text("INFORMACIÓN ADICIONAL", marginLeft, currentY)
          // Subrayado
          const adicionalWidth = pdf.getTextWidth("INFORMACIÓN ADICIONAL")
          pdf.setLineWidth(0.5)
          pdf.line(marginLeft, currentY + 2, marginLeft + adicionalWidth, currentY + 2)
          currentY += formato === "10x15" ? 9 : 8

          pdf.setFontSize(formato === "10x15" ? 8.5 : 7.5)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(0, 0, 0)
          const cambioRetiroLines = pdf.splitTextToSize(`Cambio/Retiro: ${envio.cambioRetiro}`, width - marginLeft * 2 - 20)
          pdf.text(cambioRetiroLines, marginLeft, currentY)
          currentY += cambioRetiroLines.length * (formato === "10x15" ? 10 : 9) + 5
        }

        // Footer con línea negra
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(2)
        pdf.line(marginLeft, currentY + 3, width - marginRight, currentY + 3)
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
                  onClick={() => {
                    // Los filtros se aplican automáticamente con useEffect
                  }}
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

