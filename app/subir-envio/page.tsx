"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Upload as UploadIcon } from "lucide-react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import QRCode from "qrcode"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev, errorDev } from "@/lib/logger"

interface Cliente {
  id: number
  codigo: string
  nombreFantasia: string
}

export default function SubirEnvioPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<string | null>(null)
  const [userCodigoCliente, setUserCodigoCliente] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [formData, setFormData] = useState({
    cliente: "",
    etiqueta: "A4",
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const profile = sessionStorage.getItem("userProfile")
    
    if (!isAuthenticated) {
      router.push("/")
      return
    }

    // Redirigir Chofer y Cliente
    if (profile === "Chofer") {
      router.push("/chofer")
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
            if (user && user.codigoCliente) {
              setUserCodigoCliente(user.codigoCliente)
              setFormData((prev) => ({ ...prev, cliente: user.codigoCliente }))
            }
          }
        } catch (error) {
          warnDev("Error al cargar usuario del backend:", error)
        }
      }
      loadUserInfo()
    }

    // Cargar clientes (solo si no es usuario Cliente o si es Cliente pero necesitamos cargar su cliente)
    if (profile !== "Cliente") {
      const loadClientes = async () => {
        try {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/clientes?size=1000`)
          if (response.ok) {
            const data = await response.json()
            if (data.content && data.content.length > 0) {
              setClientes(data.content.map((c: any) => ({
                id: c.id,
                codigo: c.codigo,
                nombreFantasia: c.nombreFantasia,
              })))
            }
          }
        } catch (error) {
          warnDev("Error al cargar clientes del backend:", error)
        }
      }
      loadClientes()
    } else {
      // Si es Cliente, cargar solo su cliente desde el backend
      const loadCliente = async () => {
        const username = sessionStorage.getItem("username")
        if (!username) return

        let codigoCliente: string | null = null

        try {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
          if (response.ok) {
            const data = await response.json()
            const content = data.content || []
            const user = content.find((u: any) => u.usuario === username)
            if (user && user.codigoCliente) codigoCliente = user.codigoCliente
          }
        } catch (error) {
          warnDev("Error al cargar usuario del backend:", error)
        }

        if (codigoCliente) {
          try {
            const apiBaseUrl = getApiBaseUrl()
            const response = await fetch(`${apiBaseUrl}/clientes?codigo=${codigoCliente}`)
            if (response.ok) {
              const data = await response.json()
              if (data.content && data.content.length > 0) {
                const cliente = data.content[0]
                setClientes([{
                  id: cliente.id,
                  codigo: cliente.codigo,
                  nombreFantasia: cliente.nombreFantasia,
                }])
                setFormData((prev) => ({ ...prev, cliente: cliente.codigo }))
              }
            }
          } catch (error) {
            warnDev("Error al cargar cliente del backend:", error)
          }
        }
      }
      loadCliente()
    }
  }, [router])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleDescargarModelo = () => {
    // Crear workbook
    const wb = XLSX.utils.book_new()
    
    // Encabezados
    const headers = [
      "Numero de tracking",
      "Destinatario",
      "Teléfono de contacto",
      "Direccion",
      "Localidad",
      "Código Postal",
      "Observaciones",
      "Total a cobrar",
      "Cambio/retiro"
    ]
    
    // Crear datos con encabezados y 100 filas vacías
    const data = [headers]
    for (let i = 0; i < 100; i++) {
      data.push(["", "", "", "", "", "", "", "", ""])
    }
    
    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet(data)
    
    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, "Envios")
    
    // Descargar archivo
    XLSX.writeFile(wb, "modelo_envios.xlsx")
  }

  const generatePDFForEnvio = async (
    envio: any,
    formato: "A4" | "10x15" | "10x10",
    pdf: jsPDF,
    labelIndex: number,
    labelsPerPage: number
  ) => {
    // Generar QR
    const qrDataToUse = envio.qrData || `${envio.tracking}-${Date.now()}`
    const qrCodeDataUrl = await QRCode.toDataURL(qrDataToUse, {
      width: formato === "A4" ? 80 : 120,
      margin: 1,
    })

    // Obtener fecha
    const fecha = new Date(envio.fecha)
    const fechaFormateada = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`

    if (formato === "A4") {
      // Formato A4 compacto
      const a4Width = 595.28
      const a4Height = 841.89
      const margin = 5
      const padding = 3
      const labelWidth = (a4Width - margin * 2 - padding) / 2
      const labelHeight = (a4Height - margin * 2 - padding * 2) / 3
      
      const col = labelIndex % 2
      const row = Math.floor(labelIndex / 2)
      const startX = margin + col * (labelWidth + padding)
      const startY = margin + row * (labelHeight + padding)
      
      let currentY = startY + 3
      const innerPadding = 4

      // Localidad con fondo violeta
      const localidadText = (envio.localidad || "Sin localidad").toUpperCase()
      pdf.setFontSize(13)
      pdf.setFont("helvetica", "bold")
      const localidadTextWidth = pdf.getTextWidth(localidadText)
      const localidadBoxHeight = 16
      pdf.setFillColor(124, 58, 237)
      pdf.setDrawColor(124, 58, 237)
      pdf.roundedRect(startX + innerPadding, currentY - 12, localidadTextWidth + 8, localidadBoxHeight, 2, 2, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.text(localidadText, startX + innerPadding + 4, currentY - 2)
      
      pdf.setFontSize(7.5)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(0, 0, 0)
      const nombreWidth = pdf.getTextWidth(envio.nombreDestinatario)
      const nombreX = startX + labelWidth - nombreWidth - innerPadding
      if (nombreX > startX + localidadTextWidth + innerPadding + 12) {
        pdf.text(envio.nombreDestinatario, nombreX, currentY - 2)
      }
      currentY += 10

      // QR Code
      const qrSize = 50
      const qrX = startX + innerPadding
      const qrY = currentY
      pdf.addImage(qrCodeDataUrl, "PNG", qrX, qrY, qrSize, qrSize)
      const qrRight = qrX + qrSize + 4
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

      const bottomY = qrBottom + 6
      pdf.setFontSize(7)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(0, 0, 0)
      let destY = bottomY

      pdf.setFont("helvetica", "bold")
      const nombreLines = pdf.splitTextToSize(envio.nombreDestinatario, labelWidth - innerPadding * 2)
      pdf.text(nombreLines, startX + innerPadding, destY)
      destY += nombreLines.length * 8 + 2

      pdf.setFont("helvetica", "normal")
      pdf.text(envio.telefono, startX + innerPadding, destY)
      destY += 8

      pdf.text("Sin información", startX + innerPadding, destY)
      destY += 8

      const direccionLines = pdf.splitTextToSize(envio.direccion, labelWidth - innerPadding * 2)
      pdf.text(direccionLines, startX + innerPadding, destY)
      destY += direccionLines.length * 8 + 3

      if (envio.observaciones) {
        pdf.setFontSize(6.5)
        pdf.setTextColor(60, 60, 60)
        const obsLines = pdf.splitTextToSize(`Observación: ${envio.observaciones}`, labelWidth - innerPadding * 2)
        pdf.text(obsLines, startX + innerPadding, destY)
        destY += obsLines.length * 7.5 + 2
      }

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

      const logoText = "ZETA LLEGUE"
      pdf.setFontSize(8.5)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(124, 58, 237)
      const logoWidth = pdf.getTextWidth(logoText)
      const logoX = startX + labelWidth - logoWidth - innerPadding
      const logoY = startY + labelHeight - innerPadding - 2
      pdf.text(logoText, logoX, logoY)

      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(startX, startY, labelWidth, labelHeight)
    } else {
      // Formato 10x15 o 10x10
      let width: number, height: number
      if (formato === "10x15") {
        width = 283.46
        height = 425.2
      } else {
        width = 283.46
        height = 283.46
      }

      const marginLeft = 10
      const marginTop = 10
      let currentY = marginTop

      pdf.setFontSize(12)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 0, 0)
      const titleWidth = pdf.getTextWidth("Zeta Llegue")
      const titleX = (width - titleWidth) / 2
      pdf.text("Zeta Llegue", titleX, currentY)
      currentY += 18

      pdf.setDrawColor(124, 58, 237)
      pdf.setLineWidth(1.5)
      pdf.line(marginLeft, currentY - 8, width - marginLeft, currentY - 8)

      const qrSize = formato === "10x15" ? 80 : 70
      pdf.addImage(qrCodeDataUrl, "PNG", marginLeft, currentY, qrSize, qrSize)
      const qrRight = marginLeft + qrSize + 6
      const qrBottom = currentY + qrSize

      const localidadText = (envio.localidad || "Sin localidad").toUpperCase()
      pdf.setFontSize(formato === "10x15" ? 15 : 13)
      pdf.setFont("helvetica", "bold")

      const localidadLines = pdf.splitTextToSize(localidadText, 150)
      const localidadTextWidth = Math.max(...localidadLines.map((line: string) => pdf.getTextWidth(line)))
      const lineHeight = formato === "10x15" ? 13 : 11
      const localidadTextHeight = localidadLines.length * lineHeight
      const padding = 6
      const boxWidth = localidadTextWidth + (padding * 2)
      const boxHeight = localidadTextHeight + (padding * 2)
      const boxX = qrRight
      const boxY = currentY + 6
      const borderRadius = 3

      pdf.setFillColor(124, 58, 237)
      pdf.setDrawColor(124, 58, 237)
      pdf.setLineWidth(0)
      pdf.roundedRect(boxX, boxY, boxWidth, boxHeight, borderRadius, borderRadius, "F")

      pdf.setTextColor(255, 255, 255)
      const totalTextHeight = localidadLines.length * lineHeight
      const startY = boxY + (boxHeight - totalTextHeight) / 2 + lineHeight - 2

      localidadLines.forEach((line: string, index: number) => {
        const lineWidth = pdf.getTextWidth(line)
        const textX = boxX + (boxWidth - lineWidth) / 2
        const textY = startY + (index * lineHeight)
        pdf.text(line, textX, textY)
      })

      let infoY = currentY + boxHeight + 12
      pdf.setFontSize(formato === "10x15" ? 7 : 6)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(40, 40, 40)
      pdf.text(fechaFormateada, qrRight, infoY)
      infoY += formato === "10x15" ? 9 : 8
      pdf.text(`Rte.: ${envio.cliente}`, qrRight, infoY)
      infoY += formato === "10x15" ? 9 : 8
      pdf.text(`Venta: ${envio.nombreDestinatario}`, qrRight, infoY)
      infoY += formato === "10x15" ? 9 : 8
      pdf.text(`Envio: ${envio.nombreDestinatario}`, qrRight, infoY)

      currentY = qrBottom + 10

      pdf.setFontSize(formato === "10x15" ? 6.5 : 5.5)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(90, 90, 90)
      pdf.text("Destinatario", marginLeft, currentY)
      currentY += formato === "10x15" ? 8 : 7

      pdf.setFontSize(formato === "10x15" ? 8.5 : 7.5)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 0, 0)
      pdf.text(`Nombre: ${envio.nombreDestinatario}`, marginLeft, currentY)
      currentY += formato === "10x15" ? 9 : 8

      pdf.setFont("helvetica", "normal")
      pdf.text(`Tel: ${envio.telefono}`, marginLeft, currentY)
      currentY += formato === "10x15" ? 9 : 8

      const direccionLines = pdf.splitTextToSize(`Dir: ${envio.direccion}`, width - marginLeft * 2 - 20)
      pdf.text(direccionLines, marginLeft, currentY)
      currentY += direccionLines.length * (formato === "10x15" ? 9 : 8) + 5

      if (envio.observaciones) {
        pdf.setFontSize(formato === "10x15" ? 7.5 : 6.5)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(40, 40, 40)
        pdf.text(`Observación: ${envio.observaciones}`, marginLeft, currentY)
        currentY += formato === "10x15" ? 9 : 8
      }

      if (envio.cambioRetiro) {
        pdf.setFontSize(formato === "10x15" ? 6.5 : 5.5)
        pdf.setTextColor(90, 90, 90)
        pdf.text("Campos extra", marginLeft, currentY)
        currentY += formato === "10x15" ? 8 : 7

        pdf.setFontSize(formato === "10x15" ? 8.5 : 7.5)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        const cambioRetiroLines = pdf.splitTextToSize(`Cambio / Retiro: ${envio.cambioRetiro}`, width - marginLeft * 2 - 20)
        pdf.text(cambioRetiroLines, marginLeft, currentY)
      }

      pdf.setDrawColor(124, 58, 237)
      pdf.setLineWidth(2)
      pdf.line(marginLeft, currentY + 5, width - marginLeft, currentY + 5)
    }
  }

  const handleSubirModelo = async () => {
    if (!selectedFile) {
      alert("Por favor, seleccione un archivo")
      return
    }

    if (!formData.cliente) {
      alert("Por favor, seleccione un cliente")
      return
    }

    try {
      // Leer archivo Excel
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][]

      // Validar encabezados
      const expectedHeaders = [
        "Numero de tracking",
        "Destinatario",
        "Teléfono de contacto",
        "Direccion",
        "Localidad",
        "Código Postal",
        "Observaciones",
        "Total a cobrar",
        "Cambio/retiro"
      ]

      if (data.length === 0 || !Array.isArray(data[0])) {
        alert("El archivo está vacío o tiene un formato incorrecto")
        return
      }

      const headers = data[0].map((h: any) => String(h).trim())
      const headersMatch = expectedHeaders.every((h, i) => headers[i] === h)

      if (!headersMatch) {
        alert("El archivo ha sido modificado. Las columnas no coinciden con el modelo original.")
        return
      }

      // Obtener nombre del cliente
      const clienteSeleccionado = clientes.find(c => c.codigo === formData.cliente)
      const nombreCliente = clienteSeleccionado?.nombreFantasia || formData.cliente

      // Procesar filas (empezar desde la fila 2, ya que la 1 son los encabezados)
      const envios: any[] = []
      const fechaCarga = new Date().toISOString()

      for (let i = 1; i < data.length; i++) {
        const row = data[i]
        
        // Saltar filas vacías
        if (!row[0] || String(row[0]).trim() === "") {
          continue
        }

        const tracking = String(row[0] || "").trim()
        const destinatario = String(row[1] || "").trim()
        const telefono = String(row[2] || "").trim()
        const direccion = String(row[3] || "").trim()
        const localidad = String(row[4] || "").trim()
        const codigoPostal = String(row[5] || "").trim()
        const observaciones = String(row[6] || "").trim()
        const totalACobrar = String(row[7] || "").trim()
        const cambioRetiro = String(row[8] || "").trim()

        // Validar campos requeridos
        if (!tracking || !destinatario || !telefono || !direccion) {
          continue // Saltar filas incompletas
        }

        // Construir dirección completa con código postal si existe
        let direccionCompleta = direccion
        if (codigoPostal) {
          direccionCompleta += `, CP: ${codigoPostal}`
        }
        if (localidad) {
          direccionCompleta += `, ${localidad}`
        }

        const qrData = `${tracking}-${Date.now()}-${i}`

        // Limpiar código postal (solo números)
        const codigoPostalLimpio = codigoPostal ? codigoPostal.replace(/\D/g, "") : ""

        // Determinar zona de entrega basándose en el código postal
        const { determinarZonaEntrega } = require("@/lib/zonas-utils")
        const zonaEntrega = determinarZonaEntrega(codigoPostalLimpio, localidad)

        const envio = {
          id: Date.now() + i,
          fecha: fechaCarga,
          fechaVenta: fechaCarga,
          fechaLlegue: fechaCarga,
          fechaEntregado: undefined,
          origen: "Directo",
          tracking: tracking,
          cliente: nombreCliente,
          direccion: direccionCompleta,
          nombreDestinatario: destinatario,
          telefono: telefono,
          impreso: "NO",
          observaciones: observaciones || "",
          totalACobrar: totalACobrar || "",
          cambioRetiro: cambioRetiro || "",
          localidad: localidad || "",
          codigoPostal: codigoPostalLimpio,
          zonaEntrega: zonaEntrega, // Zona determinada por código postal
          qrData: qrData,
          estado: "A retirar", // Estado por defecto
        }

        envios.push(envio)
      }

      if (envios.length === 0) {
        alert("No se encontraron envíos válidos en el archivo")
        return
      }

      // Intentar guardar en el backend primero (masivo)
      try {
        // Convertir fechas a formato ISO-8601 para el backend
        const enviosDTO = envios.map((envio) => ({
          fecha: envio.fecha ? new Date(envio.fecha).toISOString() : new Date().toISOString(),
          fechaVenta: envio.fechaVenta ? new Date(envio.fechaVenta).toISOString() : null,
          fechaLlegue: envio.fechaLlegue ? new Date(envio.fechaLlegue).toISOString() : null,
          fechaEntregado: envio.fechaEntregado ? new Date(envio.fechaEntregado).toISOString() : null,
          origen: envio.origen,
          tracking: envio.tracking,
          cliente: envio.cliente,
          direccion: envio.direccion,
          nombreDestinatario: envio.nombreDestinatario,
          telefono: envio.telefono,
          impreso: envio.impreso,
          observaciones: envio.observaciones,
          totalACobrar: envio.totalACobrar,
          cambioRetiro: envio.cambioRetiro,
          localidad: envio.localidad,
          codigoPostal: envio.codigoPostal,
          zonaEntrega: envio.zonaEntrega,
          qrData: envio.qrData,
          estado: envio.estado,
          eliminado: false,
        }))

        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(`${apiBaseUrl}/envios/masivos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(enviosDTO),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Error ${response.status}: ${errorText}`)
        }
      } catch (error: any) {
        warnDev("Error al guardar en backend, usando localStorage:", error)
      }

      // También guardar en localStorage como respaldo
      const enviosExistentes = JSON.parse(localStorage.getItem("enviosNoflex") || "[]")
      enviosExistentes.push(...envios)
      localStorage.setItem("enviosNoflex", JSON.stringify(enviosExistentes))

      // Generar PDFs según el formato
      const formato = formData.etiqueta as "A4" | "10x15" | "10x10"
      
      if (formato === "A4") {
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: "a4",
        })

        const labelsPerPage = 6
        for (let i = 0; i < envios.length; i++) {
          const labelIndexInPage = i % labelsPerPage
          if (i > 0 && labelIndexInPage === 0) {
            pdf.addPage()
          }
          await generatePDFForEnvio(envios[i], formato, pdf, labelIndexInPage, labelsPerPage)
        }

        const fechaDescarga = new Date().toISOString().split("T")[0]
        pdf.save(`envios-A4-${fechaDescarga}.pdf`)
      } else {
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: formato === "10x15" ? [283.46, 425.2] : [283.46, 283.46],
        })

        for (let i = 0; i < envios.length; i++) {
          if (i > 0) {
            pdf.addPage(formato === "10x15" ? [283.46, 425.2] : [283.46, 283.46], "portrait")
          }
          await generatePDFForEnvio(envios[i], formato, pdf, i, 1)
        }

        const fechaDescarga = new Date().toISOString().split("T")[0]
        pdf.save(`envios-${formato}-${fechaDescarga}.pdf`)
      }

      alert(`Se procesaron ${envios.length} envíos correctamente`)
      setSelectedFile(null)
      
      // Limpiar input de archivo
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ""
      }
    } catch (error) {
      errorDev("Error al procesar archivo:", error)
      alert("Error al procesar el archivo. Por favor, verifique que sea un archivo Excel válido.")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <ModernHeader />
      <main className="p-4">
        <div className="mx-auto max-w-7xl">

          {/* Main Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-[#6B46FF]">SUBIDA ENVIOS NO FLEX</h1>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Recuadro 1: Descargar Modelo */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 shadow-md p-6 flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center">
                      <Download className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Descargar Modelo</h2>
                  </div>
                  
                  <div className="flex-grow flex flex-col">
                    <div className="mt-auto space-y-4">
                      <div className="bg-red-50 border-l-4 border-red-400 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <div className="text-red-500 font-bold text-lg">⚠</div>
                          <p className="text-sm text-red-800 font-medium">
                            ¡Atención! Solo completar datos. No cambiar estructura, formato, ni diseño del archivo.
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={handleDescargarModelo}
                        className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
                      >
                        <Download className="h-5 w-5 mr-2" />
                        DESCARGAR MODELO
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Recuadro 2: Subir Modelo */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-md p-6 flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                      <UploadIcon className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Subir Modelo</h2>
                  </div>
                  
                  <div className="space-y-4 flex-grow flex flex-col">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">Cliente</label>
                      {userProfile === "Cliente" ? (
                        <Input
                          value={clientes.find(c => c.codigo === formData.cliente)?.nombreFantasia || ""}
                          disabled
                          className="h-11 bg-white border-gray-300"
                        />
                      ) : (
                        <Select
                          value={formData.cliente}
                          onValueChange={(value) => handleInputChange("cliente", value)}
                        >
                          <SelectTrigger className="h-11 bg-white border-gray-300">
                            <SelectValue placeholder="Seleccionar cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientes.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.codigo}>
                                {cliente.codigo} - {cliente.nombreFantasia}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">Etiqueta</label>
                      <Select
                        value={formData.etiqueta}
                        onValueChange={(value) => handleInputChange("etiqueta", value)}
                      >
                        <SelectTrigger className="h-11 bg-white border-gray-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A4">A4</SelectItem>
                          <SelectItem value="10x15">10x15</SelectItem>
                          <SelectItem value="10x10">10x10</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">Modelo nuevo</label>
                      <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 bg-white hover:border-blue-400 transition-colors cursor-pointer">
                        <input
                          type="file"
                          onChange={handleFileChange}
                          accept=".xlsx,.xls,.csv"
                          className="w-full cursor-pointer"
                        />
                        {selectedFile && (
                          <p className="mt-2 text-sm text-gray-600 font-medium">
                            Archivo seleccionado: {selectedFile.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto">
                      <Button
                        onClick={handleSubirModelo}
                        className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        disabled={!selectedFile}
                      >
                        <UploadIcon className="h-5 w-5 mr-2" />
                        SUBIR MODELO
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

