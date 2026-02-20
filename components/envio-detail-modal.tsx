"use client"

import { useState, useEffect, useRef } from "react"
import { X, Pencil, Printer } from "lucide-react"
import QRCode from "qrcode"
import jsPDF from "jspdf"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiBaseUrl } from "@/lib/api-config"
import { logDev, warnDev, errorDev } from "@/lib/logger"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface EnvioDetailModalProps {
  isOpen: boolean
  onClose: () => void
  envio: {
    id: number
    tracking: string
    idMvg?: string
    cliente: string
    direccion: string
    nombreDestinatario: string
    telefono: string
    email?: string
    codigoPostal?: string
    localidad?: string
    qrData?: string
    trackingToken?: string
    fecha?: string
    fechaVenta?: string
    fechaLlegue?: string
    observaciones?: string
    totalACobrar?: string
    cambioRetiro?: string
    estado?: string
    choferAsignadoId?: number
    choferAsignadoNombre?: string
    costoEnvio?: string
    idml?: string
    peso?: string
    metodoEnvio?: string
    deadline?: string
    origen?: string
  } | null
  onDelete?: (envioId: number) => void
  onAssignSuccess?: () => void
}

const estadosEnvio = [
  "A retirar",
  "Retirado",
  "En camino al destinatario",
  "Entregado",
  "Nadie",
  "Cancelado",
  "Rechazado por el comprador",
  "reprogramado por comprador",
]

interface HistorialItem {
  id: number
  estado: string
  fecha: string
  horaEstimada: string
  quien: string
  observaciones?: string
  origen?: string // "APP" o "WEB"
}

interface ObservacionItem {
  id: number
  fecha: string
  observacion: string
  quien: string
}

interface Chofer {
  id: number
  nombre: string
  apellido: string
  usuario: string
}

interface AsignacionItem {
  choferNombre: string
  desde: string
  fecha: string
  quienAsigno: string
}

// Chofer especial "PENDIENTES DEPÓSITO"
const PENDIENTES_DEPOSITO: Chofer = {
  id: -1,
  nombre: 'PENDIENTES',
  apellido: 'DEPÓSITO',
  usuario: 'PENDIENTES_DEPOSITO',
}

export function EnvioDetailModal({ isOpen, onClose, envio, onDelete, onAssignSuccess }: EnvioDetailModalProps) {
  // Normalizar valores null a cadenas vacías para evitar errores de React
  const normalizeValue = (value: string | null | undefined): string => {
    return value ?? ""
  }
  
  const [activeTab, setActiveTab] = useState<"general" | "historial" | "observaciones" | "imagenes" | "asignacion" | "entregado">("general")
  const [qrImageUrl, setQrImageUrl] = useState<string>("")
  const [publicLink, setPublicLink] = useState<string>("")
  const [geolocalizacionEncontrada, setGeolocalizacionEncontrada] = useState<boolean>(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAddEstadoModalOpen, setIsAddEstadoModalOpen] = useState(false)
  const [isAddObservacionModalOpen, setIsAddObservacionModalOpen] = useState(false)
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [observaciones, setObservaciones] = useState<ObservacionItem[]>([])
  const [imagenes, setImagenes] = useState<Array<{id: number, url: string, fecha: string, quien: string}>>([])
  const [datosEntrega, setDatosEntrega] = useState<{rolRecibio?: string, nombreRecibio?: string, dniRecibio?: string} | null>(null)
  const [nuevoEstado, setNuevoEstado] = useState({
    fecha: "",
    horario: "",
    estado: "",
  })
  const [nuevaObservacion, setNuevaObservacion] = useState({
    observacion: "",
  })
  const [userProfile, setUserProfile] = useState<string | null>(null)
  const [userFullName, setUserFullName] = useState<string | null>(null)
  const [choferes, setChoferes] = useState<Chofer[]>([])
  const [isAsignarModalOpen, setIsAsignarModalOpen] = useState(false)
  const [choferSeleccionado, setChoferSeleccionado] = useState<Chofer | null>(null)
  const [asignaciones, setAsignaciones] = useState<AsignacionItem[]>([])
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)

  // Generar QR y link público
  useEffect(() => {
    if (!envio || !isOpen) {
      setQrImageUrl("")
      setPublicLink("")
      return
    }

    const generateQR = async () => {
      try {
        // El link público apunta a una página de tracking con el trackingToken
        // Si no hay trackingToken, usar el qrData como fallback (para envíos antiguos)
        const token = envio.trackingToken || envio.qrData || `${envio.tracking}-${envio.id}`
        // Usar la URL base actual (window.location.origin) para que funcione en localhost y producción
        const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
        const link = `${baseUrl}/tracking/${token}`
        setPublicLink(link)

        // Generar QR con el link público
        const dataUrl = await QRCode.toDataURL(link, {
          width: 300,
          margin: 2,
        })
        setQrImageUrl(dataUrl)
      } catch (error) {
        errorDev("Error generando QR:", error)
      }
    }

    generateQR()
  }, [envio, isOpen])

  // Cargar historial desde el backend
  useEffect(() => {
    if (!envio || !isOpen) {
      setHistorial([])
      return
    }

    const loadHistorial = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(`${apiBaseUrl}/envios/${envio.id}/historial`)
        if (response.ok) {
          const historialData = await response.json()
          // Convertir el formato del backend al formato del frontend
          const historialFormateado: HistorialItem[] = historialData.map((item: any) => {
            const fecha = new Date(item.fecha)
            const fechaFormateada = fecha.toLocaleDateString("es-AR")
            const horaFormateada = fecha.toLocaleTimeString("es-AR", { 
              hour: "2-digit", 
              minute: "2-digit" 
            })
            return {
              id: item.id,
              estado: item.estado,
              fecha: fechaFormateada,
              horaEstimada: horaFormateada,
              quien: item.quien || "Usuario",
              observaciones: item.observaciones,
              origen: item.origen,
            }
          })
          
          // Filtrar entradas consecutivas con el mismo estado para evitar duplicados
          // (por ejemplo, cuando hay una reasignación sin cambio de estado)
          const historialFiltrado: HistorialItem[] = []
          let ultimoEstado: string | null = null
          for (const item of historialFormateado) {
            // Solo agregar si el estado es diferente al anterior
            // O si es la primera entrada
            if (ultimoEstado === null || item.estado !== ultimoEstado) {
              historialFiltrado.push(item)
              ultimoEstado = item.estado
            }
          }
          
          setHistorial(historialFiltrado)
        } else {
          // Si falla, mantener historial vacío
          setHistorial([])
        }
      } catch (error) {
        errorDev("Error cargando historial:", error)
        setHistorial([])
      }
    }

    loadHistorial()
    loadObservaciones()
    loadImagenes()
    loadDatosEntrega()
  }, [envio, isOpen])
  
  // Cargar observaciones desde el backend
  const loadObservaciones = async () => {
    if (!envio || !isOpen) {
      setObservaciones([])
      return
    }

    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/envios/${envio.id}/observaciones`)
      if (response.ok) {
        const observacionesData = await response.json()
        const observacionesFormateadas: ObservacionItem[] = observacionesData.map((item: any) => {
          const fecha = new Date(item.fecha)
          const fechaFormateada = fecha.toLocaleDateString("es-AR")
          return {
            id: item.id,
            fecha: fechaFormateada,
            observacion: item.observacion,
            quien: item.quien || "Usuario",
          }
        })
        setObservaciones(observacionesFormateadas)
      } else {
        setObservaciones([])
      }
    } catch (error) {
      errorDev("Error cargando observaciones:", error)
      setObservaciones([])
    }
  }
  
  // Cargar imágenes desde el backend
  const loadImagenes = async () => {
    if (!envio || !isOpen) {
      setImagenes([])
      return
    }

    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/envios/${envio.id}/imagenes`)
      if (response.ok) {
        const imagenesData = await response.json()
        const imagenesFormateadas = imagenesData.map((item: any) => {
          const fecha = new Date(item.fecha)
          const fechaFormateada = fecha.toLocaleDateString("es-AR")
          return {
            id: item.id,
            url: item.urlImagen,
            fecha: fechaFormateada,
            quien: item.quien || "Usuario",
          }
        })
        setImagenes(imagenesFormateadas)
      } else {
        setImagenes([])
      }
    } catch (error) {
      errorDev("Error cargando imágenes:", error)
      setImagenes([])
    }
  }
  
  // Cargar datos de entrega desde el envío
  const loadDatosEntrega = async () => {
    if (!envio || !isOpen) {
      setDatosEntrega(null)
      return
    }
    
    // Cargar el envío completo para obtener los datos de entrega
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/envios/${envio.id}`)
      if (response.ok) {
        const envioData = await response.json()
        if (envioData.estado === "Entregado") {
          setDatosEntrega({
            rolRecibio: envioData.rolRecibio || null,
            nombreRecibio: envioData.nombreRecibio || null,
            dniRecibio: envioData.dniRecibio || null,
          })
        } else {
          setDatosEntrega(null)
        }
      }
    } catch (error) {
      errorDev("Error cargando datos de entrega:", error)
      setDatosEntrega(null)
    }
  }

  // Cargar perfil de usuario y choferes
  useEffect(() => {
    if (!isOpen) return

    const profile = sessionStorage.getItem("userProfile")
    setUserProfile(profile)

    const username = sessionStorage.getItem("username")
    if (username) {
      // Cargar nombre completo del usuario
      const loadUserFullName = async () => {
        try {
          // Intentar desde el backend
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
          if (response.ok) {
            const data = await response.json()
            if (data.content && data.content.length > 0) {
              const user = data.content.find((u: any) => u.usuario === username)
              if (user) {
                setUserFullName(`${user.nombre} ${user.apellido}`.trim())
              }
            }
          }
        } catch (error) {
          warnDev("Error cargando nombre completo:", error)
        }
      }
      loadUserFullName()
    }

    // Cargar choferes si el usuario no es chofer ni cliente
    if (profile && profile !== "Chofer" && profile !== "Cliente") {
      const loadChoferes = async () => {
        try {
          const apiBaseUrl = getApiBaseUrl()
          logDev("Cargando choferes")
          const response = await fetch(`${apiBaseUrl}/usuarios/choferes`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          })
          if (response.ok) {
            const data = await response.json()
            const choferesList = Array.isArray(data) ? data : (data.content || [])
            setChoferes(choferesList)
            logDev(choferesList.length, "choferes cargados")
          } else {
            const errorText = await response.text()
            errorDev("Error del backend al cargar choferes:", response.status, errorText)
            setChoferes([])
          }
        } catch (error: any) {
          errorDev("Error cargando choferes:", error?.message)
          setChoferes([])
        }
      }
      loadChoferes()
    }
  }, [isOpen])

  // Cargar asignaciones desde el historial
  useEffect(() => {
    if (!envio || !isOpen || activeTab !== "asignacion") {
      setAsignaciones([])
      return
    }

    // Filtrar historial para obtener solo asignaciones
    const asignacionesData: AsignacionItem[] = historial
      .filter((item) => {
        // Buscar tanto "Asignado a:" como "Reasignado desde:"
        return item.observaciones && 
               (item.observaciones.includes("Asignado a:") || 
                item.observaciones.includes("Reasignado desde:"))
      })
      .map((item) => {
        let choferNombre = "Desconocido"
        
        // Intentar extraer de "Reasignado desde: X a: Y" (tomar Y)
        const reasignacionMatch = item.observaciones?.match(/Reasignado desde:.*?a:\s*(.+?)(?:\s*\||$)/)
        if (reasignacionMatch) {
          choferNombre = reasignacionMatch[1].trim()
        } else {
          // Intentar extraer de "Asignado a: X"
          const asignacionMatch = item.observaciones?.match(/Asignado a:\s*(.+?)(?:\s*\(|\s*\||$)/)
          if (asignacionMatch) {
            choferNombre = asignacionMatch[1].trim()
          }
        }
        
        // Obtener origen (APP o WEB) - si no está en el historial, asumir WEB por compatibilidad
        const origen = item.origen || "WEB"
        
        // Asegurar que quienAsigno use el valor correcto del historial
        const quienAsigno = item.quien || "Usuario"
        
        return {
          choferNombre,
          desde: origen === "APP" ? "APP" : "WEB",
          fecha: `${item.fecha} ${item.horaEstimada}`,
          quienAsigno: quienAsigno,
        }
      })
      .reverse() // Más recientes primero

    setAsignaciones(asignacionesData)
  }, [historial, envio, isOpen, activeTab])

  // Inicializar mapa de Google Maps
  useEffect(() => {
    if (!isOpen || !envio || !mapRef.current) return

    // Cargar script de Google Maps si no está cargado
    if (!window.google) {
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
        // Si el script ya existe, esperar a que cargue
        const checkInterval = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkInterval)
            initializeMap()
          }
        }, 100)
        return () => clearInterval(checkInterval)
      }

      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || "YOUR_API_KEY"}&libraries=places,geometry`
      script.async = true
      script.defer = true
      script.id = "google-maps-script-detail"
      script.onload = () => initializeMap()
      script.onerror = () => {
        errorDev("Error al cargar Google Maps API")
      }
      document.head.appendChild(script)
    } else {
      initializeMap()
    }

    function initializeMap() {
      if (!mapRef.current || !envio) return

      // Geocodificar la dirección para obtener coordenadas
      const geocoder = new google.maps.Geocoder()
      // Enriquecer la dirección para evitar ambigüedad (ej: "Roca 1768" existe en varias localidades)
      // Usamos: dirección + localidad + CP + Argentina
      const addressParts = [
        envio.direccion,
        envio.localidad,
        envio.codigoPostal,
        "Argentina",
      ]
        .map((p) => (p || "").toString().trim())
        .filter(Boolean)

      const address = addressParts.join(", ")

      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const location = results[0].geometry.location
          setGeolocalizacionEncontrada(true)

          // Crear mapa centrado en la ubicación
          const map = new google.maps.Map(mapRef.current!, {
            zoom: 15,
            center: location,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
          })

          mapInstanceRef.current = map

          // Crear marcador
          const marker = new google.maps.Marker({
            position: location,
            map: map,
            title: address,
          })

          markerRef.current = marker
        } else {
          // Si no se puede geocodificar, mostrar mapa por defecto
          setGeolocalizacionEncontrada(false)
          const map = new google.maps.Map(mapRef.current!, {
            zoom: 10,
            center: { lat: -34.6037, lng: -58.3816 }, // Buenos Aires por defecto
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
          })

          mapInstanceRef.current = map
        }
      })
    }

    return () => {
      // Limpiar marcador al cerrar
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      setGeolocalizacionEncontrada(false)
    }
  }, [isOpen, envio])

  const handleDelete = () => {
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (envio && onDelete) {
      onDelete(envio.id)
      setIsDeleteDialogOpen(false)
      onClose()
    }
  }

  const handleReimprimirNoflex = async () => {
    if (!envio) return

    try {
      // Dimensiones 10x15 en puntos
      const width = 283.46 // 10cm en puntos
      const height = 425.2 // 15cm en puntos

      // Crear PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [width, height],
      })

      // Generar QR usando el mismo QR data guardado
      const qrDataToUse = envio.qrData || `${envio.tracking}-${envio.id}`
      const qrCodeDataUrl = await QRCode.toDataURL(qrDataToUse, {
        width: 120,
        margin: 1,
      })

      // Obtener fecha de carga formateada
      const fecha = envio.fecha ? new Date(envio.fecha) : new Date()
      const fechaFormateada = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`

      // Configuración de márgenes y posiciones
      const marginLeft = 10
      const marginTop = 10
      let currentY = marginTop

      // Logo y título (blanco y negro)
      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 0, 0)
      const titleWidth = pdf.getTextWidth("MVG")
      const titleX = (width - titleWidth) / 2
      pdf.text("MVG", titleX, currentY)
      currentY += 18

      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(1.5)
      pdf.line(marginLeft, currentY - 8, width - marginLeft, currentY - 8)

      // QR Code
      const qrSize = 80
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(1.5)
      pdf.roundedRect(marginLeft, currentY, qrSize, qrSize, 2, 2, "S")
      pdf.addImage(qrCodeDataUrl, "PNG", marginLeft + 2, currentY + 2, qrSize - 4, qrSize - 4)
      const qrRight = marginLeft + qrSize + 6
      const qrBottom = currentY + qrSize

      // Localidad: borde negro, texto negro (sin relleno de color)
      const localidadText = (envio.localidad || "Sin localidad").toUpperCase()
      pdf.setFontSize(15)
      pdf.setFont("helvetica", "bold")
      const localidadLines = pdf.splitTextToSize(localidadText, 150)
      const localidadTextWidth = Math.max(...localidadLines.map((line: string) => pdf.getTextWidth(line)))
      const lineHeight = 13
      const localidadTextHeight = localidadLines.length * lineHeight
      const padding = 6
      const boxWidth = localidadTextWidth + (padding * 2)
      const boxHeight = localidadTextHeight + (padding * 2)
      const boxX = qrRight
      const boxY = currentY + 6
      const borderRadius = 3
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(1.5)
      pdf.roundedRect(boxX, boxY, boxWidth, boxHeight, borderRadius, borderRadius, "S")
      pdf.setTextColor(0, 0, 0)
      const totalTextHeight = localidadLines.length * lineHeight
      const startY = boxY + (boxHeight - totalTextHeight) / 2 + lineHeight - 2
      localidadLines.forEach((line: string, index: number) => {
        const lineWidth = pdf.getTextWidth(line)
        const textX = boxX + (boxWidth - lineWidth) / 2
        const textY = startY + (index * lineHeight)
        pdf.text(line, textX, textY)
      })

      let infoY = currentY + boxHeight + 12
      pdf.setFontSize(7)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(0, 0, 0)
      pdf.text(fechaFormateada, qrRight, infoY)
      infoY += 9
      pdf.text(`Rte.: ${envio.cliente}`, qrRight, infoY)
      infoY += 9
      pdf.text(`Venta: ${envio.nombreDestinatario}`, qrRight, infoY)
      infoY += 9
      pdf.text(`Envio: ${envio.nombreDestinatario}`, qrRight, infoY)

      // Espacio después del bloque superior
      currentY = qrBottom + 10

      // Sección Destinatario
      pdf.setFontSize(7)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 0, 0)
      pdf.text("DESTINATARIO", marginLeft, currentY)
      const destWidth = pdf.getTextWidth("DESTINATARIO")
      pdf.setLineWidth(0.5)
      pdf.line(marginLeft, currentY + 2, marginLeft + destWidth, currentY + 2)
      currentY += 10

      pdf.setFontSize(8.5)
      pdf.text(envio.nombreDestinatario, marginLeft, currentY)
      currentY += 9

      pdf.setFont("helvetica", "normal")
      pdf.text(`Tel: ${envio.telefono}`, marginLeft, currentY)
      currentY += 9

      const direccionLines = pdf.splitTextToSize(envio.direccion, width - marginLeft * 2 - 20)
      pdf.text(direccionLines, marginLeft, currentY)
      currentY += direccionLines.length * 9 + 5

      if (envio.observaciones) {
        pdf.setFontSize(7.5)
        pdf.setFont("helvetica", "italic")
        pdf.setTextColor(0, 0, 0)
        const obsLines = pdf.splitTextToSize(`Obs: ${envio.observaciones}`, width - marginLeft * 2 - 20)
        pdf.text(obsLines, marginLeft, currentY)
        currentY += obsLines.length * 9 + 3
      }

      // Cobrar en Efectivo
      if (envio.totalACobrar && String(envio.totalACobrar).trim() !== "") {
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        pdf.text(`Cobrar en Efectivo: $ ${String(envio.totalACobrar).trim()}`, marginLeft, currentY)
        currentY += 11
      }

      // Cambio o Retiro (badge)
      if (envio.cambioRetiro && String(envio.cambioRetiro).trim() !== "") {
        const valor = String(envio.cambioRetiro).trim().toUpperCase()
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

      // Descargar PDF
      pdf.save(`etiqueta-${envio.tracking}-10x15.pdf`)
    } catch (error) {
      errorDev("Error generando PDF:", error)
      alert("Error al generar el PDF. Por favor, intenta nuevamente.")
    }
  }

  const handleWhatsApp = () => {
    if (!envio || !envio.telefono) return

    // Limpiar el teléfono (quitar espacios, guiones, etc.)
    const phone = envio.telefono.replace(/\D/g, "")
    
    // Formato: +54 para Argentina (si no tiene código de país)
    const phoneNumber = phone.startsWith("54") ? `+${phone}` : `+54${phone}`
    
    // Abrir WhatsApp Web
    const whatsappUrl = `https://wa.me/${phoneNumber}`
    window.open(whatsappUrl, "_blank")
  }

  const handleOpenAddEstado = () => {
    // Establecer fecha y hora actual por defecto
    const now = new Date()
    const fecha = now.toISOString().split("T")[0] // YYYY-MM-DD
    const horario = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
    
    setNuevoEstado({
      fecha,
      horario,
      estado: "Retirado", // Estado por defecto
    })
    setIsAddEstadoModalOpen(true)
  }

  const handleCloseAddEstado = () => {
    setIsAddEstadoModalOpen(false)
    setNuevoEstado({
      fecha: "",
      horario: "",
      estado: "",
    })
  }

  const handleAgregarEstado = () => {
    if (!nuevoEstado.fecha || !nuevoEstado.horario || !nuevoEstado.estado) {
      return
    }

    // Formatear fecha para mostrar
    const fechaFormateada = new Date(nuevoEstado.fecha).toLocaleDateString("es-AR")
    const fechaCompleta = `${fechaFormateada} ${nuevoEstado.horario}`

    // Crear nuevo item de historial
    const nuevoItem: HistorialItem = {
      id: Date.now(),
      estado: nuevoEstado.estado,
      fecha: fechaCompleta,
      horaEstimada: nuevoEstado.horario,
      quien: "Usuario actual", // Por ahora hardcodeado, después se puede obtener del usuario logueado
    }

    setHistorial([...historial, nuevoItem])
    handleCloseAddEstado()
  }

  const handleEliminarHistorial = (id: number) => {
    setHistorial(historial.filter((item) => item.id !== id))
  }

  const handleOpenAddObservacion = () => {
    setNuevaObservacion({
      observacion: "",
    })
    setIsAddObservacionModalOpen(true)
  }

  const handleCloseAddObservacion = () => {
    setIsAddObservacionModalOpen(false)
    setNuevaObservacion({
      observacion: "",
    })
  }

  const handleGuardarObservacion = () => {
    if (!nuevaObservacion.observacion.trim()) {
      return
    }

    // Obtener fecha y hora actual
    const now = new Date()
    const fechaFormateada = now.toLocaleDateString("es-AR")
    const username = sessionStorage.getItem("username") || "Usuario"

    // Crear nueva observación
    const nuevaItem: ObservacionItem = {
      id: Date.now(),
      fecha: fechaFormateada,
      observacion: nuevaObservacion.observacion,
      quien: username,
    }

    setObservaciones([...observaciones, nuevaItem])
    handleCloseAddObservacion()
  }

  const handleEliminarObservacion = (id: number) => {
    setObservaciones(observaciones.filter((item) => item.id !== id))
  }

  const handleAsignar = () => {
    if (!envio) return

    // Validaciones iguales que en la app móvil
    if (envio.estado === "Entregado" || envio.estado === "Cancelado") {
      alert('No se pueden asignar envíos que estén en estado "Entregado" o "Cancelado".')
      return
    }

    // Si el usuario es chofer, auto-asignar
    if (userProfile === "Chofer") {
      handleAutoAsignar()
    } else {
      // Si no es chofer, abrir modal para seleccionar chofer
      setIsAsignarModalOpen(true)
    }
  }

  const handleAutoAsignar = async () => {
    if (!envio) return

    // Validar que el envío no esté en "A retirar" para choferes
    if (envio.estado === "A retirar") {
      alert("El envío debe ser colectado primero.")
      return
    }

    try {
      // Obtener ID del usuario chofer desde sessionStorage o localStorage
      const username = sessionStorage.getItem("username")
      let choferId = -1
      
      // Buscar el ID del chofer desde la lista de choferes o usuarios
      try {
        // Primero intentar desde la lista de choferes
        const apiBaseUrl = getApiBaseUrl()
        const choferesResponse = await fetch(`${apiBaseUrl}/usuarios/choferes`)
        if (choferesResponse.ok) {
          const choferesData = await choferesResponse.json()
          const choferList = Array.isArray(choferesData.content) ? choferesData.content : choferesData
          const chofer = choferList.find((c: any) => c.usuario === username)
          if (chofer) {
            choferId = chofer.id
          }
        }
        
        // Si no se encontró, buscar en todos los usuarios
        if (choferId === -1) {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/usuarios?page=0&size=1000`)
          if (response.ok) {
            const data = await response.json()
            const users = Array.isArray(data.content) ? data.content : []
            const user = users.find((u: any) => u.usuario === username)
            if (user) choferId = user.id
          }
        }
      } catch (error) {
        warnDev("Error obteniendo ID del chofer:", error)
      }

      const choferNombre = userFullName || "Chofer"
      const apiBaseUrl = getApiBaseUrl()
      await fetch(`${apiBaseUrl}/envios/${envio.id}/asignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choferId,
          choferNombre,
          usuarioAsignador: userFullName || "Chofer",
          origen: "WEB", // Siempre WEB desde la aplicación web
        }),
      })

      // Recargar historial para actualizar asignaciones
      const historialResponse = await fetch(`${apiBaseUrl}/envios/${envio.id}/historial`)
      if (historialResponse.ok) {
        const historialData = await historialResponse.json()
        const historialFormateado: HistorialItem[] = historialData.map((item: any) => {
          const fecha = new Date(item.fecha)
          return {
            id: item.id,
            estado: item.estado,
            fecha: fecha.toLocaleDateString("es-AR"),
            horaEstimada: fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
            quien: item.quien || "Usuario",
            observaciones: item.observaciones,
            origen: item.origen,
          }
        })
        setHistorial(historialFormateado)
      }
    } catch (error) {
      errorDev("Error asignando envío:", error)
      alert("Error al asignar el envío")
    }
  }

  const handleConfirmarAsignacion = async () => {
    if (!choferSeleccionado || !envio) {
      alert("Debes seleccionar un chofer para asignar el envío.")
      return
    }

    // Validar que el envío no esté en estados finales (excepto para PENDIENTES DEPÓSITO)
    const esPendientesDeposito = choferSeleccionado.id === -1
    if (!esPendientesDeposito && (envio.estado === "Entregado" || envio.estado === "Cancelado")) {
      alert('No se pueden asignar envíos que estén en estado "Entregado" o "Cancelado".')
      return
    }

    try {
      const choferNombre = choferSeleccionado.id === -1 
        ? "PENDIENTES DEPÓSITO"
        : `${choferSeleccionado.nombre} ${choferSeleccionado.apellido}`.trim()

      const apiBaseUrl = getApiBaseUrl()
      logDev("Asignando envío a chofer")
      const response = await fetch(`${apiBaseUrl}/envios/${envio.id}/asignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choferId: choferSeleccionado.id,
          choferNombre,
          usuarioAsignador: userFullName || "Usuario",
          origen: "WEB", // Siempre WEB desde la aplicación web
        }),
      })

      if (!response.ok) {
        let errorMessage = "Error al asignar"
        const errorText = await response.text()
        if (errorText) {
          try {
            const errorBody = JSON.parse(errorText)
            if (typeof errorBody?.message === "string") errorMessage = errorBody.message
          } catch (_) {
            errorMessage = errorText
          }
        }
        errorDev("Error del backend al asignar:", response.status, errorMessage)
        throw new Error(errorMessage)
      }

      logDev("Envío asignado correctamente")
      onAssignSuccess?.()

      // Recargar historial para actualizar asignaciones
      const historialResponse = await fetch(`${apiBaseUrl}/envios/${envio.id}/historial`)
      if (historialResponse.ok) {
        const historialData = await historialResponse.json()
        const historialFormateado: HistorialItem[] = historialData.map((item: any) => {
          const fecha = new Date(item.fecha)
          return {
            id: item.id,
            estado: item.estado,
            fecha: fecha.toLocaleDateString("es-AR"),
            horaEstimada: fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
            quien: item.quien || "Usuario",
            observaciones: item.observaciones,
            origen: item.origen,
          }
        })
        setHistorial(historialFormateado)
      }

      setIsAsignarModalOpen(false)
      setChoferSeleccionado(null)
    } catch (error: any) {
      errorDev("Error asignando envío:", error?.message)
      if (error?.message === "Failed to fetch" || error?.name === "TypeError") {
        alert("Error: No se pudo conectar con el servidor. Verifica tu conexión y que el backend esté accesible.")
      } else {
        alert(error.message || "Error al asignar el envío")
      }
    }
  }

  if (!isOpen || !envio) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in-0 backdrop-blur-sm"
      onClick={onClose}
      role="button"
      tabIndex={-1}
    >
      <div
        className="bg-white rounded-2xl w-[95vw] h-[90vh] max-w-7xl flex flex-col animate-in zoom-in-95 shadow-2xl border border-gray-200/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50/50 flex gap-6 items-center justify-between">
          <div className="flex gap-6">
            {[
              { id: "general", label: "GENERAL" },
              { id: "historial", label: "HISTORIAL" },
              { id: "observaciones", label: "OBSERVACIO..." },
              { id: "imagenes", label: "IMAGENES" },
              { id: "asignacion", label: "ASIGNACION..." },
              ...(envio?.estado === "Entregado" ? [{ id: "entregado", label: "ENTREGADO" }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 transition-all relative ${
                  activeTab === tab.id
                    ? "border-[#6B46FF] text-[#6B46FF] font-semibold"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-gray-50/30 to-white">
          <div className="grid grid-cols-3 gap-6">
            {/* Left Column - Form Fields (según orden de imagen) */}
            <div className="col-span-2 space-y-3">
              {activeTab === "general" && (
                <div className="space-y-3">
                  {/* Fila 1: IDML, Tracking, ID_MVG, Cliente */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">IDML</label>
                      <Input 
                        value={normalizeValue(envio.idml)} 
                        className="h-9 text-sm border-gray-300 bg-white shadow-sm" 
                        readOnly 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Tracking</label>
                      <Input value={normalizeValue(envio.tracking)} className="h-9 text-sm border-gray-300 bg-white font-mono shadow-sm" readOnly />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">ID_MVG</label>
                      <Input value={normalizeValue(envio.idMvg ?? envio.tracking)} className="h-9 text-sm border-gray-300 bg-white font-mono font-semibold shadow-sm" readOnly />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Cliente</label>
                      <Input value={normalizeValue(envio.cliente)} className="h-9 text-sm border-gray-300 bg-white font-semibold shadow-sm" readOnly />
                    </div>
                  </div>

                  {/* Fila 2: fecha ingreso, fecha venta, fecha despacho */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Fecha Ingreso</label>
                      <Input
                        value={envio.fecha ? new Date(envio.fecha).toLocaleDateString("es-AR") : "11/01/2026"}
                        className="h-9 text-sm border-gray-300 bg-white shadow-sm"
                        readOnly
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Fecha Venta</label>
                      <Input
                        value={envio.fechaVenta ? new Date(envio.fechaVenta).toLocaleString("es-AR") : "00/00/0000 00:00:00"}
                        className="h-9 text-sm border-gray-300 bg-white shadow-sm"
                        readOnly
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Fecha Despacho</label>
                      <Input
                        value={envio.fechaLlegue ? new Date(envio.fechaLlegue).toLocaleDateString("es-AR") : "12/01/2026"}
                        className="h-9 text-sm border-gray-300 bg-white shadow-sm"
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Fila 3: valor declarado del paquete, deadline, cant. bultos */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Valor declarado del paquete</label>
                      <Input 
                        value={envio.totalACobrar ? `$ ${parseFloat(envio.totalACobrar).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$ 0.00"} 
                        className="h-9 text-sm border-gray-300 bg-white shadow-sm" 
                        readOnly 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Deadline</label>
                      <Input 
                        value={envio.deadline 
                          ? (() => {
                              const deadlineDate = new Date(envio.deadline);
                              const formatted = deadlineDate.toLocaleDateString('es-AR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric'
                              }) + ' ' + deadlineDate.toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                              return formatted + ' Max:' + formatted;
                            })()
                          : "00/00/0000 Max:00/00/0000"} 
                        className="h-9 text-sm border-gray-300 bg-white shadow-sm" 
                        readOnly 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Cant. Bultos</label>
                      <Input value="1" className="h-9 text-sm border-gray-300 bg-white shadow-sm" readOnly />
                    </div>
                  </div>

                  {/* Fila 4: Peso total, metodo de envio, costo de envío (oculto para Coordinador) y recibido por */}
                  <div className={userProfile === "Coordinador" ? "grid grid-cols-3 gap-4" : "grid grid-cols-4 gap-4"}>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Peso total</label>
                      <Input 
                        value={normalizeValue(envio.peso) || "0"} 
                        className="h-9 text-sm border-gray-300 bg-white shadow-sm" 
                        readOnly 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Método de envío</label>
                      <Input 
                        value={normalizeValue(envio.metodoEnvio)} 
                        className="h-9 text-sm border-gray-300 bg-white shadow-sm" 
                        readOnly 
                      />
                    </div>
                    {userProfile !== "Coordinador" && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-normal text-gray-600">Costo de envío</label>
                        <Input 
                          value={envio.costoEnvio 
                            ? `$ ${parseFloat(envio.costoEnvio).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : "$ 0.00"} 
                          className="h-9 text-sm border-gray-300 bg-white shadow-sm" 
                          readOnly 
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-normal text-gray-600">Recibido por</label>
                      <Input value="Placeholder" className="h-9 text-sm border-gray-300 bg-white shadow-sm text-gray-400 italic" readOnly />
                    </div>
                  </div>

                  {/* QR Code Section con campos a la derecha */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-4 gap-4">
                      {/* QR Code */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">QR Code</label>
                        <div className="bg-white border-2 border-gray-200 rounded-xl p-4 flex items-center justify-center shadow-lg">
                          {qrImageUrl ? (
                            <img src={qrImageUrl} alt="QR Code" className="w-44 h-44" />
                          ) : (
                            <div className="w-44 h-44 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-gray-400 text-xs">Cargando QR...</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Campos a la derecha del QR */}
                      <div className="col-span-3 space-y-2.5">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Link Publico</label>
                          <Input value={publicLink} className="h-9 text-sm border-gray-300 bg-white font-mono text-xs shadow-sm" readOnly />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Observaciones</label>
                          <Input value={normalizeValue(envio.observaciones)} className="h-9 text-sm border-gray-300 bg-white shadow-sm" readOnly />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Referencia domicilio</label>
                          <Input 
                            value={normalizeValue(envio.cambioRetiro)} 
                            className="h-9 text-sm border-gray-300 bg-white shadow-sm" 
                            readOnly 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* HISTORIAL Tab */}
              {activeTab === "historial" && (
                <div className="space-y-4">
                  <Button
                    onClick={handleOpenAddEstado}
                    className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    AGREGAR NUEVO ESTADO
                  </Button>
                  
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Estado</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Hora estimada</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Quien</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Eliminar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historial.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                              No hay historial disponible
                            </td>
                          </tr>
                        ) : (
                          historial.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">{item.estado}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{item.fecha}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{item.horaEstimada}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{item.quien}</td>
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => handleEliminarHistorial(item.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-all"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* OBSERVACIONES Tab */}
              {activeTab === "observaciones" && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Button
                      onClick={handleOpenAddObservacion}
                      className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      AGREGAR
                    </Button>
                  </div>
                  
                  {/* Tabla de observaciones */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Observación</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Quien</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Eliminar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {observaciones.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                              No hay observaciones registradas
                            </td>
                          </tr>
                        ) : (
                          observaciones.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-700">{item.fecha}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{item.observacion}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{item.quien}</td>
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => handleEliminarObservacion(item.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-all"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* IMAGENES Tab */}
              {activeTab === "imagenes" && (
                <div className="space-y-6">
                  {/* Listado de fotos existentes */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Listado de fotos existentes</h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Imprimir</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Foto</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Quien</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imagenes.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                              No hay fotos existentes
                            </td>
                          </tr>
                        ) : (
                          imagenes.map((imagen) => (
                            <tr key={imagen.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => {
                                    // Descargar la imagen
                                    const link = document.createElement('a')
                                    link.href = imagen.url
                                    link.download = `imagen-envio-${imagen.id}.jpg`
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                  }}
                                  className="p-2 text-[#6B46FF] hover:text-[#5a3ae6] hover:bg-purple-50 rounded transition-all"
                                  title="Descargar imagen"
                                >
                                  <Printer className="h-5 w-5" />
                                </button>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                <img src={imagen.url} alt="Foto" className="w-16 h-16 object-cover rounded" />
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">{imagen.quien}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Listado de fotos a guardar */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Listado de fotos a guardar</h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Nombre</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-500">
                            No hay fotos para guardar
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-center">
                    <Button className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all">
                      AGREGAR FOTO
                    </Button>
                  </div>
                </div>
              )}

              {/* ASIGNACION Tab */}
              {/* ENTREGADO Tab - Solo visible si el envío está entregado */}
              {activeTab === "entregado" && (
                <div className="space-y-6">
                  {datosEntrega ? (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Datos de quien recibió el envío</h3>
                      </div>
                      <div className="p-4 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide mb-1">Rol</label>
                          <div className="text-sm text-gray-900 mt-1">{datosEntrega.rolRecibio || "-"}</div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide mb-1">Nombre completo</label>
                          <div className="text-sm text-gray-900 mt-1">{datosEntrega.nombreRecibio || "-"}</div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide mb-1">DNI</label>
                          <div className="text-sm text-gray-900 mt-1">{datosEntrega.dniRecibio || "-"}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                      <p className="text-sm text-gray-500">No hay datos de entrega disponibles</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "asignacion" && (
                <div className="space-y-4">
                  {/* Botón de asignar (solo para usuarios no-chofer y no-cliente) */}
                  {userProfile && userProfile !== "Chofer" && userProfile !== "Cliente" && (
                    <Button
                      onClick={handleAsignar}
                      className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      ASIGNAR
                    </Button>
                  )}

                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Asignado a</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Desde</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Quien asigno</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asignaciones.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                              No hay asignaciones registradas
                            </td>
                          </tr>
                        ) : (
                          asignaciones.map((asignacion, index) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">{asignacion.choferNombre}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{asignacion.desde}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{asignacion.fecha}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{asignacion.quienAsigno}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Map */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Mapa</label>
                <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-lg" style={{ height: "400px" }}>
                  <div ref={mapRef} className="w-full h-full" />
                </div>
                {!geolocalizacionEncontrada && envio.direccion && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-2.5 flex items-center gap-2">
                    <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                    <p className="text-xs font-semibold text-red-700">Dirección sin geolocalización!!</p>
                  </div>
                )}
              </div>

              {/* Address Details */}
              <div className="space-y-2.5 bg-gray-50/50 rounded-xl p-3.5 border border-gray-200">
                {/* Dirección - Ocupa todo el ancho */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Dirección</label>
                  <Input value={normalizeValue(envio.direccion)} className="h-8 text-xs border-gray-300 bg-white shadow-sm" readOnly />
                </div>
                
                {/* Resto de campos en 2 columnas */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">CP</label>
                    <Input value={normalizeValue(envio.codigoPostal)} className="h-8 text-xs border-gray-300 bg-white font-mono shadow-sm" readOnly />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Recibe</label>
                    <Input value={normalizeValue(envio.nombreDestinatario)} className="h-8 text-xs border-gray-300 bg-white shadow-sm" readOnly />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Tel</label>
                    <div className="flex items-center gap-2">
                      <Input value={normalizeValue(envio.telefono)} className="h-8 text-xs border-gray-300 bg-white flex-1 font-mono shadow-sm" readOnly />
                      <button
                        onClick={handleWhatsApp}
                        className="h-8 w-8 bg-green-500 hover:bg-green-600 rounded-lg flex items-center justify-center shadow-md hover:shadow-lg transition-all"
                      >
                        <span className="text-white text-xs font-bold">WA</span>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#6B46FF] uppercase tracking-wide">Email</label>
                    <Input value={normalizeValue(envio.email)} className="h-8 text-xs border-gray-300 bg-white shadow-sm" readOnly />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={handleDelete}
                  className="w-full bg-red-600 hover:bg-red-700 text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  ELIMINAR
                </Button>
                {envio.origen !== "Flex" && (
                  <Button
                    onClick={handleReimprimirNoflex}
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    REIMPRIMIR NOFLEX
                  </Button>
                )}
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="w-full border-2 border-gray-300 hover:border-gray-400 h-9 text-xs font-semibold"
                >
                  CERRAR
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas eliminar el envío con tracking <strong>{envio?.tracking}</strong>? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Estado Modal */}
      {isAddEstadoModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 animate-in fade-in-0 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl border border-gray-200/50 animate-in zoom-in-95">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Agregar Nuevo Estado</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700">Fecha</label>
                  <Input
                    type="date"
                    value={nuevoEstado.fecha}
                    onChange={(e) => setNuevoEstado({ ...nuevoEstado, fecha: e.target.value })}
                    className="h-9 text-sm border-gray-300 bg-white shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700">Horario</label>
                  <Input
                    type="time"
                    value={nuevoEstado.horario}
                    onChange={(e) => setNuevoEstado({ ...nuevoEstado, horario: e.target.value })}
                    className="h-9 text-sm border-gray-300 bg-white shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700">Estado</label>
                  <Select value={nuevoEstado.estado} onValueChange={(value) => setNuevoEstado({ ...nuevoEstado, estado: value })}>
                    <SelectTrigger className="h-9 text-sm border-gray-300 bg-white shadow-sm">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosEnvio.map((estado) => (
                        <SelectItem key={estado} value={estado}>
                          {estado}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  onClick={handleCloseAddEstado}
                  className="bg-red-500 hover:bg-red-600 text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  CERRAR
                </Button>
                <Button
                  onClick={handleAgregarEstado}
                  className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  AGREGAR
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Observacion Modal */}
      {isAddObservacionModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 animate-in fade-in-0 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl border border-gray-200/50 animate-in zoom-in-95">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Agregar Observación</h3>
              
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">Observación</label>
                <div className="relative">
                  <Pencil className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={nuevaObservacion.observacion}
                    onChange={(e) => setNuevaObservacion({ observacion: e.target.value })}
                    className="h-9 text-sm border-gray-300 bg-white shadow-sm pl-8"
                    placeholder="Escribir observación..."
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  onClick={handleCloseAddObservacion}
                  className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  CERRAR
                </Button>
                <Button
                  onClick={handleGuardarObservacion}
                  className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  GUARDAR
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de selección de chofer (stopPropagation para no cerrar el modal principal al hacer clic) */}
      {isAsignarModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 animate-in fade-in-0 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-xl w-[90vw] max-w-md p-6 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Asignar a:</h2>
            <p className="text-sm text-gray-600 mb-4">Selecciona un chofer (obligatorio)</p>
            
            <div className="max-h-64 overflow-y-auto mb-4 space-y-2">
              {/* Mostrar "PENDIENTES DEPÓSITO" primero si el usuario no es chofer */}
              {userProfile && userProfile !== "Chofer" && (
                <button
                  onClick={() => setChoferSeleccionado(PENDIENTES_DEPOSITO)}
                  className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                    choferSeleccionado?.id === PENDIENTES_DEPOSITO.id
                      ? "border-[#6B46FF] bg-[#6B46FF]/10"
                      : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${choferSeleccionado?.id === PENDIENTES_DEPOSITO.id ? "text-[#6B46FF]" : "text-gray-900"}`}>
                      {PENDIENTES_DEPOSITO.nombre} {PENDIENTES_DEPOSITO.apellido}
                    </span>
                    {choferSeleccionado?.id === PENDIENTES_DEPOSITO.id && (
                      <span className="text-[#6B46FF] font-bold">✓</span>
                    )}
                  </div>
                </button>
              )}
              
              {choferes.map((chofer) => (
                <button
                  key={chofer.id}
                  onClick={() => setChoferSeleccionado(chofer)}
                  className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                    choferSeleccionado?.id === chofer.id
                      ? "border-[#6B46FF] bg-[#6B46FF]/10"
                      : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${choferSeleccionado?.id === chofer.id ? "text-[#6B46FF]" : "text-gray-900"}`}>
                      {chofer.nombre} {chofer.apellido}
                    </span>
                    {choferSeleccionado?.id === chofer.id && (
                      <span className="text-[#6B46FF] font-bold">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setIsAsignarModalOpen(false)
                  setChoferSeleccionado(null)
                }}
                variant="outline"
                className="flex-1 border-2 border-gray-300 hover:border-gray-400"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarAsignacion}
                disabled={!choferSeleccionado}
                className="flex-1 bg-[#6B46FF] hover:bg-[#5a3ae6] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Asignar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

