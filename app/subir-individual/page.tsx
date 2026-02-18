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

interface Cliente {
  id: number
  codigo: string
  nombreFantasia: string
}

export default function SubirIndividualPage() {
  const router = useRouter()
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
      const titleWidth = pdf.getTextWidth("Zeta Llegue")
      const titleX = (pageWidth - titleWidth) / 2
      pdf.text("Zeta Llegue", titleX, currentY)
      
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
      
      // Remitente
      pdf.setFillColor(0, 0, 0)
      pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
      const clienteText = `Rte.: ${nombreCliente}`
      const clienteLines = pdf.splitTextToSize(clienteText, pageWidth - qrRight - marginRight - 8)
      pdf.text(clienteLines, qrRight + 2, infoY)
      infoY += clienteLines.length * 10
      
      // Venta
      pdf.setFillColor(0, 0, 0)
      pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
      pdf.text(`Venta: ${formData.destinatarioNombre}`, qrRight + 2, infoY)
      infoY += 10
      
      // Envío
      pdf.setFillColor(0, 0, 0)
      pdf.circle(qrRight - 3, infoY - 2, 1.5, "F")
      pdf.text(`Envio: ${formData.destinatarioNombre}`, qrRight + 2, infoY)

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
      pdf.text("DESTINATARIO", marginLeft, currentY)
      // Subrayado
      const destinatarioWidth = pdf.getTextWidth("DESTINATARIO")
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
        pdf.setTextColor(60, 60, 60)
        const obsLines = pdf.splitTextToSize(`Obs: ${formData.observaciones}`, pageWidth - marginLeft * 2 - 20)
        pdf.text(obsLines, marginLeft, currentY)
        currentY += obsLines.length * 9 + 3
      }

      // Campos extra
      if (formData.cambioRetiro) {
        pdf.setFontSize(7)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        const adicionalY = currentY
        pdf.text("INFORMACIÓN ADICIONAL", marginLeft, currentY)
        // Subrayado
        const adicionalWidth = pdf.getTextWidth("INFORMACIÓN ADICIONAL")
        pdf.setLineWidth(0.5)
        pdf.line(marginLeft, currentY + 2, marginLeft + adicionalWidth, currentY + 2)
        currentY += 9

        pdf.setFontSize(8.5)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(0, 0, 0)
        const cambioRetiroLines = pdf.splitTextToSize(`Cambio/Retiro: ${formData.cambioRetiro}`, pageWidth - marginLeft * 2 - 20)
        pdf.text(cambioRetiroLines, marginLeft, currentY)
        currentY += cambioRetiroLines.length * 10 + 5
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
      alert("Error al generar el PDF. Por favor, intente nuevamente.")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar campos requeridos
    if (!formData.tracking || !formData.destinatarioNombre || !formData.destinatarioTelefono || !formData.direccion) {
      alert("Por favor, complete todos los campos obligatorios (*)")
      return
    }

    // Guardar el envío en localStorage para que aparezca en "Reimprimir NoFlex"
    const fechaCarga = new Date().toISOString()
    
    // Importar función para determinar zona
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
        origen: "Directo", // Los envíos de "Subir individual" son siempre "Directo"
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <ModernHeader />
      <main className="p-4">
        <div className="mx-auto max-w-5xl">

          {/* Form Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200">
              <h1 className="text-xl font-bold text-[#6B46FF]">INGRESO DE ENVIOS</h1>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {/* Primera fila: Cliente y Tracking */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Cliente {userProfile === "Cliente" ? "*" : ""}
                  </label>
                  {userProfile === "Cliente" ? (
                    <Input
                      value={formData.cliente}
                      disabled
                      className="bg-gray-100 h-8 text-sm"
                    />
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
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Seleccionar cliente" />
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
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Tracking *
                  </label>
                  <Input
                    value={formData.tracking}
                    onChange={(e) => handleInputChange("tracking", e.target.value)}
                    required
                    placeholder="Ingrese el tracking"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Segunda fila: Destinatario */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Destinatario nombre *
                  </label>
                  <Input
                    value={formData.destinatarioNombre}
                    onChange={(e) => handleInputChange("destinatarioNombre", e.target.value)}
                    required
                    placeholder="Nombre del destinatario"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Destinatario teléfono *
                  </label>
                  <Input
                    value={formData.destinatarioTelefono}
                    onChange={(e) => handleInputChange("destinatarioTelefono", e.target.value)}
                    required
                    placeholder="Teléfono del destinatario"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Destinatario email
                  </label>
                  <Input
                    type="email"
                    value={formData.destinatarioEmail}
                    onChange={(e) => handleInputChange("destinatarioEmail", e.target.value)}
                    placeholder="Email del destinatario"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Tercera fila: Dirección */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">
                  Dirección completa *
                </label>
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

              {/* Cuarta fila: Observaciones, Total a cobrar, Cambio/Retiro */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Observaciones
                  </label>
                  <textarea
                    value={formData.observaciones}
                    onChange={(e) => handleInputChange("observaciones", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6B46FF] focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Observaciones"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Total a cobrar
                  </label>
                  <Input
                    type="number"
                    value={formData.totalACobrar}
                    onChange={(e) => handleInputChange("totalACobrar", e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Cambio / Retiro
                  </label>
                  <Input
                    value={formData.cambioRetiro}
                    onChange={(e) => handleInputChange("cambioRetiro", e.target.value)}
                    placeholder="Cambio o retiro"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Los campos con (*) son obligatorios
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleClear}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white h-8 px-4 text-sm"
                  >
                    LIMPIAR
                  </Button>
                  <Button
                    type="submit"
                    className="bg-green-500 hover:bg-green-600 text-white h-8 px-4 text-sm"
                  >
                    SUBIR
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}


