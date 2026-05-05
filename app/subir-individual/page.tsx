"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import jsPDF from "jspdf"
import QRCode from "qrcode"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev, errorDev } from "@/lib/logger"
import { cn } from "@/lib/utils"
import { Montserrat } from "next/font/google"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

interface Cliente {
  id: number
  codigo: string
  nombreFantasia: string
}

export default function SubirIndividualPage() {
  const router = useRouter()
  const isEmbed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "1"
  const [userProfile, setUserProfile] = useState<string | null>(null)
  const [userCodigoCliente, setUserCodigoCliente] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [formData, setFormData] = useState({
    cliente: "",
    clienteNombre: "",
    tracking: "",
    destinatarioNombre: "",
    destinatarioTelefono: "",
    destinatarioEmail: "",
    direccion: "",
    localidad: "",
    codigoPostal: "",
    observaciones: "",
    totalACobrar: "",
    cambioRetiro: "",
  })
  const [qrData, setQrData] = useState<string>("") // Guardar el QR data para reimpresión
  const [isSubmitting, setIsSubmitting] = useState(false) // Bloquear doble clic mientras se sube

  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const profile = sessionStorage.getItem("userProfile")
    
    if (!isAuthenticated) {
      router.push("/")
      return
    }

    setUserProfile(profile)

    // Si el usuario es Cliente, obtener su código de cliente y nombre desde el backend
    if (profile === "Cliente") {
      const loadUserInfo = async () => {
        const username = sessionStorage.getItem("username")
        if (!username) return

        let codigoClienteUsuario: string | null = null

        try {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
          if (response.ok) {
            const data = await response.json()
            const content = data.content || []
            const user = content.find((u: any) => u.usuario === username)
            if (user && user.codigoCliente) {
              codigoClienteUsuario = user.codigoCliente
              setUserCodigoCliente(user.codigoCliente)
            }
          }
        } catch (error) {
          warnDev("No se pudo cargar información del backend:", error)
        }

        if (codigoClienteUsuario) {
          try {
            const apiBaseUrl = getApiBaseUrl()
            const response = await fetch(`${apiBaseUrl}/clientes?codigo=${encodeURIComponent(codigoClienteUsuario)}&size=1`)
            if (response.ok) {
              const data = await response.json()
              if (data.content && data.content.length > 0) {
                const client = data.content[0]
                if (client.nombreFantasia) {
                  setFormData((prev) => ({
                    ...prev,
                    cliente: client.nombreFantasia,
                    clienteNombre: client.nombreFantasia
                  }))
                  return
                }
              }
            }
          } catch (error) {
            warnDev("No se pudo cargar cliente del backend:", error)
          }
          setFormData((prev) => ({
            ...prev,
            cliente: codigoClienteUsuario,
            clienteNombre: codigoClienteUsuario
          }))
        }
      }
      loadUserInfo()
    }

    // Si el usuario NO es Chofer ni Cliente, cargar lista de clientes
    if (profile !== "Chofer" && profile !== "Cliente") {
      const loadClientes = async () => {
        try {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/clientes?size=1000`)
          if (response.ok) {
            const data = await response.json()
            if (data.content && data.content.length > 0) {
              const clientesList: Cliente[] = data.content.map((c: any) => ({
                id: c.id,
                codigo: c.codigo,
                nombreFantasia: c.nombreFantasia || "",
              }))
              setClientes(clientesList)
              return
            }
          }
        } catch (error) {
          warnDev("No se pudo cargar clientes del backend:", error)
        }
      }
      loadClientes()
    }
  }, [router])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const generatePDF = async (qrDataToUse: string) => {
    try {
      // Crear PDF en formato 10x15cm (283.46 x 425.2 puntos, ya que 1cm = 28.346 puntos)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [283.46, 425.2], // 10cm x 15cm
      })

      // Generar QR usando el QR data proporcionado
      const qrCodeDataUrl = await QRCode.toDataURL(qrDataToUse, {
        width: 120,
        margin: 1,
      })

      // Obtener fecha actual
      const fecha = new Date()
      const fechaFormateada = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`

      // Obtener nombre del cliente
      const nombreCliente = formData.clienteNombre || formData.cliente || "Cliente"

      // Extraer localidad de la dirección (si no está en formData.localidad)
      let localidad = formData.localidad
      if (!localidad && formData.direccion) {
        // Intentar extraer localidad de la dirección
        const partes = formData.direccion.split(",")
        if (partes.length > 1) {
          localidad = partes[partes.length - 2].trim()
        } else {
          // Intentar extraer de diferentes formatos
          const cpMatch = formData.direccion.match(/CP:\s*(\d+)/i)
          if (cpMatch) {
            localidad = formData.direccion.split("CP:")[0].trim()
          } else {
            localidad = formData.direccion.split(/\d{4}/)[0].trim()
          }
        }
      }

      // Configuración de márgenes y posiciones (blanco y negro)
      const marginLeft = 12
      const marginTop = 12
      const marginRight = 12
      const pageWidth = 283.46
      let currentY = marginTop
      
      // Título centrado (primero el texto)
      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 0, 0)
      const titleWidth = pdf.getTextWidth("NEXO")
      const titleX = (pageWidth - titleWidth) / 2
      pdf.text("NEXO", titleX, currentY)
      
      // Línea superior (debajo del texto, no lo corta)
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(2)
      pdf.line(marginLeft, currentY - 12, pageWidth - marginRight, currentY - 12)
      
      // Línea inferior (debajo del título)
      currentY += 18
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(1)
      pdf.line(marginLeft, currentY - 3, pageWidth - marginRight, currentY - 3)
      currentY += 5

      // QR Code con borde negro
      const qrSize = 75
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
      const localidadText = (localidad || "Sin localidad").toUpperCase()
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")

      // Calcular dimensiones del texto
      const localidadLines = pdf.splitTextToSize(localidadText, pageWidth - qrRight - marginRight - 8)
      const localidadTextWidth = Math.max(...localidadLines.map((line: string) => pdf.getTextWidth(line)))
      const lineHeight = 14
      const localidadTextHeight = localidadLines.length * lineHeight
      const padding = 8
      const boxWidth = Math.min(localidadTextWidth + (padding * 2), pageWidth - qrRight - marginRight - 8)
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
      pdf.setFontSize(7.5)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(0, 0, 0)
      
      // Fecha con bullet negro
      pdf.setFillColor(0, 0, 0)
      pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
      pdf.text(fechaFormateada, qrRight + 2, infoY)
      infoY += 10
      
      // Cliente
      pdf.setFillColor(0, 0, 0)
      pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
      const clienteText = `Cliente: ${nombreCliente}`
      const clienteLines = pdf.splitTextToSize(clienteText, pageWidth - qrRight - marginRight - 8)
      pdf.text(clienteLines, qrRight + 2, infoY)
      infoY += clienteLines.length * 10
      
      // Venta (carga manual = directo)
      pdf.setFillColor(0, 0, 0)
      pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
      pdf.text("Venta: Venta x afuera", qrRight + 2, infoY)
      infoY += 10
      
      // Envío = número de tracking
      pdf.setFillColor(0, 0, 0)
      pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
      pdf.text(`Envio: ${formData.tracking || ""}`, qrRight + 2, infoY)

      // Espacio después del bloque superior
      currentY = qrBottom + 12

      // Línea separadora negra
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(1)
      pdf.line(marginLeft, currentY, pageWidth - marginRight, currentY)
      currentY += 8

      // Sección Destinatario con subrayado
      pdf.setFontSize(7)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 0, 0)
      const destinatarioY = currentY
      pdf.text("Destinatario", marginLeft, currentY)
      const destinatarioWidth = pdf.getTextWidth("Destinatario")
      pdf.setLineWidth(0.5)
      pdf.line(marginLeft, currentY + 2, marginLeft + destinatarioWidth, currentY + 2)
      currentY += 10

      // Nombre destacado
      pdf.setFontSize(9.5)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 0, 0)
      const nombreLines = pdf.splitTextToSize(formData.destinatarioNombre, pageWidth - marginLeft * 2 - 20)
      pdf.text(nombreLines, marginLeft, currentY)
      currentY += nombreLines.length * 11 + 3

      // Teléfono
      if (formData.destinatarioTelefono && formData.destinatarioTelefono !== "null") {
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(0, 0, 0)
        pdf.text(`Tel: ${formData.destinatarioTelefono}`, marginLeft, currentY)
        currentY += 10
      }
      
      // Dirección
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(0, 0, 0)
      const direccionLines = pdf.splitTextToSize(formData.direccion, pageWidth - marginLeft * 2 - 20)
      pdf.text(direccionLines, marginLeft, currentY)
      currentY += direccionLines.length * 10 + 5

      // Observación
      if (formData.observaciones) {
        pdf.setFontSize(7.5)
        pdf.setFont("helvetica", "italic")
        pdf.setTextColor(0, 0, 0)
        const obsLines = pdf.splitTextToSize(`Obs: ${formData.observaciones}`, pageWidth - marginLeft * 2 - 20)
        pdf.text(obsLines, marginLeft, currentY)
        currentY += obsLines.length * 9 + 3
      }

      // Cobrar en Efectivo (si tiene total a cobrar)
      if (formData.totalACobrar && formData.totalACobrar.trim() !== "") {
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        const cobrarText = `Cobrar en Efectivo: $ ${formData.totalACobrar.trim()}`
        pdf.text(cobrarText, marginLeft, currentY)
        currentY += 11
      }

      // Cambio o Retiro (solo si completó el campo)
      if (formData.cambioRetiro && formData.cambioRetiro.trim() !== "") {
        const valor = formData.cambioRetiro.trim().toUpperCase()
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.8)
        const badgeW = Math.max(pdf.getTextWidth(valor) + 10, 36)
        pdf.roundedRect(marginLeft, currentY - 8, badgeW, 14, 2, 2, "S")
        pdf.text(valor, marginLeft + badgeW / 2 - pdf.getTextWidth(valor) / 2, currentY + 1)
        currentY += 18
      }

      // Footer con línea negra
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(2)
      pdf.line(marginLeft, currentY + 3, pageWidth - marginRight, currentY + 3)

      // Descargar PDF
      const fechaDescarga = new Date().toISOString().split("T")[0]
      pdf.save(`envio-${formData.tracking || "sin-tracking"}-${fechaDescarga}.pdf`)

      // Limpiar formulario después de generar el PDF
      handleClear()
    } catch (error) {
      errorDev("Error al generar PDF:", error)
      alert("No fue posible generar el PDF. Reintente.")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    // Validar campos requeridos
    if (!formData.tracking || !formData.destinatarioNombre || !formData.destinatarioTelefono || !formData.direccion) {
    alert("Complete los campos obligatorios para continuar.")
      return
    }
    setIsSubmitting(true)
    try {
      await submitEnvio()
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitEnvio = async () => {
    // Guardar el envío en localStorage para que aparezca en "Reimprimir NoFlex"
    const fechaCarga = new Date().toISOString()

    const { determinarZonaEntrega } = require("@/lib/zonas-utils")
    const zonaEntrega = determinarZonaEntrega(formData.codigoPostal, formData.localidad)
    
    // Determinar el cliente para guardar (código si es Cliente, o el valor seleccionado si no)
    let clienteParaGuardar = formData.clienteNombre || formData.cliente
    if (userProfile === "Cliente" && userCodigoCliente) {
      // Si es usuario Cliente, guardar en formato "codigo - nombre" para consistencia
      clienteParaGuardar = `${userCodigoCliente} - ${formData.clienteNombre || formData.cliente}`
    }
    
    // El tracking ingresado será usado como semilla, el backend generará uno único
    const trackingSemilla = formData.tracking

    // Intentar guardar en el backend primero para obtener el tracking único generado
    let trackingUnico = trackingSemilla // Fallback si falla el backend
    let qrDataValue = trackingSemilla // Fallback si falla el backend
    
    try {
      // Convertir fechas a formato ISO-8601 para el backend
      const envioDTO = {
        fecha: fechaCarga ? new Date(fechaCarga).toISOString() : new Date().toISOString(),
        fechaVenta: fechaCarga ? new Date(fechaCarga).toISOString() : null,
        fechaLlegue: fechaCarga ? new Date(fechaCarga).toISOString() : null,
        fechaEntregado: null,
        origen: "Directo", // Alta manual: origen siempre "Directo"
        tracking: trackingSemilla, // El backend usará esto como semilla para generar uno único
        cliente: clienteParaGuardar,
        direccion: formData.direccion,
        nombreDestinatario: formData.destinatarioNombre,
        telefono: formData.destinatarioTelefono,
        email: formData.destinatarioEmail || "",
        impreso: "NO",
        observaciones: formData.observaciones || "",
        totalACobrar: formData.totalACobrar || "",
        cambioRetiro: formData.cambioRetiro || "",
        localidad: formData.localidad || "",
        codigoPostal: formData.codigoPostal || "",
        zonaEntrega: zonaEntrega,
        qrData: trackingSemilla, // Temporal, se actualizará con el tracking único
        estado: "A retirar",
        eliminado: false,
      }

      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/envios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(envioDTO),
      })

      if (response.ok) {
        // El backend devuelve el envío con el tracking único generado
        const envioCreado = await response.json()
        trackingUnico = envioCreado.tracking || trackingSemilla
        qrDataValue = envioCreado.qrData || trackingUnico // Usar el qrData del backend o el tracking único
        setQrData(qrDataValue)
      } else {
        const errorText = await response.text()
        throw new Error(`Error ${response.status}: ${errorText}`)
      }
    } catch (error: any) {
      warnDev("Error al guardar en backend, usando localStorage con tracking semilla:", error)
      // Si falla el backend, usar el tracking semilla como fallback
      trackingUnico = trackingSemilla
      qrDataValue = trackingSemilla
      setQrData(qrDataValue)
    }

    // Guardar en localStorage como respaldo (usando el tracking único si se obtuvo del backend)
    const envio = {
      id: Date.now(), // ID único basado en timestamp
      fecha: fechaCarga,
      fechaVenta: fechaCarga,
      fechaLlegue: fechaCarga,
      fechaEntregado: undefined,
      origen: "Directo",
      tracking: trackingUnico, // Usar el tracking único generado
      cliente: clienteParaGuardar,
      direccion: formData.direccion,
      nombreDestinatario: formData.destinatarioNombre,
      telefono: formData.destinatarioTelefono,
      email: formData.destinatarioEmail || "",
      impreso: "NO",
      observaciones: formData.observaciones || "",
      totalACobrar: formData.totalACobrar || "",
      cambioRetiro: formData.cambioRetiro || "",
      localidad: formData.localidad || "",
      codigoPostal: formData.codigoPostal || "",
      zonaEntrega: zonaEntrega,
      qrData: qrDataValue, // Usar el tracking único para el QR
      estado: "A retirar",
    }

    const enviosExistentes = JSON.parse(localStorage.getItem("enviosNoflex") || "[]")
    enviosExistentes.push(envio)
    localStorage.setItem("enviosNoflex", JSON.stringify(enviosExistentes))

    // Generar y descargar PDF usando el tracking único
    await generatePDF(qrDataValue)
    handleClear()
  }

  const handleClear = () => {
    // Si el usuario es Cliente, mantener el nombre del cliente
    const clienteValue = userProfile === "Cliente" && formData.clienteNombre 
      ? formData.clienteNombre 
      : (userCodigoCliente || "")
    
    setFormData({
      cliente: clienteValue,
      clienteNombre: userProfile === "Cliente" ? formData.clienteNombre : "",
      tracking: "",
      destinatarioNombre: "",
      destinatarioTelefono: "",
      destinatarioEmail: "",
      direccion: "",
      localidad: "",
      codigoPostal: "",
      observaciones: "",
      totalACobrar: "",
      cambioRetiro: "",
    })
  }

  const labelClass = isEmbed ? "block text-[13px] font-medium text-[#4d5571]" : "block text-[14px] font-medium text-[#4d5571]"
  const inputFieldClass = cn(
    "rounded-xl border border-[#e6eaf4] bg-white font-medium text-[#1f2433] shadow-sm placeholder:font-normal placeholder:text-[#8890a8] focus-visible:border-[#1570ef] focus-visible:ring-2 focus-visible:ring-[#1570ef]/20 focus-visible:ring-offset-0",
    isEmbed ? "h-9 text-[13px]" : "h-10 text-[14px]"
  )
  const selectTriggerClass = cn(
    "rounded-xl border border-[#e6eaf4] bg-white font-medium text-[#1f2433] shadow-sm focus:ring-[#1570ef]/20",
    isEmbed ? "h-9 text-[13px]" : "h-10 text-[14px]"
  )

  const trackingVendedorRow = (
    <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
      <div className="space-y-1 sm:space-y-1.5">
        <label className={labelClass}>Tracking *</label>
        <Input
          value={formData.tracking}
          onChange={(e) => handleInputChange("tracking", e.target.value)}
          required
          placeholder="Código de seguimiento del pedido"
          className={inputFieldClass}
        />
      </div>
      <div className="space-y-1 sm:space-y-1.5">
        <label className={labelClass}>Vendedor{userProfile === "Cliente" ? " *" : ""}</label>
        {userProfile === "Cliente" ? (
          <Input value={formData.cliente} disabled className={cn(inputFieldClass, "bg-[#f5f7fb] text-[#1f2433]")} />
        ) : (
          <Select
            value={formData.cliente}
            onValueChange={(value) => {
              const clienteSeleccionado = clientes.find((c) => c.codigo === value)
              setFormData((prev) => ({
                ...prev,
                cliente: value,
                clienteNombre: clienteSeleccionado?.nombreFantasia || "",
              }))
            }}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder="Seleccionar vendedor" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((cliente) => (
                <SelectItem key={cliente.id} value={cliente.codigo}>
                  {cliente.nombreFantasia}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )

  const destinatarioBlock = (
    <div className={cn("rounded-xl border border-[#eef1f8] bg-[#fafbff]", isEmbed ? "p-2.5" : "p-4")}>
      <p className={cn("font-semibold uppercase tracking-wide text-[#5d6578]", isEmbed ? "mb-1.5 text-[10px]" : "mb-3 text-[12px]")}>
        Destinatario
      </p>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="space-y-1 sm:space-y-1.5 sm:col-span-2">
          <label className={labelClass}>Nombre y apellido *</label>
          <Input
            value={formData.destinatarioNombre}
            onChange={(e) => handleInputChange("destinatarioNombre", e.target.value)}
            required
            placeholder="Nombre completo"
            className={inputFieldClass}
          />
        </div>
        <div className="space-y-1 sm:space-y-1.5">
          <label className={labelClass}>Teléfono *</label>
          <Input
            value={formData.destinatarioTelefono}
            onChange={(e) => handleInputChange("destinatarioTelefono", e.target.value)}
            required
            placeholder="Incluir código de área"
            className={inputFieldClass}
          />
        </div>
        <div className="space-y-1 sm:space-y-1.5">
          <label className={labelClass}>Correo electrónico</label>
          <Input
            type="email"
            value={formData.destinatarioEmail}
            onChange={(e) => handleInputChange("destinatarioEmail", e.target.value)}
            placeholder="Opcional"
            className={inputFieldClass}
          />
        </div>
      </div>
    </div>
  )

  const direccionBlock = (
    <div className="space-y-1 sm:space-y-1.5">
      <label className={labelClass}>Dirección de entrega *</label>
      <GooglePlacesAutocomplete
        value={formData.direccion}
        onChange={(value, localidad, codigoPostal) => {
          setFormData((prev) => ({
            ...prev,
            direccion: value,
            localidad: localidad || prev.localidad,
            codigoPostal: codigoPostal || prev.codigoPostal,
          }))
        }}
      />
    </div>
  )

  const obsTotalesBlock = (
    <div className="grid gap-2 sm:grid-cols-2 sm:items-start sm:gap-3">
      <div className="space-y-1 sm:space-y-1.5">
        <label className={labelClass}>Observaciones</label>
        <textarea
          value={formData.observaciones}
          onChange={(e) => handleInputChange("observaciones", e.target.value)}
          className={cn(
            "w-full resize-none rounded-xl border border-[#e6eaf4] bg-white px-2.5 py-1.5 font-medium text-[#1f2433] shadow-sm outline-none placeholder:font-normal placeholder:text-[#8890a8] focus:border-[#1570ef] focus:ring-2 focus:ring-[#1570ef]/20",
            isEmbed ? "min-h-[44px] text-[13px]" : "min-h-[56px] px-3 py-2 text-[14px] sm:min-h-[72px]"
          )}
          rows={isEmbed ? 2 : 3}
          placeholder="Indicaciones de entrega, horario, etc."
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-2">
        <div className="space-y-1 sm:space-y-1.5">
          <label className={labelClass}>Total a cobrar</label>
          <Input
            type="number"
            value={formData.totalACobrar}
            onChange={(e) => handleInputChange("totalACobrar", e.target.value)}
            placeholder="0.00"
            className={inputFieldClass}
          />
        </div>
        <div className="space-y-1 sm:space-y-1.5">
          <label className={labelClass}>Cambio / Retiro</label>
          <Select
            value={formData.cambioRetiro === "" ? "__none__" : formData.cambioRetiro}
            onValueChange={(v) => handleInputChange("cambioRetiro", v === "__none__" ? "" : v)}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Seleccionar</SelectItem>
              <SelectItem value="Cambio">Cambio</SelectItem>
              <SelectItem value="Retiro">Retiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  const footerBlock = (
    <div
      className={cn(
        "flex flex-col border-t border-[#e6eaf4] sm:flex-row sm:items-center sm:justify-between",
        isEmbed ? "gap-2 pt-2" : "gap-3 pt-3 sm:pt-4"
      )}
    >
      <p className={cn("text-[#8890a8]", isEmbed ? "text-[11px]" : "text-[12px]")}>Los campos con (*) son obligatorios.</p>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button
          type="button"
          onClick={handleClear}
          className={cn(
            "rounded-xl border border-[#e6eaf4] bg-white font-semibold text-[#1570ef] shadow-sm hover:bg-[#f7faff]",
            isEmbed ? "h-9 px-4 text-[13px]" : "h-10 px-5 text-[14px]"
          )}
        >
          Limpiar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "min-w-[148px] rounded-xl bg-[#1459e9] font-semibold text-white shadow-sm hover:bg-[#114bce] disabled:pointer-events-none disabled:opacity-60",
            isEmbed ? "h-9 px-5 text-[13px]" : "h-10 px-6 text-[14px]"
          )}
        >
          {isSubmitting ? "Registrando…" : "Registrar pedido"}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      {!isEmbed && <ModernHeader />}
      <main className={cn(montserrat.className, isEmbed ? "px-3 pb-2 pt-2" : "px-4 pb-5 pt-3")}>
        <div className={cn("mx-auto w-full", isEmbed ? "max-w-[1200px]" : "max-w-[1700px]")}>
          {!isEmbed && (
            <h1 className="mb-4 text-[34px] font-semibold tracking-tight text-[#1570ef]">Carga manual</h1>
          )}

          <div
            className={cn(
              "w-full rounded-2xl border border-[#e6eaf4] bg-white shadow-sm",
              isEmbed ? "p-3" : "ml-2 max-w-[960px] p-5"
            )}
          >
            <form onSubmit={handleSubmit} className={isEmbed ? "space-y-2" : "space-y-5"}>
              {isEmbed ? (
                <>
                  <div className="grid gap-3 xl:grid-cols-2 xl:items-start xl:gap-4">
                    <div className="min-w-0 space-y-2">
                      {trackingVendedorRow}
                      {destinatarioBlock}
                      {direccionBlock}
                    </div>
                    <div className="min-w-0 space-y-2">{obsTotalesBlock}</div>
                  </div>
                  {footerBlock}
                </>
              ) : (
                <>
                  {trackingVendedorRow}
                  {destinatarioBlock}
                  {direccionBlock}
                  {obsTotalesBlock}
                  {footerBlock}
                </>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}


