"use client"

import { useState, useEffect, useRef } from "react"
import type { LucideIcon } from "lucide-react"
import { History, Images, LayoutList, MessageSquareText, UserCog, X, Pencil, Printer, UserRoundCheck } from "lucide-react"
import QRCode from "qrcode"
import jsPDF from "jspdf"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiBaseUrl } from "@/lib/api-config"
import { cn } from "@/lib/utils"
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
    origen?: string
    latDestino?: number | null
    lngDestino?: number | null
  } | null
  onDelete?: (envioId: number) => void
  onAssignSuccess?: () => void
  /** Mismo comportamiento que el cambio de estado desde la tabla: valida (Flex, permisos, A retirar→Retirado) y persiste en backend. Retorna true si se actualizó correctamente. */
  onEstadoChange?: (envioId: number, nuevoEstado: string) => Promise<boolean>
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

/** Estética Nexo Pedidos (diferenciada del layout morado / tarjetas del referente; sin cambiar lógica) */
const lbl = "block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"
const fld =
  "h-9 text-sm border-slate-200 bg-slate-50/90 text-slate-900 shadow-none read-only:cursor-default focus-visible:border-teal-500/40 focus-visible:ring-1 focus-visible:ring-teal-500/25"
const btnPrimary = "bg-teal-600 hover:bg-teal-700 text-white shadow-sm hover:shadow-md transition-colors"
const btnGhost = "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
const tblWrap =
  "overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-sm ring-1 ring-slate-100/60"
const tblHead = "bg-slate-100/90"
const tblTh = "px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600"
const tblRow = "border-b border-slate-100/80 transition-colors hover:bg-teal-50/30"
const panelBar = "border-b border-slate-200/80 bg-slate-100/80 px-4 py-2.5"
const panelBarTitle = "text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600"

type EnvioDetailTab = "general" | "historial" | "observaciones" | "imagenes" | "asignacion"

const DETAIL_NAV: { id: EnvioDetailTab; label: string; Icon: LucideIcon }[] = [
  { id: "general", label: "Resumen", Icon: LayoutList },
  { id: "historial", label: "Actividad", Icon: History },
  { id: "observaciones", label: "Observaciones", Icon: MessageSquareText },
  { id: "imagenes", label: "Imágenes", Icon: Images },
  { id: "asignacion", label: "Asignación", Icon: UserCog },
]

export function EnvioDetailModal({ isOpen, onClose, envio, onDelete, onAssignSuccess, onEstadoChange }: EnvioDetailModalProps) {
  // Normalizar valores null a cadenas vacías para evitar errores de React
  const normalizeValue = (value: string | null | undefined): string => {
    return value ?? ""
  }
  
  const [activeTab, setActiveTab] = useState<EnvioDetailTab>("general")
  const [recepcionDialogOpen, setRecepcionDialogOpen] = useState(false)
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
        // El link público debe usar SIEMPRE trackingToken.
        // Si no vino en el envío, pedirlo al backend (que lo genera si falta).
        let token = envio.trackingToken
        if (!token) {
          const lookup = (envio.idMvg || "").trim()
          if (lookup) {
            const apiBaseUrl = getApiBaseUrl()
            const resp = await fetch(`${apiBaseUrl}/envios/buscar-por-id-nx/${encodeURIComponent(lookup)}`)
            if (resp.ok) {
              const data = await resp.json()
              token = data?.trackingToken || ""
            }
          }
        }
        if (!token) {
          // No generar links inválidos; dejar vacío hasta que backend tenga token.
          setPublicLink("")
          setQrImageUrl("")
          return
        }
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

  // Cargar historial desde el backend (reutilizado al agregar estado desde el modal)
  const loadHistorial = async () => {
    if (!envio) return
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/envios/${envio.id}/historial`)
      if (response.ok) {
        const historialData = await response.json()
        const historialFormateado: HistorialItem[] = historialData.map((item: any) => {
          const fecha = new Date(item.fecha)
          const fechaFormateada = fecha.toLocaleDateString("es-AR")
          const horaFormateada = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
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
        const historialFiltrado: HistorialItem[] = []
        let ultimoEstado: string | null = null
        for (const item of historialFormateado) {
          if (ultimoEstado === null || item.estado !== ultimoEstado) {
            historialFiltrado.push(item)
            ultimoEstado = item.estado
          }
        }
        setHistorial(historialFiltrado)
      } else {
        setHistorial([])
      }
    } catch (error) {
      errorDev("Error cargando historial:", error)
      setHistorial([])
    }
  }

  useEffect(() => {
    if (!envio || !isOpen) {
      setHistorial([])
      return
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

  const handleOpenRecepcionDialog = () => {
    setRecepcionDialogOpen(true)
    void loadDatosEntrega()
  }

  useEffect(() => {
    if (!isOpen) setRecepcionDialogOpen(false)
  }, [isOpen])

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

      const setMapWithLocation = (lat: number, lng: number, title: string) => {
        setGeolocalizacionEncontrada(true)
        const location = { lat, lng }
        const map = new google.maps.Map(mapRef.current!, {
          zoom: 15,
          center: location,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        })
        mapInstanceRef.current = map
        const marker = new google.maps.Marker({
          position: location,
          map: map,
          title,
        })
        markerRef.current = marker
      }

      if (envio.latDestino != null && envio.lngDestino != null) {
        setMapWithLocation(envio.latDestino, envio.lngDestino, envio.direccion || "Destino")
        return
      }

      // Sin coordenadas guardadas: si además no tiene CP, tratamos como "sin geolocalización" (dirección dudosa)
      // y no geocodificamos para no mostrar un pin en cualquier lado. Si tiene CP, geocodificamos para mostrar el pin.
      const sinCP = !envio.codigoPostal || String(envio.codigoPostal).trim() === ""
      if (sinCP) {
        setGeolocalizacionEncontrada(false)
        const map = new google.maps.Map(mapRef.current!, {
          zoom: 10,
          center: { lat: -34.6037, lng: -58.3816 },
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        })
        mapInstanceRef.current = map
        return
      }

      const geocoder = new google.maps.Geocoder()
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
          setMapWithLocation(location.lat(), location.lng(), address)
        } else {
          setGeolocalizacionEncontrada(false)
          const map = new google.maps.Map(mapRef.current!, {
            zoom: 10,
            center: { lat: -34.6037, lng: -58.3816 },
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

  const getOrigenVentaLabel = (origen: string | undefined): string => {
    if (!origen || !String(origen).trim()) return "Venta x afuera"
    const o = String(origen).trim()
    if (o === "Flex" || o === "MercadoLibre" || /meli|mercado|flex/i.test(o)) return "Meli"
    if (o === "Shopify") return "Shopify"
    if (o === "VTEX" || o === "Vtex") return "VTEX"
    if (o === "Tienda Nube") return "Tienda Nube"
    return "Venta x afuera"
  }

  const handleReimprimirNoflex = async () => {
    if (!envio) return

    try {
      const width = 283.46
      const height = 425.2
      const marginLeft = 18
      const marginRight = 18
      const marginTop = 14

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [width, height],
      })

      const qrDataToUse = envio.qrData || `${envio.tracking}-${envio.id}`
      const qrCodeDataUrl = await QRCode.toDataURL(qrDataToUse, {
        width: 120,
        margin: 1,
      })

      const fecha = envio.fecha ? new Date(envio.fecha) : new Date()
      const fechaFormateada = `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`

      const bulletR = 1.4
      const bulletX = marginLeft + bulletR + 1
      let currentY = marginTop + 4

      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 0, 0)
      pdf.text("NEXO", (width - pdf.getTextWidth("NEXO")) / 2, currentY)
      currentY += 14

      const barHeight = 20
      pdf.setFillColor(0, 0, 0)
      pdf.rect(0, currentY - 8, width, barHeight, "F")
      const zonaText = (envio.localidad || "Sin zona").toUpperCase()
      pdf.setFontSize(12)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(255, 255, 255)
      pdf.text(zonaText, (width - pdf.getTextWidth(zonaText)) / 2, currentY + 6)
      pdf.setTextColor(0, 0, 0)
      currentY += barHeight + 14

      const qrSize = 72
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(1)
      pdf.roundedRect(marginLeft, currentY, qrSize, qrSize, 2, 2, "S")
      pdf.addImage(qrCodeDataUrl, "PNG", marginLeft + 2, currentY + 2, qrSize - 4, qrSize - 4)
      const qrRight = marginLeft + qrSize + 12
      const qrBottom = currentY + qrSize

      const infoLineH = 11
      let infoY = currentY + 4
      pdf.setFontSize(7.5)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(0, 0, 0)
      pdf.setFillColor(0, 0, 0)
      pdf.circle(qrRight - 2, infoY - 1.8, bulletR, "F")
      pdf.text(fechaFormateada, qrRight + 2, infoY)
      infoY += infoLineH
      pdf.circle(qrRight - 2, infoY - 1.8, bulletR, "F")
      pdf.text(`Cliente: ${envio.cliente || ""}`, qrRight + 2, infoY)
      infoY += infoLineH
      pdf.circle(qrRight - 2, infoY - 1.8, bulletR, "F")
      pdf.text(`Venta: ${getOrigenVentaLabel(envio.origen)}`, qrRight + 2, infoY)
      infoY += infoLineH
      pdf.circle(qrRight - 2, infoY - 1.8, bulletR, "F")
      pdf.text(`Envio: ${envio.tracking || String(envio.id)}`, qrRight + 2, infoY)

      currentY = qrBottom + 14
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.5)
      pdf.line(marginLeft, currentY, width - marginRight, currentY)
      currentY += 14

      pdf.setFontSize(7.5)
      pdf.setFont("helvetica", "bold")
      pdf.text("Destinatario", marginLeft, currentY)
      const destWidth = pdf.getTextWidth("Destinatario")
      pdf.setLineWidth(0.4)
      pdf.line(marginLeft, currentY + 2, marginLeft + destWidth, currentY + 2)
      currentY += 14

      pdf.setFillColor(0, 0, 0)
      pdf.circle(marginLeft + bulletR, currentY - 2, bulletR, "F")
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "bold")
      pdf.text(envio.nombreDestinatario, bulletX + 4, currentY)
      currentY += 12 + 6

      pdf.setFillColor(0, 0, 0)
      pdf.circle(marginLeft + bulletR, currentY - 2, bulletR, "F")
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.text(`Tel: ${envio.telefono}`, bulletX + 4, currentY)
      currentY += infoLineH + 2

      pdf.setFillColor(0, 0, 0)
      pdf.circle(marginLeft + bulletR, currentY - 2, bulletR, "F")
      const direccionLines = pdf.splitTextToSize(envio.direccion, width - marginLeft * 2 - 24)
      pdf.text(direccionLines, bulletX + 4, currentY)
      currentY += direccionLines.length * 11 + 8

      if (envio.observaciones) {
        pdf.setFillColor(0, 0, 0)
        pdf.circle(marginLeft + bulletR, currentY - 2, bulletR, "F")
        pdf.setFontSize(7.5)
        pdf.setFont("helvetica", "italic")
        const obsLines = pdf.splitTextToSize(`Obs: ${envio.observaciones}`, width - marginLeft * 2 - 24)
        pdf.text(obsLines, bulletX + 4, currentY)
        currentY += obsLines.length * 10 + 6
      }

      if (envio.totalACobrar && String(envio.totalACobrar).trim() !== "") {
        pdf.setFontSize(8.5)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        pdf.text(`Cobrar en Efectivo: $ ${String(envio.totalACobrar).trim()}`, marginLeft, currentY)
        currentY += 14
      }

      if (envio.cambioRetiro && String(envio.cambioRetiro).trim() !== "") {
        const valor = String(envio.cambioRetiro).trim().toUpperCase()
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(0, 0, 0)
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.8)
        const badgeW = Math.max(pdf.getTextWidth(valor) + 12, 40)
        pdf.roundedRect(marginLeft, currentY - 8, badgeW, 15, 2, 2, "S")
        pdf.text(valor, marginLeft + badgeW / 2 - pdf.getTextWidth(valor) / 2, currentY + 2)
        currentY += 20
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
    const now = new Date()
    const fecha = now.toISOString().split("T")[0]
    const horario = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
    const estadoActual = envio?.estado || "A retirar"
    // Si está "A retirar", el único siguiente permitido es "Retirado"
    const estadoPorDefecto = estadoActual === "A retirar" ? "Retirado" : "Retirado"
    setNuevoEstado({
      fecha,
      horario,
      estado: estadoPorDefecto,
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

  const handleAgregarEstado = async () => {
    if (!envio || !nuevoEstado.fecha || !nuevoEstado.horario || !nuevoEstado.estado) {
      return
    }

    // Si hay callback (misma lógica que la columna Estado): validar y persistir en backend
    if (onEstadoChange) {
      try {
        const ok = await onEstadoChange(envio.id, nuevoEstado.estado)
        if (ok) {
          await loadHistorial()
          handleCloseAddEstado()
        }
      } catch {
        // Errores y toasts los maneja handleEstadoChange en la página
      }
      return
    }

    // Fallback: solo actualizar historial local (sin backend)
    const fechaFormateada = new Date(nuevoEstado.fecha).toLocaleDateString("es-AR")
    const nuevoItem: HistorialItem = {
      id: Date.now(),
      estado: nuevoEstado.estado,
      fecha: `${fechaFormateada} ${nuevoEstado.horario}`,
      horaEstimada: nuevoEstado.horario,
      quien: "Usuario actual",
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
      alert("Debés seleccionar un repartidor para asignar el pedido.")
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 animate-in fade-in-0 backdrop-blur-md"
      onClick={onClose}
      role="button"
      tabIndex={-1}
    >
      <div
        className="flex max-h-[90vh] w-[96vw] max-w-7xl flex-col overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_28px_90px_-16px_rgba(15,23,42,0.45)] ring-1 ring-white/70 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="border-b border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-teal-50/30">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Pedido</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-[20px] font-semibold tracking-tight text-slate-900">{envio.tracking}</span>
                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[12px] font-semibold text-teal-900 ring-1 ring-teal-200/80">
                  {envio.estado || "A retirar"}
                </span>
                <span className="text-slate-300">·</span>
                <span className="max-w-[min(100%,420px)] truncate text-[13px] font-medium text-slate-600">{envio.cliente}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {userProfile && userProfile !== "Chofer" && userProfile !== "Cliente" && (
                <>
                  <Button
                    type="button"
                    onClick={handleAsignar}
                    className={`h-9 rounded-xl px-4 text-[13px] font-semibold ${btnPrimary}`}
                  >
                    Asignar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleOpenAddEstado}
                    className={`h-9 rounded-xl px-4 text-[13px] font-semibold ${btnGhost}`}
                  >
                    Actualizar estado
                  </Button>
                </>
              )}
              <button
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Cuerpo: rail vertical (iconos siempre; texto desde md) + contenido */}
        <div className="flex min-h-0 flex-1 flex-row">
          <nav
            className="flex w-[52px] shrink-0 flex-col gap-0.5 border-r border-slate-200/80 bg-gradient-to-b from-slate-100/90 via-slate-50/95 to-white py-3 md:w-52 md:gap-1 md:px-2 md:py-4"
            aria-label="Secciones del pedido"
          >
            {DETAIL_NAV.map(({ id, label, Icon }) => {
              const isActive = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex items-center justify-center gap-0 rounded-xl py-2.5 transition-all md:justify-start md:gap-3 md:px-3",
                    isActive
                      ? "bg-white text-teal-900 shadow-md ring-1 ring-slate-200/90 md:border-l-[3px] md:border-l-teal-500 md:pl-[calc(0.75rem-3px)] md:ring-0"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                  <span className="hidden min-w-0 truncate text-left text-[13px] font-semibold md:inline">{label}</span>
                </button>
              )
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(45,212,191,0.08),transparent_50%),linear-gradient(180deg,#f8fafc_0%,#ffffff_45%,#f1f5f9_100%)] p-4 md:p-6">
          <div
            className={
              activeTab === "general"
                ? "flex flex-col gap-6 xl:flex-row xl:items-start"
                : "mx-auto max-w-5xl"
            }
          >
            <div
              className={
                activeTab === "general"
                  ? "min-w-0 flex-1 space-y-4"
                  : "w-full space-y-4"
              }
            >
              {activeTab === "general" && (
                <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm ring-1 ring-slate-100/80 backdrop-blur-[2px]">
                  <div className="space-y-1.5">
                    <label className={lbl}>Tracking</label>
                    <Input value={normalizeValue(envio.tracking)} className={cn(fld, "font-mono shadow-sm")} readOnly />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={lbl}>IDML</label>
                      <Input
                        value={normalizeValue(envio.idml)}
                        className={cn(fld, "shadow-sm")}
                        readOnly
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={lbl}>ID_NX</label>
                      <Input value={normalizeValue(envio.idMvg)} className={cn(fld, "font-mono font-semibold shadow-sm")} readOnly />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={lbl}>Vendedor</label>
                    <Input value={normalizeValue(envio.cliente)} className={cn(fld, "font-semibold shadow-sm")} readOnly />
                  </div>

                  {/* Fila 2: fecha ingreso, fecha venta, fecha despacho */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className={lbl}>Fecha Ingreso</label>
                      <Input
                        value={envio.fecha ? new Date(envio.fecha).toLocaleDateString("es-AR") : "11/01/2026"}
                        className={cn(fld, "shadow-sm")}
                        readOnly
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={lbl}>Fecha Venta</label>
                      <Input
                        value={envio.fechaVenta ? new Date(envio.fechaVenta).toLocaleString("es-AR") : "00/00/0000 00:00:00"}
                        className={cn(fld, "shadow-sm")}
                        readOnly
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={lbl}>Fecha de llegada</label>
                      <Input
                        value={envio.fechaLlegue ? new Date(envio.fechaLlegue).toLocaleDateString("es-AR") : "—"}
                        className={cn(fld, "shadow-sm")}
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Valor declarado y costo de envío (sin deadline / bultos / peso / método) */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className={lbl}>Valor declarado del paquete</label>
                      <Input
                        value={
                          envio.totalACobrar
                            ? `$ ${parseFloat(envio.totalACobrar).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "$ 0.00"
                        }
                        className={cn(fld, "shadow-sm")}
                        readOnly
                      />
                    </div>
                    {userProfile !== "Coordinador" && (
                      <div className="space-y-1.5">
                        <label className={lbl}>Costo de envío</label>
                        <Input
                          value={
                            envio.costoEnvio
                              ? `$ ${parseFloat(envio.costoEnvio).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "$ 0.00"
                          }
                          className={cn(fld, "shadow-sm")}
                          readOnly
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-slate-200/80 pt-4">
                    <div className="space-y-1.5">
                      <label className={lbl}>Observaciones</label>
                      <Input value={normalizeValue(envio.observaciones)} className={cn(fld, "shadow-sm")} readOnly />
                    </div>
                    <div className="space-y-1.5">
                      <label className={lbl}>Referencia de domicilio</label>
                      <Input value={normalizeValue(envio.cambioRetiro)} className={cn(fld, "shadow-sm")} readOnly />
                    </div>
                  </div>
                </div>
              )}

              {/* HISTORIAL Tab */}
              {activeTab === "historial" && (
                <div className="space-y-4">
                  {envio.estado === "Entregado" && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-teal-200/70 bg-gradient-to-r from-teal-50/90 via-white to-slate-50/80 p-4 shadow-sm ring-1 ring-teal-100/80 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
                          <UserRoundCheck className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">Pedido entregado</p>
                          <p className="text-xs leading-snug text-slate-600">
                            Los datos de quién recibió el paquete están en el registro de entrega (no en el resumen).
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={handleOpenRecepcionDialog}
                        className={cn(btnPrimary, "h-9 shrink-0 px-4 text-xs font-semibold")}
                      >
                        Ver recepción
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={handleOpenAddEstado}
                    className={cn(btnPrimary, "h-9 text-xs font-semibold")}
                  >
                    AGREGAR NUEVO ESTADO
                  </Button>
                  
                  <div className={tblWrap}>
                    <table className="w-full">
                      <thead className={tblHead}>
                        <tr>
                          <th className={tblTh}>Estado</th>
                          <th className={tblTh}>Fecha</th>
                          <th className={tblTh}>Hora estimada</th>
                          <th className={tblTh}>Quien</th>
                          <th className={tblTh}>Eliminar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historial.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                              No hay historial disponible
                            </td>
                          </tr>
                        ) : (
                          historial.map((item) => (
                            <tr key={item.id} className={tblRow}>
                              <td className="px-4 py-2 text-sm text-slate-900">{item.estado}</td>
                              <td className="px-4 py-2 text-sm text-slate-700">{item.fecha}</td>
                              <td className="px-4 py-2 text-sm text-slate-700">{item.horaEstimada}</td>
                              <td className="px-4 py-2 text-sm text-slate-700">{item.quien}</td>
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
                      className={cn(btnPrimary, "h-9 text-xs font-semibold")}
                    >
                      AGREGAR
                    </Button>
                  </div>
                  
                  {/* Tabla de observaciones */}
                  <div className={tblWrap}>
                    <table className="w-full">
                      <thead className={tblHead}>
                        <tr>
                          <th className={tblTh}>Fecha</th>
                          <th className={tblTh}>Observación</th>
                          <th className={tblTh}>Quien</th>
                          <th className={tblTh}>Eliminar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {observaciones.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                              No hay observaciones registradas
                            </td>
                          </tr>
                        ) : (
                          observaciones.map((item) => (
                            <tr key={item.id} className={tblRow}>
                              <td className="px-4 py-2 text-sm text-slate-700">{item.fecha}</td>
                              <td className="px-4 py-2 text-sm text-slate-900">{item.observacion}</td>
                              <td className="px-4 py-2 text-sm text-slate-700">{item.quien}</td>
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
                  <div className={tblWrap}>
                    <div className={panelBar}>
                      <h3 className={panelBarTitle}>Listado de fotos existentes</h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-slate-50/90">
                        <tr>
                          <th className={tblTh}>Imprimir</th>
                          <th className={tblTh}>Foto</th>
                          <th className={tblTh}>Quien</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imagenes.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                              No hay fotos existentes
                            </td>
                          </tr>
                        ) : (
                          imagenes.map((imagen) => (
                            <tr key={imagen.id} className={tblRow}>
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
                                  className="rounded p-2 text-teal-700 transition-all hover:bg-teal-50 hover:text-teal-900"
                                  title="Descargar imagen"
                                >
                                  <Printer className="h-5 w-5" />
                                </button>
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-700">
                                <img src={imagen.url} alt="Foto" className="w-16 h-16 object-cover rounded" />
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-700">{imagen.quien}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Listado de fotos a guardar */}
                  <div className={tblWrap}>
                    <div className={panelBar}>
                      <h3 className={panelBarTitle}>Listado de fotos a guardar</h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-slate-50/90">
                        <tr>
                          <th className={tblTh}>Nombre</th>
                          <th className={tblTh}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={2} className="px-4 py-8 text-center text-sm text-slate-500">
                            No hay fotos para guardar
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-center">
                    <Button className={cn(btnPrimary, "h-9 text-xs font-semibold")}>
                      AGREGAR FOTO
                    </Button>
                  </div>
                </div>
              )}

              {/* ASIGNACION Tab */}
              {activeTab === "asignacion" && (
                <div className="space-y-4">
                  {/* Botón de asignar (solo para usuarios no-chofer y no-cliente) */}
                  {userProfile && userProfile !== "Chofer" && userProfile !== "Cliente" && (
                    <Button
                      onClick={handleAsignar}
                      className={cn(btnPrimary, "h-9 text-xs font-semibold")}
                    >
                      ASIGNAR
                    </Button>
                  )}

                  <div className={tblWrap}>
                    <table className="w-full">
                      <thead className={tblHead}>
                        <tr>
                          <th className={tblTh}>Asignado a</th>
                          <th className={tblTh}>Desde</th>
                          <th className={tblTh}>Fecha</th>
                          <th className={tblTh}>Quien asigno</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asignaciones.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                              No hay asignaciones registradas
                            </td>
                          </tr>
                        ) : (
                          asignaciones.map((asignacion, index) => (
                            <tr key={index} className={tblRow}>
                              <td className="px-4 py-2 text-sm text-slate-900">{asignacion.choferNombre}</td>
                              <td className="px-4 py-2 text-sm text-slate-700">{asignacion.desde}</td>
                              <td className="px-4 py-2 text-sm text-slate-700">{asignacion.fecha}</td>
                              <td className="px-4 py-2 text-sm text-slate-700">{asignacion.quienAsigno}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {activeTab === "general" && (
            <aside className="w-full shrink-0 space-y-4 xl:sticky xl:top-2 xl:w-[min(100%,420px)] xl:self-start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={lbl}>QR público</label>
                  <div className="flex justify-center rounded-2xl border border-dashed border-slate-300/90 bg-gradient-to-br from-white to-slate-50 p-4 shadow-inner">
                    {qrImageUrl ? (
                      <img src={qrImageUrl} alt="QR público" className="h-[140px] w-[140px] rounded-lg" />
                    ) : (
                      <div className="flex h-[140px] w-[140px] items-center justify-center rounded-xl bg-slate-100">
                        <span className="text-xs text-slate-400">Cargando…</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={lbl}>Link público</label>
                  <textarea
                    readOnly
                    value={publicLink}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/90 p-3 font-mono text-[11px] font-medium leading-snug text-slate-800 shadow-sm outline-none ring-offset-0 [font-variant-ligatures:none] break-all"
                  />
                  <p className="text-[11px] leading-snug text-slate-500">
                    Compartir este enlace o el QR para seguimiento público.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className={lbl}>Mapa</label>
                <div className="overflow-hidden rounded-2xl border border-slate-200/90 shadow-inner ring-1 ring-slate-100" style={{ height: "260px" }}>
                  <div ref={mapRef} className="h-full w-full" />
                </div>
                {!geolocalizacionEncontrada && envio.direccion && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2">
                    <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse"></div>
                    <p className="text-xs font-semibold text-amber-800">No fue posible geolocalizar la dirección.</p>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm ring-1 ring-slate-100/80">
                  <div className="space-y-1">
                    <label className={lbl}>Dirección</label>
                    <Input value={normalizeValue(envio.direccion)} className={cn(fld, "h-8 text-xs shadow-sm")} readOnly />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={lbl}>CP</label>
                      <Input value={normalizeValue(envio.codigoPostal)} className={cn(fld, "h-8 text-xs font-mono shadow-sm")} readOnly />
                    </div>
                    <div className="space-y-1">
                      <label className={lbl}>Recibe</label>
                      <Input value={normalizeValue(envio.nombreDestinatario)} className={cn(fld, "h-8 text-xs shadow-sm")} readOnly />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={lbl}>Tel</label>
                      <div className="flex items-center gap-2">
                        <Input value={normalizeValue(envio.telefono)} className={cn(fld, "h-8 flex-1 font-mono text-xs shadow-sm")} readOnly />
                        <button
                          onClick={handleWhatsApp}
                          className="h-8 w-8 bg-green-500 hover:bg-green-600 rounded-lg flex items-center justify-center shadow-md hover:shadow-lg transition-all"
                        >
                          <span className="text-white text-xs font-bold">WA</span>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className={lbl}>Email</label>
                      <Input value={normalizeValue(envio.email)} className={cn(fld, "h-8 text-xs shadow-sm")} readOnly />
                    </div>
                  </div>
                </div>

              <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 ring-1 ring-slate-100/80">
                  <p className={cn(lbl, "text-slate-600")}>Acciones</p>
                  <div className="space-y-2">
                    <Button
                      onClick={handleDelete}
                      className="w-full bg-red-600 hover:bg-red-700 text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                    >
                      Eliminar
                    </Button>
                    {envio.origen !== "Flex" && (
                      <Button
                        onClick={handleReimprimirNoflex}
                        className="w-full bg-green-600 hover:bg-green-700 text-white h-9 text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                      >
                        Reimpresión de etiqueta
                      </Button>
                    )}
                    <Button
                      onClick={onClose}
                      variant="outline"
                      className={cn(btnGhost, "w-full h-9 text-xs font-semibold")}
                    >
                      Cerrar
                    </Button>
                  </div>
                </div>

            </aside>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Detalle de recepción (solo datos de entrega; se abre desde Actividad) */}
      {recepcionDialogOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 animate-in fade-in-0 backdrop-blur-md"
          onClick={() => setRecepcionDialogOpen(false)}
          role="presentation"
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100/80 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recepcion-dialog-title"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
                  <UserRoundCheck className="h-4 w-4" aria-hidden />
                </div>
                <h3 id="recepcion-dialog-title" className="text-lg font-semibold text-slate-900">
                  Recepción del envío
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRecepcionDialogOpen(false)}
                className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Datos registrados al marcar el pedido como entregado.
            </p>
            {datosEntrega ? (
              <div className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                <div>
                  <p className={lbl}>Rol</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{datosEntrega.rolRecibio?.trim() || "—"}</p>
                </div>
                <div>
                  <p className={lbl}>Nombre quien recibió</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{datosEntrega.nombreRecibio?.trim() || "—"}</p>
                </div>
                <div>
                  <p className={lbl}>DNI</p>
                  <p className="mt-1 font-mono text-sm font-medium text-slate-900">{datosEntrega.dniRecibio?.trim() || "—"}</p>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-900">
                Aún no hay datos de recepción cargados o no se pudieron obtener. Probá de nuevo en unos segundos.
              </p>
            )}
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setRecepcionDialogOpen(false)} className={cn(btnGhost, "h-9 px-4 text-sm font-semibold")}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Desea eliminar el pedido con tracking <strong>{envio?.tracking}</strong>? Esta acción no se puede deshacer.
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 animate-in fade-in-0 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100/80 animate-in zoom-in-95">
            <div className="space-y-4">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Agregar Nuevo Estado</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className={lbl}>Fecha</label>
                  <Input
                    type="date"
                    value={nuevoEstado.fecha}
                    onChange={(e) => setNuevoEstado({ ...nuevoEstado, fecha: e.target.value })}
                    className={cn(fld, "shadow-sm")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>Horario</label>
                  <Input
                    type="time"
                    value={nuevoEstado.horario}
                    onChange={(e) => setNuevoEstado({ ...nuevoEstado, horario: e.target.value })}
                    className={cn(fld, "shadow-sm")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>Estado</label>
                  <Select value={nuevoEstado.estado} onValueChange={(value) => setNuevoEstado({ ...nuevoEstado, estado: value })}>
                    <SelectTrigger className={cn(fld, "shadow-sm")}>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {((envio?.estado || "A retirar") === "A retirar" ? ["A retirar", "Retirado"] : estadosEnvio).map((estado) => (
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
                  className={cn(btnPrimary, "h-9 text-xs font-semibold")}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 animate-in fade-in-0 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100/80 animate-in zoom-in-95">
            <div className="space-y-4">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Agregar Observación</h3>
              
              <div className="space-y-1.5">
                <label className={lbl}>Observación</label>
                <div className="relative">
                  <Pencil className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                  <Input
                    value={nuevaObservacion.observacion}
                    onChange={(e) => setNuevaObservacion({ observacion: e.target.value })}
                    className={cn(fld, "h-9 pl-8 text-sm shadow-sm")}
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
                  className={cn(btnPrimary, "h-9 text-xs font-semibold")}
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 animate-in fade-in-0 backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-[90vw] max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100/80 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Asignar a:</h2>
            <p className="mb-4 text-sm text-slate-600">Seleccioná un repartidor (obligatorio)</p>
            
            <div className="max-h-64 overflow-y-auto mb-4 space-y-2">
              {/* Mostrar "PENDIENTES DEPÓSITO" primero si el usuario no es chofer */}
              {userProfile && userProfile !== "Chofer" && (
                <button
                  onClick={() => setChoferSeleccionado(PENDIENTES_DEPOSITO)}
                  className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                    choferSeleccionado?.id === PENDIENTES_DEPOSITO.id
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-200/90 bg-slate-50/80 hover:border-teal-200/70 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${choferSeleccionado?.id === PENDIENTES_DEPOSITO.id ? "text-teal-800" : "text-slate-900"}`}>
                      {PENDIENTES_DEPOSITO.nombre} {PENDIENTES_DEPOSITO.apellido}
                    </span>
                    {choferSeleccionado?.id === PENDIENTES_DEPOSITO.id && (
                      <span className="font-bold text-teal-700">✓</span>
                    )}
                  </div>
                </button>
              )}
              
              {choferes.map((chofer) => (
                <button
                  key={chofer.id}
                  onClick={() => setChoferSeleccionado(chofer)}
                  className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                    choferSeleccionado?.id === chofer.id
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-200/90 bg-slate-50/80 hover:border-teal-200/70 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${choferSeleccionado?.id === chofer.id ? "text-teal-800" : "text-slate-900"}`}>
                      {chofer.nombre} {chofer.apellido}
                    </span>
                    {choferSeleccionado?.id === chofer.id && (
                      <span className="font-bold text-teal-700">✓</span>
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
                className={cn(btnGhost, "flex-1 font-medium")}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarAsignacion}
                disabled={!choferSeleccionado}
                className={cn(btnPrimary, "flex-1 disabled:cursor-not-allowed disabled:opacity-50")}
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

