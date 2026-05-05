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
import { getApiBaseUrl } from "@/lib/api-config"
import { geocodeAndGetPostalCode } from "@/lib/geocode-cp"
import { getLabelIconDataUrls } from "@/lib/pdf-label-assets"
import { drawA4Label, drawSmallLabel, type EnvioLabel } from "@/lib/pdf-label-draw"
import { warnDev, errorDev } from "@/lib/logger"
import { Montserrat } from "next/font/google"

interface Cliente {
  id: number
  codigo: string
  nombreFantasia: string
}

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export default function SubirEnvioPage() {
  const router = useRouter()
  const isEmbed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "1"
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

  const handleSubirModelo = async () => {
    if (!selectedFile) {
      alert("Seleccione un archivo para continuar.")
      return
    }

    if (!formData.cliente) {
      alert("Seleccione una cuenta para continuar.")
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
        let totalACobrar = String(row[7] || "").trim()
        const numCobrar = parseFloat(totalACobrar.replace(",", "."))
        if (!Number.isNaN(numCobrar) && numCobrar < 0) totalACobrar = "0"
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

        // CP: siempre intentar geocodificar; si Google devuelve un CP, usarlo (así gana cuando el de la columna es incorrecto, ej. 1411 vs 1022).
        // Si Google no reconoce la dirección o falla, usar el CP de la columna (o vacío). El envío se sube igual.
        let codigoPostalLimpio = codigoPostal ? codigoPostal.replace(/\D/g, "") : ""
        try {
          const cpGoogle = await geocodeAndGetPostalCode(direccionCompleta)
          if (cpGoogle) {
            codigoPostalLimpio = cpGoogle
            direccionCompleta = direccion
            direccionCompleta += `, CP: ${cpGoogle}`
            if (localidad) direccionCompleta += `, ${localidad}`
          }
        } catch {
          // API falló: mantener CP de columna
        }

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

      // Generar PDFs con el mismo diseño que Reimprimir NoFlex (etiquetas actualizadas)
      const formato = formData.etiqueta as "A4" | "10x15" | "10x10"
      let assets: Awaited<ReturnType<typeof getLabelIconDataUrls>> | null = null
      try {
        assets = await getLabelIconDataUrls()
      } catch {
        warnDev("No se pudieron cargar íconos para etiquetas, se usan fallbacks")
      }

      const enviosAsLabel: EnvioLabel[] = envios.map((e) => ({
        id: e.id,
        fecha: e.fecha,
        tracking: e.tracking,
        nombreDestinatario: e.nombreDestinatario,
        direccion: e.direccion,
        telefono: e.telefono,
        localidad: e.localidad,
        cliente: e.cliente,
        origen: e.origen,
        observaciones: e.observaciones,
        totalACobrar: e.totalACobrar,
        cambioRetiro: e.cambioRetiro,
        qrData: e.qrData,
      }))

      if (formato === "A4") {
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

        for (let i = 0; i < enviosAsLabel.length; i++) {
          const labelIndexInPage = i % labelsPerPage
          if (i > 0 && labelIndexInPage === 0) pdf.addPage()
          const col = labelIndexInPage % 2
          const row = Math.floor(labelIndexInPage / 2)
          const startX = margin + col * (labelWidth + gap)
          const startY = margin + row * (labelHeight + gap)
          await drawA4Label(pdf, enviosAsLabel[i], startX, startY, labelWidth, labelHeight, assets)
        }

        const fechaDescarga = new Date().toISOString().split("T")[0]
        pdf.save(`envios-A4-${fechaDescarga}.pdf`)
      } else {
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: formato === "10x15" ? [283.46, 425.2] : [283.46, 283.46],
        })

        for (let i = 0; i < enviosAsLabel.length; i++) {
          if (i > 0) {
            pdf.addPage(formato === "10x15" ? [283.46, 425.2] : [283.46, 283.46], "portrait")
          }
          await drawSmallLabel(pdf, enviosAsLabel[i], formato, assets)
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
    <div className="min-h-screen bg-[#f7f8fc]">
      {!isEmbed && <ModernHeader />}
      <main className={`px-4 pb-6 pt-4 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-[34px] font-semibold tracking-tight text-[#1570ef]">Subida de envíos</h1>
            <Button
              onClick={handleDescargarModelo}
              className="h-11 rounded-xl bg-white px-5 text-[16px] font-semibold text-[#1570ef] shadow-sm border border-[#e6eaf4] hover:bg-[#f7faff]"
            >
              <Download className="mr-2 h-5 w-5" />
              Descargar modelo
            </Button>
          </div>

          <div className="ml-2 max-w-[560px] rounded-2xl border border-[#e6eaf4] bg-white p-6 shadow-sm min-h-[500px]">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[14px] font-medium text-[#4d5571]">Cuenta</label>
                {userProfile === "Cliente" ? (
                  <Input
                    value={clientes.find(c => c.codigo === formData.cliente)?.nombreFantasia || ""}
                    disabled
                    className="h-10 text-[14px] text-[#525b76]"
                  />
                ) : (
                  <Select
                    value={formData.cliente}
                    onValueChange={(value) => handleInputChange("cliente", value)}
                  >
                    <SelectTrigger className="h-10 text-[14px] text-[#525b76]">
                      <SelectValue placeholder="Seleccioná una cuenta" />
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
                <label className="block text-[14px] font-medium text-[#4d5571]">Etiqueta</label>
                <Select
                  value={formData.etiqueta}
                  onValueChange={(value) => handleInputChange("etiqueta", value)}
                >
                  <SelectTrigger className="h-10 text-[14px] text-[#525b76]">
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
                <label className="block text-[14px] font-medium text-[#4d5571]">Modelo nuevo</label>
                <div className="rounded-xl border border-dashed border-[#d6dced] bg-white p-5">
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2">
                    <UploadIcon className="h-5 w-5 text-[#626d91]" />
                    <span className="text-[14px] font-semibold text-[#3f4d88] underline underline-offset-2">
                      Adjuntar archivo
                    </span>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />
                  </label>
                  {selectedFile && (
                    <p className="mt-3 text-center text-[13px] text-[#626d91]">
                      {selectedFile.name}
                    </p>
                  )}
                </div>
              </div>

              <Button
                onClick={handleSubirModelo}
                className="h-10 w-full rounded-xl bg-[#eef4ff] text-[14px] font-semibold text-[#1570ef] hover:bg-[#e3edff] disabled:opacity-50"
                disabled={!selectedFile}
              >
                Subir modelo
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

