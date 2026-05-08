"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown, ChevronUp, Download } from "lucide-react"
import { QRThumbnail } from "@/components/qr-thumbnail"
import { EnvioDetailModal } from "@/components/envio-detail-modal"
import * as XLSX from "xlsx"
import { getApiBaseUrl } from "@/lib/api-config"
import { logDev, warnDev, errorDev } from "@/lib/logger"
import { toast } from "sonner"
import { Montserrat } from "next/font/google"

interface Envio {
  id: number
  fecha: string // Fecha de carga
  fechaVenta?: string
  fechaLlegue?: string
  fechaEntregado?: string
  fechaAsignacion?: string
  fechaDespacho?: string
  fechaColecta?: string
  fechaAPlanta?: string
  fechaCancelado?: string
  fechaUltimoMovimiento?: string
  origen: string
  tracking: string
  idMvg?: string
  cliente: string
  direccion: string
  nombreDestinatario: string
  telefono: string
  email?: string
  impreso: string
  observaciones?: string
  totalACobrar?: string
  cambioRetiro?: string
  localidad?: string
  codigoPostal?: string
  zonaEntrega?: string
  qrData?: string
  trackingToken?: string
  estado?: string // Estado del envío
  eliminado?: boolean // Indica si el envío ha sido eliminado
  choferAsignadoId?: number
  choferAsignadoNombre?: string
  deadline?: string
  idml?: string
  metodoEnvio?: string
  costoEnvio?: string
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

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

export default function EnviosPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<string | null>(null)
  const [userCodigoCliente, setUserCodigoCliente] = useState<string | null>(null)
  const [choferId, setChoferId] = useState<number | null>(null)
  const [envios, setEnvios] = useState<Envio[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [currentPage, setCurrentPage] = useState(0) // Backend usa 0-indexed
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [isLoading, setIsLoading] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedEnvio, setSelectedEnvio] = useState<Envio | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [enviosCache, setEnviosCache] = useState<Envio[]>([]) // Cache para última semana
  const [filters, setFilters] = useState({
    tipoFecha: "fechaLlegue",
    fechaDesde: "",
    fechaHasta: "",
    estado: "todos",
    origen: "todos",
    tracking: "",
    idVenta: "",
    logisticaInversa: "todos",
    domicilio: "todos",
    zonasEntrega: "",
    envioTurbo: "todos",
    fotos: "todos",
    asignado: "todos",
    nombreFantasia: "",
    destinoNombre: "",
    destinoDireccion: "",
    cobranzas: "todos",
  })

  // OPTIMIZACIÓN: Cargar caché en segundo plano sin bloquear
  useEffect(() => {
    // Primero intentar cargar desde localStorage (instantáneo)
    const cached = localStorage.getItem("enviosCache")
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setEnviosCache(parsed)
      } catch (e) {
        warnDev("Error al cargar caché de localStorage:", e)
      }
    }
    
    // Luego cargar del backend en segundo plano
    const loadCache = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(`${apiBaseUrl}/envios/recientes`)
        if (response.ok) {
          const data = await response.json()
          // OPTIMIZACIÓN: Convertir fechas solo cuando sea necesario (lazy)
          const enviosFormateados = data.map((envio: any) => ({
            ...envio,
            // Las fechas se convierten solo cuando se necesitan mostrar
            fecha: envio.fecha,
            fechaVenta: envio.fechaVenta,
            fechaLlegue: envio.fechaLlegue,
            fechaEntregado: envio.fechaEntregado,
          }))
          setEnviosCache(enviosFormateados)
          // Guardar en localStorage como fallback
          localStorage.setItem("enviosCache", JSON.stringify(enviosFormateados))
        }
      } catch (error) {
        // Error silencioso, ya tenemos datos de localStorage si estaban disponibles
        logDev("No se pudo actualizar caché del backend:", error)
      }
    }
    // Cargar en segundo plano sin bloquear
    loadCache()
  }, [])

  // OPTIMIZACIÓN: Cargar envíos con renderizado inmediato
  const loadEnvios = async (page: number = 0, size: number = 50, showLoading: boolean = true) => {
    if (showLoading) {
      setIsLoading(true)
    }
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        tipoFecha: filters.tipoFecha || "fechaLlegue",
        estado: filters.estado || "todos",
        origen: filters.origen || "todos",
        tracking: filters.tracking || "",
        idVenta: filters.idVenta || "",
        nombreFantasia: filters.nombreFantasia || "",
        destinoNombre: filters.destinoNombre || "",
        destinoDireccion: filters.destinoDireccion || "",
        zonasEntrega: filters.zonasEntrega || "",
        fechaDesde: filters.fechaDesde || "",
        fechaHasta: filters.fechaHasta || "",
      })

      // Si el usuario es Cliente, agregar filtro de código de cliente
      if (userProfile === "Cliente" && userCodigoCliente) {
        params.append("codigoCliente", userCodigoCliente)
      }

      // Si el usuario es Chofer, agregar filtro para ver solo sus envíos asignados
      if (userProfile === "Chofer" && choferId != null) {
        params.append("choferId", String(choferId))
      }

      const apiBaseUrl = getApiBaseUrl()

      // Solo usar caché cuando no hay ningún filtro activo (fechas, estado, origen, tracking, idVenta)
      const sinFiltros =
        !filters.fechaDesde &&
        !filters.fechaHasta &&
        filters.estado === "todos" &&
        filters.origen === "todos" &&
        !filters.tracking?.trim() &&
        !filters.idVenta?.trim()

      if (page === 0 && enviosCache.length > 0 && sinFiltros) {
        let enviosFiltrados = enviosCache
        if (userProfile === "Cliente" && userCodigoCliente) {
          enviosFiltrados = enviosFiltrados.filter((envio: any) => {
            const clienteCodigo = envio.cliente?.split(" - ")[0]?.trim() || envio.cliente
            return clienteCodigo?.toLowerCase() === userCodigoCliente.toLowerCase()
          })
        }
        if (userProfile === "Chofer" && choferId != null) {
          enviosFiltrados = enviosFiltrados.filter((envio: any) => envio.choferAsignadoId === choferId)
        }
        enviosFiltrados = enviosFiltrados.filter((envio: any) => !envio.eliminado)
        const enviosPaginados = enviosFiltrados.slice(0, size)
        setEnvios(enviosPaginados)
        setTotalPages(Math.ceil(enviosFiltrados.length / size))
        setTotalElements(enviosFiltrados.length)
        if (showLoading) setIsLoading(false)
      }

      const response = await fetch(`${apiBaseUrl}/envios?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        // Usar siempre la respuesta del API (incluye resultado vacío cuando los filtros no dan resultados)
        const content = data.content ?? []
        const enviosFormateados = content.map((envio: any) => ({
          ...envio,
          fecha: envio.fecha,
          fechaVenta: envio.fechaVenta,
          fechaLlegue: envio.fechaLlegue,
          fechaEntregado: envio.fechaEntregado,
        }))
        setEnvios(enviosFormateados)
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      } else {
        throw new Error("Error al cargar envíos")
      }
    } catch (error) {
      warnDev("Error al cargar desde backend, usando localStorage:", error)
      // Fallback a localStorage
      const enviosGuardados = JSON.parse(localStorage.getItem("enviosNoflex") || "[]")
      
      // Aplicar filtros localmente
      let enviosFiltrados = enviosGuardados
      
      // Filtrar por cliente si es necesario
      if (userProfile === "Cliente" && userCodigoCliente) {
        enviosFiltrados = enviosFiltrados.filter((envio: any) => {
          const clienteCodigo = envio.cliente?.split(" - ")[0]?.trim() || envio.cliente
          return clienteCodigo?.toLowerCase() === userCodigoCliente.toLowerCase()
        })
      }
      if (userProfile === "Chofer" && choferId != null) {
        enviosFiltrados = enviosFiltrados.filter((envio: any) => envio.choferAsignadoId === choferId)
      }
      
      // Filtrar por eliminados
      if (filters.estado !== "Eliminados") {
        enviosFiltrados = enviosFiltrados.filter((envio: any) => !envio.eliminado)
      } else {
        enviosFiltrados = enviosFiltrados.filter((envio: any) => envio.eliminado === true)
      }
      
      // Aplicar paginación local
      const startIndex = page * size
      const endIndex = startIndex + size
      const enviosPaginados = enviosFiltrados.slice(startIndex, endIndex)
      
      setEnvios(enviosPaginados)
      setTotalPages(Math.ceil(enviosFiltrados.length / size))
      setTotalElements(enviosFiltrados.length)
    } finally {
      setIsLoading(false)
    }
  }

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

    // Si el usuario es Chofer, obtener su ID (para filtrar solo sus envíos asignados)
    if (profile === "Chofer") {
      const loadChoferId = async () => {
        const username = sessionStorage.getItem("username")
        if (!username) return
        try {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
          if (response.ok) {
            const data = await response.json()
            const content = data.content || []
            const user = content.find((u: any) => u.usuario === username)
            if (user && user.id != null) setChoferId(Number(user.id))
          }
        } catch (error) {
          warnDev("No se pudo cargar ID del chofer:", error)
        }
      }
      loadChoferId()
    }
  }, [router])

  // Cargar envíos cuando cambian los filtros o la página (Chofer: esperar a tener choferId)
  useEffect(() => {
    if (!userProfile) return
    if (userProfile === "Chofer" && choferId == null) return
    loadEnvios(currentPage, itemsPerPage)
  }, [currentPage, itemsPerPage, filters, userProfile, userCodigoCliente, choferId])

  // Los envíos ya vienen filtrados del backend, no necesitamos filtrar localmente
  const filteredEnvios = envios
  const paginatedEnvios = envios // Ya vienen paginados del backend

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(0) // Resetear a la primera página al filtrar (backend usa 0-indexed)
  }

  const handleClearFilters = () => {
    setFilters({
      tipoFecha: "fechaLlegue",
      fechaDesde: "",
      fechaHasta: "",
      estado: "todos",
      origen: "todos",
      tracking: "",
      idVenta: "",
      logisticaInversa: "todos",
      domicilio: "todos",
      zonasEntrega: "",
      envioTurbo: "todos",
      fotos: "todos",
      asignado: "todos",
      nombreFantasia: "",
      destinoNombre: "",
      destinoDireccion: "",
      cobranzas: "todos",
    })
    setCurrentPage(0)
  }

  const handleEstadoChange = async (envioId: number, nuevoEstado: string): Promise<boolean> => {
    const envio = envios.find((e) => e.id === envioId)
    if (!envio) return false

    if (envio.origen === "Flex") {
      toast.error("No se puede cambiar manualmente el estado de un envío Flex. El estado se sincroniza desde MercadoLibre.")
      return false
    }
    if (userProfile !== "Administrativo" && userProfile !== "Chofer") {
      toast.error("No tenés permiso para cambiar el estado de los pedidos")
      return false
    }

    const estadoActual = envio.estado || "A retirar"
    if (estadoActual === "A retirar" && nuevoEstado !== "Retirado") {
      toast.error("Desde 'A retirar' solo se puede pasar a 'Retirado'. Primero hay que marcar el envío como colectado.")
      return false
    }

    try {
      // Obtener nombre completo del usuario
      const username = sessionStorage.getItem("username") || "Usuario"
      let usuarioNombre = username

      // Intentar obtener nombre completo del backend
      try {
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
        if (response.ok) {
          const data = await response.json()
          if (data.content && data.content.length > 0) {
            const user = data.content.find((u: any) => u.usuario === username)
            if (user && user.nombre && user.apellido) {
              usuarioNombre = `${user.nombre} ${user.apellido}`.trim()
            } else if (user && user.nombre) {
              usuarioNombre = user.nombre
            }
          }
        }
      } catch (error) {
        warnDev("No se pudo cargar nombre del usuario:", error)
      }

      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/envios/${envioId}/estado`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          estado: nuevoEstado,
          usuarioNombre: usuarioNombre,
        }),
      })
      if (response.ok) {
        loadEnvios(currentPage, itemsPerPage)
        toast.success("Estado actualizado correctamente")
        return true
      } else {
        let mensaje = "No se pudo cambiar el estado."
        try {
          const text = await response.text()
          if (text) {
            try {
              const json = JSON.parse(text)
              mensaje = json.message || json.error || text
            } catch {
              mensaje = text
            }
          }
        } catch {
          // usar mensaje por defecto
        }
        if (mensaje.includes("A retirar") && mensaje.includes("Retirado")) {
          mensaje = "Desde 'A retirar' solo se puede pasar a 'Retirado'. Primero hay que marcar el envío como colectado."
        }
        toast.error(mensaje)
      }
      return false
    } catch (error: unknown) {
      warnDev("Error al actualizar estado:", error)
      const mensaje = error instanceof Error ? error.message : "Error de conexión al cambiar el estado."
      toast.error(mensaje)
      return false
    }
  }

  const handleDeleteEnvio = async (envioId: number) => {
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/envios/${envioId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        // Recargar la página actual
        loadEnvios(currentPage, itemsPerPage)
        // Cerrar modal si el envío eliminado estaba abierto
        if (selectedEnvio?.id === envioId) {
          setIsDetailModalOpen(false)
          setSelectedEnvio(null)
        }
      } else {
        throw new Error("Error al eliminar")
      }
    } catch (error) {
      warnDev("Error al eliminar, usando localStorage:", error)
      // Fallback a localStorage
      const enviosActualizados = envios.map((envio) => 
        envio.id === envioId ? { ...envio, eliminado: true } : envio
      )
      setEnvios(enviosActualizados)
      localStorage.setItem("enviosNoflex", JSON.stringify(enviosActualizados))
      
      // Cerrar modal si el envío eliminado estaba abierto
      if (selectedEnvio?.id === envioId) {
        setIsDetailModalOpen(false)
        setSelectedEnvio(null)
      }
    }
  }

  const handleDescargarExcel = async () => {
    try {
      setIsLoading(true)
      
      const apiBaseUrl = getApiBaseUrl()
      
      // Construir parámetros de filtro (igual que loadEnvios)
      const params = new URLSearchParams({
        tipoFecha: filters.tipoFecha || "fechaLlegue",
        estado: filters.estado || "todos",
        origen: filters.origen || "todos",
        tracking: filters.tracking || "",
        idVenta: filters.idVenta || "",
        nombreFantasia: filters.nombreFantasia || "",
        destinoNombre: filters.destinoNombre || "",
        destinoDireccion: filters.destinoDireccion || "",
        zonasEntrega: filters.zonasEntrega || "",
        fechaDesde: filters.fechaDesde || "",
        fechaHasta: filters.fechaHasta || "",
      })

      // Si el usuario es Cliente, agregar filtro de código de cliente
      if (userProfile === "Cliente" && userCodigoCliente) {
        params.append("codigoCliente", userCodigoCliente)
      }

      // OPTIMIZACIÓN: Obtener TODOS los envíos que cumplan los filtros (sin paginación)
      const response = await fetch(`${apiBaseUrl}/envios/exportar?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error("Error al obtener envíos para exportar")
      }
      
      const todosLosEnvios: Envio[] = await response.json()
      
      // Función auxiliar para parsear cliente (formato: "codigo - nombre")
      const parsearCliente = (clienteStr: string) => {
        if (!clienteStr) return { codigo: "", razonSocial: "", nombreFantasia: "" }
        const partes = clienteStr.split(" - ")
        if (partes.length >= 2) {
          return {
            codigo: partes[0].trim(),
            razonSocial: partes[1].trim(),
            nombreFantasia: partes[1].trim() // Por ahora usamos el mismo valor
          }
        }
        return {
          codigo: clienteStr,
          razonSocial: clienteStr,
          nombreFantasia: clienteStr
        }
      }
      
      // Función auxiliar para formatear fechas
      const formatFechaExcel = (fechaISO: string | undefined) => {
        if (!fechaISO) return ""
        try {
          const fecha = new Date(fechaISO)
          const dia = fecha.getDate().toString().padStart(2, "0")
          const mes = (fecha.getMonth() + 1).toString().padStart(2, "0")
          const año = fecha.getFullYear()
          const horas = fecha.getHours().toString().padStart(2, "0")
          const minutos = fecha.getMinutes().toString().padStart(2, "0")
          return `${dia}/${mes}/${año} ${horas}:${minutos}`
        } catch {
          return fechaISO
        }
      }
      
      // Función auxiliar para determinar provincia basada en código postal
      const obtenerProvincia = (cp: string | undefined) => {
        if (!cp) return ""
        const cpNum = parseInt(cp)
        // CABA: 1000-1499, algunos otros
        if (cpNum >= 1000 && cpNum <= 1999) {
          return "Capital Federal"
        }
        // GBA y resto de Buenos Aires
        return "Buenos Aires"
      }
      
      // Función auxiliar para determinar tipo de dirección
      const obtenerTipoDireccion = (direccion: string | undefined) => {
        if (!direccion) return ""
        const dirLower = direccion.toLowerCase()
        // Palabras clave para identificar negocios
        if (dirLower.includes("local") || dirLower.includes("comercial") || 
            dirLower.includes("negocio") || dirLower.includes("tienda") ||
            dirLower.includes("sucursal") || dirLower.includes("oficina")) {
          return "business"
        }
        return "residential"
      }
      
      // Encabezados completos según las imágenes (sin Nombre cuenta, Latitud, Longitud)
      const headers = [
        "ID (Interno)",
        "Número Tracking",
        "ID venta ML",
        "Usuario ML ID",
        "Fecha Venta",
        "Fecha Colecta",
        "Fecha Zeta Llegue",
        "Método de envío",
        "Cod.Cuenta",
        "Razon Social",
        "Nombre vendedor",
        "Nombre Destinatario",
        "Tel. Destinatario",
        "Email Destinatario",
        "Comentario Destino",
        "Tipo direccion",
        "Dirección",
        "CP",
        "Localidad",
        "Provincia",
        "Estado",
        "Fecha estado",
        "Quien estado",
        "Costo Envio",
        "Cadete",
        "Fecha de asignación",
        "Zonas",
        "Origen",
        "Observaciones"
      ]
      
      // Construir información de filtros aplicados
      const filtrosAplicados: string[] = []
      
      // Mapeo de tipos de fecha a etiquetas
      const tipoFechaLabels: Record<string, string> = {
        fechaVenta: "Fecha de venta",
        fechaLlegue: "Fecha Zeta Llegue",
        fechaEntregado: "Fecha Entregado",
        fechaAsignacion: "Fecha Asignación",
        fechaColecta: "Fecha Colecta",
        fechaCancelado: "Fecha Cancelado",
        fechaUltimoMovimiento: "Fecha último movimiento"
      }
      
      const tipoFechaSeleccionado = filters.tipoFecha || "fechaLlegue"
      const tipoFechaLabel = tipoFechaLabels[tipoFechaSeleccionado] || tipoFechaSeleccionado
      
      // Mostrar tipo de fecha siempre (incluso si es el predeterminado)
      filtrosAplicados.push(`Tipo de fecha: ${tipoFechaLabel}`)
      
      // Mostrar fechas con el tipo de fecha correspondiente
      if (filters.fechaDesde) {
        filtrosAplicados.push(`${tipoFechaLabel} desde: ${filters.fechaDesde}`)
      }
      
      if (filters.fechaHasta) {
        filtrosAplicados.push(`${tipoFechaLabel} hasta: ${filters.fechaHasta}`)
      }
      
      if (filters.estado && filters.estado !== "todos") {
        filtrosAplicados.push(`Estado: ${filters.estado}`)
      }
      
      if (filters.origen && filters.origen !== "todos") {
        filtrosAplicados.push(`Origen: ${filters.origen}`)
      }
      
      if (filters.tracking) {
        filtrosAplicados.push(`Tracking: ${filters.tracking}`)
      }
      
      if (filters.idVenta) {
        filtrosAplicados.push(`ID venta / ID pack: ${filters.idVenta}`)
      }
      
      if (filters.nombreFantasia) {
        filtrosAplicados.push(`Vendedor (nombre): ${filters.nombreFantasia}`)
      }
      
      if (filters.destinoNombre) {
        filtrosAplicados.push(`Destino Nombre: ${filters.destinoNombre}`)
      }
      
      if (filters.destinoDireccion) {
        filtrosAplicados.push(`Destino Dirección: ${filters.destinoDireccion}`)
      }
      
      if (filters.zonasEntrega) {
        filtrosAplicados.push(`Zonas de entrega: ${filters.zonasEntrega}`)
      }
      
      if (userProfile === "Cliente" && userCodigoCliente) {
        filtrosAplicados.push(`Cuenta interna: ${userCodigoCliente}`)
      }
      
      // Mapear todos los envíos a filas del Excel
      const data: any[] = []
      
      // Agregar información de filtros aplicados al inicio
      if (filtrosAplicados.length > 0) {
        data.push(["FILTROS APLICADOS"])
        filtrosAplicados.forEach(filtro => {
          data.push([filtro])
        })
        data.push([]) // Fila vacía de separación
      }
      
      // Agregar headers
      data.push(headers)
      
      // OPTIMIZACIÓN: Obtener historiales para todos los envíos en paralelo (en lotes)
      const historialesMap = new Map<number, { fecha: string, quien: string }>()
      
      // Procesar en lotes de 100 para obtener historiales en paralelo
      const BATCH_SIZE = 100
      for (let i = 0; i < todosLosEnvios.length; i += BATCH_SIZE) {
        const batch = todosLosEnvios.slice(i, i + BATCH_SIZE)
        const historialesPromises = batch.map(async (envio) => {
          try {
            const histResponse = await fetch(`${apiBaseUrl}/envios/${envio.id}/historial`)
            if (histResponse.ok) {
              const historial: any[] = await histResponse.json()
              if (historial && historial.length > 0) {
                // El historial viene ordenado por fecha DESC del backend (más reciente primero)
                const ultimoEstado = historial[0]
                historialesMap.set(envio.id, {
                  fecha: formatFechaExcel(ultimoEstado.fecha),
                  quien: ultimoEstado.quien || ""
                })
              }
            }
          } catch (err) {
            warnDev(`Error al obtener historial para envío ${envio.id}:`, err)
          }
        })
        // Procesar lote en paralelo
        await Promise.all(historialesPromises)
      }
      
      // Mapear envíos a filas
      todosLosEnvios.forEach((envio) => {
        const clienteInfo = parsearCliente(envio.cliente || "")
        const historialInfo = historialesMap.get(envio.id) || { fecha: formatFechaExcel(envio.fechaUltimoMovimiento), quien: "" }
        
        data.push([
          envio.id?.toString() || "",
          envio.tracking || "",
          envio.idml || "",
          envio.idml || "", // Usuario ML ID - usando idml como aproximación
          formatFechaExcel(envio.fechaVenta),
          formatFechaExcel(envio.fechaColecta),
          formatFechaExcel(envio.fechaLlegue),
          envio.metodoEnvio || "",
          clienteInfo.codigo,
          clienteInfo.razonSocial,
          clienteInfo.nombreFantasia,
          envio.nombreDestinatario || "",
          envio.telefono || "",
          envio.email || "",
          envio.cambioRetiro || envio.observaciones || "", // Comentario Destino
          obtenerTipoDireccion(envio.direccion),
          envio.direccion || "",
          envio.codigoPostal || "",
          envio.localidad || "",
          obtenerProvincia(envio.codigoPostal),
          envio.estado || "",
          historialInfo.fecha,
          historialInfo.quien,
          envio.costoEnvio || "",
          envio.choferAsignadoNombre || "",
          formatFechaExcel(envio.fechaAsignacion),
          envio.zonaEntrega || "",
          envio.origen || "",
          envio.observaciones || ""
        ])
      })
      
      // Crear worksheet
      const ws = XLSX.utils.aoa_to_sheet(data)
      
      // Ajustar ancho de columnas
      const colWidths = headers.map(() => ({ wch: 15 }))
      ws['!cols'] = colWidths
      
      // Agregar worksheet al workbook
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Pedidos")
      
      // Descargar archivo
      const fecha = new Date().toISOString().split("T")[0]
      XLSX.writeFile(wb, `envios_${fecha}.xlsx`)
      
    } catch (error) {
      errorDev("Error al descargar Excel:", error)
      alert("Error al descargar el archivo Excel. Por favor, intente nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const formatFecha = (fechaISO: string) => {
    if (!fechaISO) return ""
    const fecha = new Date(fechaISO)
    const dia = fecha.getDate().toString().padStart(2, "0")
    const mes = (fecha.getMonth() + 1).toString().padStart(2, "0")
    const año = fecha.getFullYear()
    const horas = fecha.getHours().toString().padStart(2, "0")
    const minutos = fecha.getMinutes().toString().padStart(2, "0")
    return `${dia}/${mes}/${año} ${horas}:${minutos}`
  }

  const getZonaBadgeClasses = (zona: string) => {
    switch (zona) {
      case "CABA":
        return "bg-purple-50 text-purple-700 border-purple-200"
      case "Zona 1":
        return "bg-purple-100 text-purple-800 border-purple-300"
      case "Zona 2":
        return "bg-purple-200 text-purple-900 border-purple-400"
      case "Zona 3":
        return "bg-purple-300 text-purple-950 border-purple-500"
      default:
        return "bg-gray-100 text-gray-700 border-gray-300"
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <ModernHeader />
      <main className={`px-4 pb-6 pt-4 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-[34px] font-semibold tracking-tight text-[#1570ef]">Pedidos</h1>
            <Button
              onClick={handleDescargarExcel}
              className="h-12 rounded-xl bg-[#eef4ff] px-6 text-[15px] font-semibold text-[#1570ef] hover:bg-[#e3edff]"
            >
              <Download className="mr-2 h-5 w-5" />
              Descargar tabla
            </Button>
          </div>

            {/* Filters Section */}
          <div className="rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-[18px] font-semibold text-[#4f46ce]">Filtros</h2>
              {/* Filtros básicos */}
              <div className="grid grid-cols-6 gap-3">
                <div className="space-y-1">
                  <label className="block text-[14px] font-medium text-[#4d5571]">Tipo de fecha</label>
                  <Select
                    value={filters.tipoFecha}
                    onValueChange={(value) => handleFilterChange("tipoFecha", value)}
                  >
                    <SelectTrigger className="h-11 text-[14px] font-normal text-[#525b76]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fechaVenta">Fecha de venta</SelectItem>
                      <SelectItem value="fechaLlegue">Fecha Zeta Llegue</SelectItem>
                      <SelectItem value="fechaEntregado">Fecha Entregado</SelectItem>
                      <SelectItem value="fechaAsignacion">Fecha Asignación</SelectItem>
                      <SelectItem value="fechaColecta">Fecha Colecta</SelectItem>
                      <SelectItem value="fechaCancelado">Fecha Cancelado</SelectItem>
                      <SelectItem value="fechaUltimoMovimiento">Fecha últi. movimiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1" suppressHydrationWarning>
                  <label className="block text-[14px] font-medium text-[#4d5571]">Fecha desde</label>
                  <Input
                    type="date"
                    value={filters.fechaDesde}
                    onChange={(e) => handleFilterChange("fechaDesde", e.target.value)}
                    className="h-11 text-[14px] font-normal text-[#525b76]"
                  />
                </div>

                <div className="space-y-1" suppressHydrationWarning>
                  <label className="block text-[14px] font-medium text-[#4d5571]">Fecha hasta</label>
                  <Input
                    type="date"
                    value={filters.fechaHasta}
                    onChange={(e) => handleFilterChange("fechaHasta", e.target.value)}
                    className="h-11 text-[14px] font-normal text-[#525b76]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[14px] font-medium text-[#4d5571]">Estado del pedido</label>
                  <Select
                    value={filters.estado}
                    onValueChange={(value) => handleFilterChange("estado", value)}
                  >
                    <SelectTrigger className="h-11 text-[14px] font-normal text-[#525b76]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Pendientes">Pendientes</SelectItem>
                      <SelectItem value="Eliminados">Eliminados</SelectItem>
                      {estadosEnvio.map((estado) => (
                        <SelectItem key={estado} value={estado}>
                          {estado}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5" suppressHydrationWarning>
                  <label className="block text-[14px] font-medium text-[#4d5571]">Origen</label>
                  <Select
                    value={filters.origen}
                    onValueChange={(value) => handleFilterChange("origen", value)}
                  >
                    <SelectTrigger className="h-11 text-[14px] font-normal text-[#525b76]">
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

                <div className="space-y-1.5" suppressHydrationWarning>
                  <label className="block text-[14px] font-medium text-[#4d5571]">N° de Tracking</label>
                  <Input
                    value={filters.tracking}
                    onChange={(e) => handleFilterChange("tracking", e.target.value)}
                    placeholder="Ingresá el N° de tracking"
                    className="h-11 text-[14px] font-normal text-[#525b76]"
                  />
                </div>
              </div>

              {/* Filtros avanzados (mostrar/ocultar) */}
              {showAdvancedFilters && (
                <div className="space-y-3 border-gray-200">
                  <div className="grid grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[14px] font-medium text-[#4d5571]">ID Venta / ID pack</label>
                      <Input
                        value={filters.idVenta}
                        onChange={(e) => handleFilterChange("idVenta", e.target.value)}
                        placeholder="Ingresá ID Venta / ID pack"
                        className="h-11 text-[14px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[14px] font-medium text-[#4d5571]">Logística inversa</label>
                      <Select
                        value={filters.logisticaInversa}
                        onValueChange={(value) => handleFilterChange("logisticaInversa", value)}
                      >
                        <SelectTrigger className="h-11 text-[14px]">
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
                      <label className="block text-[14px] font-medium text-[#4d5571]">Domicilio</label>
                      <Select
                        value={filters.domicilio}
                        onValueChange={(value) => handleFilterChange("domicilio", value)}
                      >
                        <SelectTrigger className="h-11 text-[14px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="comercial">Comercial</SelectItem>
                          <SelectItem value="residencial">Residencial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[14px] font-medium text-[#4d5571]">Zonas de entrega</label>
                      <Input
                        value={filters.zonasEntrega}
                        onChange={(e) => handleFilterChange("zonasEntrega", e.target.value)}
                        placeholder="Seleccioná la zona de entrega"
                        className="h-11 text-[14px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[14px] font-medium text-[#4d5571]">Pedido turbo</label>
                      <Select
                        value={filters.envioTurbo}
                        onValueChange={(value) => handleFilterChange("envioTurbo", value)}
                      >
                        <SelectTrigger className="h-11 text-[14px]">
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
                      <label className="block text-[14px] font-medium text-[#4d5571]">Foto</label>
                      <Select
                        value={filters.fotos}
                        onValueChange={(value) => handleFilterChange("fotos", value)}
                      >
                        <SelectTrigger className="h-11 text-[14px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="si">Si</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[14px] font-medium text-[#4d5571]">Asignado</label>
                      <Select
                        value={filters.asignado}
                        onValueChange={(value) => handleFilterChange("asignado", value)}
                      >
                        <SelectTrigger className="h-11 text-[14px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="si">Si</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {userProfile !== "Cliente" ? (
                      <div className="space-y-1">
                        <label className="block text-[14px] font-medium text-[#4d5571]">Vendedor (nombre)</label>
                        <Input
                          value={filters.nombreFantasia}
                          onChange={(e) => handleFilterChange("nombreFantasia", e.target.value)}
                          placeholder="Seleccioná el nombre fantasía"
                          className="h-11 text-[14px]"
                        />
                      </div>
                    ) : (
                      <div />
                    )}

                    <div className="space-y-1">
                      <label className="block text-[14px] font-medium text-[#4d5571]">Destino nombre</label>
                      <Input
                        value={filters.destinoNombre}
                        onChange={(e) => handleFilterChange("destinoNombre", e.target.value)}
                        placeholder="Escribí el nombre del destino"
                        className="h-11 text-[14px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[14px] font-medium text-[#4d5571]">Destino dirección</label>
                      <Input
                        value={filters.destinoDireccion}
                        onChange={(e) => handleFilterChange("destinoDireccion", e.target.value)}
                        placeholder="Escribí la dirección del destino"
                        className="h-11 text-[14px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[14px] font-medium text-[#4d5571]">Cobranzas</label>
                      <Select
                        value={filters.cobranzas}
                        onValueChange={(value) => handleFilterChange("cobranzas", value)}
                      >
                        <SelectTrigger className="h-11 text-[14px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="si">Si</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div />
                  </div>
                </div>
              )}

            <div className="flex items-center justify-between pt-1">
              <Button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                variant="ghost"
                className="h-10 px-2 text-[16px] font-semibold text-[#4f46ce] hover:bg-transparent hover:text-[#4338ca]"
              >
                {showAdvancedFilters ? (
                  <>
                    Ver menos
                    <ChevronUp className="ml-1 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Ver más
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
              <div className="flex gap-3">
                <Button onClick={handleClearFilters} variant="outline" className="h-11 px-10 text-[14px] rounded-xl">Borrar</Button>
                <Button onClick={() => loadEnvios(0, itemsPerPage)} className="h-11 px-10 text-[14px] rounded-xl bg-[#f2efff] text-[#4f46ce] hover:bg-[#ece8ff]">Aplicar</Button>
              </div>
            </div>
          </div>

            {/* Table */}
          <div className="mt-4 rounded-xl border border-[#e6eaf4] bg-white overflow-hidden">
              <div className="overflow-x-auto" suppressHydrationWarning>
                <div className="flex items-center justify-end border-b border-[#edf0f7] bg-white px-4 py-3 text-sm font-medium text-gray-700">
                  <span className="text-[#6B46FF] font-bold">{totalElements}</span>
                  <span className="ml-2 text-gray-500">registros</span>
                </div>
                <table className="w-full border-collapse table-fixed" style={{ tableLayout: 'fixed', minWidth: '1180px' }}>
                  <thead>
                    <tr className="bg-white border-b border-[#edf0f7]">
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '120px' }}>Estado</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '120px' }}>Tracking</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '120px' }}>ID_NX</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '60px' }}>Origen</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '130px' }}>Vendedor</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '105px' }}>IDML</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '120px' }}>Fecha de venta</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '200px' }}>Dirección</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '130px' }}>Destino nombre</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '70px' }}>CP</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '90px' }}>Zona</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '110px' }}>Repartidor</th>
                      <th className="px-2 py-3 text-right text-xs font-semibold text-[#5f6680] uppercase tracking-tight" style={{ width: '44px' }}>QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEnvios.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-3 py-8 text-center text-sm text-gray-500">
                          Sin resultados para los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      paginatedEnvios.map((envio) => (
                        <tr
                          key={envio.id}
                          className={`border-b border-gray-100 transition-all duration-200 ${userProfile !== "Chofer" ? "hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-transparent cursor-pointer" : ""}`}
                          onClick={() => {
                            if (userProfile === "Chofer") return
                            setSelectedEnvio(envio)
                            setIsDetailModalOpen(true)
                          }}
                        >
                          <td className="px-2 py-3">
                            {userProfile === "Cliente" ? (
                              <span className="text-xs text-gray-700 px-2 py-1 bg-gray-100 rounded border border-gray-300 inline-block max-w-[180px] truncate">
                                {envio.estado || "A retirar"}
                              </span>
                            ) : (userProfile === "Administrativo" || userProfile === "Chofer") && envio.origen !== "Flex" ? (
                              <Select
                                value={envio.estado || "A retirar"}
                                onValueChange={(value) => handleEstadoChange(envio.id, value)}
                              >
                                <SelectTrigger className="h-7 text-xs border-gray-300 w-full max-w-[180px]">
                                  <SelectValue className="truncate" />
                                </SelectTrigger>
                                <SelectContent className="max-w-[200px]">
                                  {((envio.estado || "A retirar") === "A retirar"
                                    ? ["A retirar", "Retirado"]
                                    : estadosEnvio
                                  ).map((estado) => (
                                    <SelectItem key={estado} value={estado} className="text-xs">
                                      <span className="truncate block">{estado}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-gray-700 px-2 py-1 bg-gray-100 rounded border border-gray-300 inline-block max-w-[180px] truncate">
                                {envio.estado || "A retirar"}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-sm font-mono text-gray-700 whitespace-normal break-words">{envio.tracking}</td>
                          <td className="px-2 py-3 text-sm font-mono text-gray-700 whitespace-normal break-words">{envio.idMvg ?? "—"}</td>
                          <td className="px-2 py-3 text-sm">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {envio.origen}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-sm font-medium text-gray-900 whitespace-normal break-words">{envio.cliente}</td>
                          <td className="px-2 py-3 text-sm text-gray-500 whitespace-normal break-words">{envio.idml || "-"}</td>
                          <td className="px-2 py-3 text-sm text-gray-600 whitespace-normal break-words">{formatFecha(envio.fechaVenta || envio.fecha)}</td>
                          <td className="px-2 py-3 text-sm text-gray-700 whitespace-normal break-words">{envio.direccion || "—"}</td>
                          <td className="px-2 py-3 text-sm font-medium text-gray-900 whitespace-normal break-words">{envio.nombreDestinatario}</td>
                          <td className="px-2 py-3 text-sm font-mono text-gray-600 whitespace-normal break-words">
                            {envio.codigoPostal || "-"}
                          </td>
                          <td className="px-2 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border whitespace-normal break-words ${getZonaBadgeClasses(envio.zonaEntrega || "Sin Zona")}`}>
                              {envio.zonaEntrega || "Sin Zona"}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-sm text-gray-700 font-medium whitespace-normal break-words">
                            {envio.choferAsignadoNombre || "-"}
                          </td>
                          <td className="px-2 py-3 text-right">
                            <div className="inline-flex justify-end">
                              <QRThumbnail qrData={envio.qrData} tracking={envio.tracking} size={32} />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 border-t border-[#e6eaf4] bg-[#fafbff] px-4 py-3 sm:px-5" suppressHydrationWarning>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#5d6578]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Total</span>
                      <span className="rounded-md bg-[#eef4ff] px-2 py-0.5 font-semibold text-[#1459e9]">{totalElements}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Páginas</span>
                      <span className="rounded-md border border-[#e6eaf4] bg-white px-2 py-0.5 font-semibold text-[#4d5571]">
                        {totalPages || 1}
                      </span>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-center gap-2 sm:w-auto">
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
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="h-8"
                  >
                    {">"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages - 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="h-8"
                  >
                    {">>"}
                  </Button>
                  </div>

                  <div className="flex justify-start sm:justify-end">
                    <div className="flex items-center gap-2 rounded-xl border border-[#e6eaf4] bg-white px-2.5 py-1">
                      <span className="text-[13px] font-medium text-[#4d5571]">Por página</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => {
                          setItemsPerPage(Number(value))
                          setCurrentPage(0)
                        }}
                      >
                        <SelectTrigger className="h-8 w-14 border-0 bg-transparent text-[13px] font-semibold text-[#1459e9] shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Envio Detail Modal (no se muestra al Chofer: solo ve la tabla y puede cambiar estados) */}
        {userProfile !== "Chofer" && (
          <EnvioDetailModal
            isOpen={isDetailModalOpen}
            onClose={() => {
              setIsDetailModalOpen(false)
              setSelectedEnvio(null)
            }}
            envio={selectedEnvio}
            onDelete={handleDeleteEnvio}
            onAssignSuccess={() => loadEnvios(currentPage, itemsPerPage)}
            onEstadoChange={handleEstadoChange}
          />
        )}
      </main>
    </div>
  )
}

