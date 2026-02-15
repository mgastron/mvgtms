"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Filter, Eye, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"
import { EnvioDetailModal } from "@/components/envio-detail-modal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface PedidoTiendaNube {
  pedido: any // JSON del pedido de Tienda Nube
  clienteId: number
  clienteNombre: string
  tiendanubeUrl?: string
  tiendanubeMetodoEnvio?: string
  origen: "TiendaNube" | "Vtex" | "Shopify" // Origen del pedido
  vtexUrl?: string
  vtexMetodoEnvio?: string
  shopifyUrl?: string
  shopifyMetodoEnvio?: string
}

export default function EstadoOrdenesPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<string | null>(null)
  const [pedidos, setPedidos] = useState<PedidoTiendaNube[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<Set<number>>(new Set())
  const [procesando, setProcesando] = useState(false)
  const [pedidosProcesados, setPedidosProcesados] = useState<Set<string>>(new Set()) // Track processed pedidos
  const [pedidosConEnvioExistente, setPedidosConEnvioExistente] = useState<Set<string>>(new Set()) // Track pedidos que ya tienen envío en BD
  const [pedidosPrevios, setPedidosPrevios] = useState<Set<string>>(new Set()) // Track pedidos que ya estaban en la lista anterior
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [selectedEnvio, setSelectedEnvio] = useState<any>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [showReprocesarResult, setShowReprocesarResult] = useState(false)
  const [reprocesarResult, setReprocesarResult] = useState<{
    procesados: number
    yaProcesados: number
    noCoinciden: number
    errores: number
  } | null>(null)
  const [filters, setFilters] = useState({
    fechaDesde: "",
    fechaHasta: "",
    tienda: "todos",
    estadoOrden: "todos",
    nombreFantasia: "todos",
    numeroOrden: "",
    estadoProcesado: "todos",
    fulfillment: "todos",
    estadoFulfillment: "todos",
    metodoEnvio: "",
    destinatario: "",
    direccionDestinatario: "",
  })

  // Verificar autenticación
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const profile = sessionStorage.getItem("userProfile")
    
    if (!isAuthenticated || isAuthenticated !== "true") {
      router.push("/")
      return
    }
    
    if (profile) {
      setUserProfile(profile)
    }
  }, [router])

  // Cargar pedidos
  const loadPedidos = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const apiBaseUrl = getApiBaseUrl()
      
      // OPTIMIZACIÓN: Cargar todos los pedidos en paralelo
      const [responseTiendaNube, responseVtex, responseShopify] = await Promise.all([
        fetch(`${apiBaseUrl}/clientes/tiendanube/pedidos`),
        fetch(`${apiBaseUrl}/clientes/vtex/pedidos`),
        fetch(`${apiBaseUrl}/clientes/shopify/pedidos`)
      ])
      
      // Procesar respuestas en paralelo
      const [dataTiendaNube, dataVtex, dataShopify] = await Promise.all([
        responseTiendaNube.ok ? responseTiendaNube.json() : Promise.resolve([]),
        responseVtex.ok ? responseVtex.json() : Promise.resolve([]),
        responseShopify.ok ? responseShopify.json() : Promise.resolve([])
      ])
      
      // Mapear pedidos
      const pedidosTiendaNube = dataTiendaNube.map((item: any) => ({
        pedido: item.pedido || item,
        clienteId: item.clienteId,
        clienteNombre: item.clienteNombre,
        tiendanubeUrl: item.tiendanubeUrl,
        tiendanubeMetodoEnvio: item.tiendanubeMetodoEnvio,
        origen: "TiendaNube" as const,
      }))
      
      const pedidosVtex = dataVtex.map((item: any) => ({
        pedido: item.pedido || item,
        clienteId: item.clienteId,
        clienteNombre: item.clienteNombre,
        vtexUrl: item.vtexUrl,
        vtexMetodoEnvio: item.vtexMetodoEnvio,
        origen: "Vtex" as const,
      }))
      
      const pedidosShopify = dataShopify.map((item: any) => ({
        pedido: item.pedido || item,
        clienteId: item.clienteId,
        clienteNombre: item.clienteNombre,
        shopifyUrl: item.shopifyUrl,
        shopifyMetodoEnvio: item.shopifyMetodoEnvio,
        origen: "Shopify" as const,
      }))
      
      // Combinar todos los tipos de pedidos
      let pedidosMapeados = [...pedidosTiendaNube, ...pedidosVtex, ...pedidosShopify]
      
      // Ordenar por fecha de creación (más nuevo primero), sin importar el origen
      pedidosMapeados.sort((a, b) => {
        const fechaA = a.pedido.created_at || a.pedido.date_created || a.pedido.created || ""
        const fechaB = b.pedido.created_at || b.pedido.date_created || b.pedido.created || ""
        
        if (!fechaA && !fechaB) return 0
        if (!fechaA) return 1 // Sin fecha va al final
        if (!fechaB) return -1 // Sin fecha va al final
        
        const dateA = new Date(fechaA).getTime()
        const dateB = new Date(fechaB).getTime()
        
        return dateB - dateA // Más nuevo primero
      })
      
      // Cargar pedidos vistos previamente desde sessionStorage
      const pedidosVistosStorage = sessionStorage.getItem('tiendanube_pedidos_vistos')
      const pedidosVistosSet = pedidosVistosStorage ? new Set<string>(JSON.parse(pedidosVistosStorage)) : new Set<string>()
      
      // Identificar pedidos nuevos (que no estaban en la lista anterior)
      const pedidosActualesKeys = new Set(pedidosMapeados.map(item => {
        if (item.origen === "Vtex") {
          return `${item.clienteId}-${item.pedido.orderId || item.pedido.id}`
        } else if (item.origen === "Shopify") {
          return `${item.clienteId}-${item.pedido.order_number || item.pedido.id}`
        } else {
          return `${item.clienteId}-${item.pedido.number || item.pedido.id}`
        }
      }))
      
      // Actualizar sessionStorage con los pedidos actuales
      sessionStorage.setItem('tiendanube_pedidos_vistos', JSON.stringify(Array.from(pedidosActualesKeys)))
      
      // OPTIMIZACIÓN: Mostrar pedidos inmediatamente (sin esperar verificación)
      setPedidosPrevios(pedidosActualesKeys)
      setPedidos(pedidosMapeados)
      setIsLoading(false) // Marcar como cargado para mostrar la tabla
      
      // OPTIMIZACIÓN: Verificar envíos existentes en segundo plano (no bloquea la UI)
      verificarEnviosExistentes(pedidosMapeados).then((enviosExistentes) => {
        // Actualizar estado con los envíos existentes cuando termine
        setPedidosConEnvioExistente(enviosExistentes)
        
        // Procesar automáticamente solo después de verificar (en segundo plano)
        procesarPedidosAutomaticamente(pedidosMapeados, enviosExistentes)
      }).catch((err) => {
        console.error("Error en verificación en segundo plano:", err)
      })
      
    } catch (err: any) {
      console.error("Error al cargar pedidos:", err)
      setError(err.message || "Error al cargar pedidos")
      setIsLoading(false)
    }
  }

  // Verificar qué pedidos ya tienen envíos procesados en la base de datos
  // OPTIMIZACIÓN: Esta función ahora se ejecuta en segundo plano y no bloquea la UI
  const verificarEnviosExistentes = async (pedidosList: PedidoTiendaNube[]): Promise<Set<string>> => {
    const enviosExistentes = new Set<string>()
    
    // Si no hay pedidos, retornar set vacío
    if (pedidosList.length === 0) {
      return enviosExistentes
    }
    
    const apiBaseUrl = getApiBaseUrl()
    
    // OPTIMIZACIÓN: Preparar requests de forma más eficiente
    const requests = pedidosList
      .filter((item) => {
        // Solo verificar pedidos que tienen fecha y destinatario
        const tieneFecha = !!(item.pedido.created_at || item.pedido.date_created || item.pedido.created)
        const tieneDestinatario = !!(item.pedido.shipping_address?.name || 
          item.pedido.customer?.name || 
          item.pedido.customer?.first_name)
        return tieneFecha && tieneDestinatario
      })
      .map((item) => {
        let pedidoKey: string
        let fechaVenta: string | null = null
        let destinatario: string | null = null
        
        if (item.origen === "Vtex") {
          const orderId = item.pedido.orderId || item.pedido.id || ""
          pedidoKey = `${item.clienteId}-${orderId}`
        } else if (item.origen === "Shopify") {
          const orderNumber = item.pedido.order_number || item.pedido.id || ""
          pedidoKey = `${item.clienteId}-${orderNumber}`
        } else {
          // Tienda Nube
          const number = item.pedido.number || item.pedido.id || ""
          pedidoKey = `${item.clienteId}-${number}`
        }
        
        // Obtener fecha de venta - enviar en el formato original según el origen
        if (item.pedido.created_at) {
          fechaVenta = item.pedido.created_at
        } else if (item.pedido.date_created) {
          fechaVenta = item.pedido.date_created
        } else if (item.pedido.created) {
          fechaVenta = item.pedido.created
        }
        
        // Obtener destinatario según el origen (optimizado)
        if (item.origen === "Shopify") {
          destinatario = item.pedido.shipping_address?.name || 
            (item.pedido.customer?.first_name ? 
              `${item.pedido.customer.first_name} ${item.pedido.customer.last_name || ""}`.trim() : 
              null)
        } else {
          // Tienda Nube o VTEX
          destinatario = item.pedido.shipping_address?.name || item.pedido.customer?.name || null
        }
        
        return {
          pedidoKey,
          cliente: item.clienteNombre,
          fechaVenta: fechaVenta || "",
          destinatario: destinatario || "",
          origen: item.origen === "Vtex" ? "Vtex" : item.origen === "Shopify" ? "Shopify" : "TiendaNube",
        }
      })
    
    // Si no hay requests válidos, retornar set vacío
    if (requests.length === 0) {
      return enviosExistentes
    }
    
    try {
      // OPTIMIZACIÓN: Dividir en lotes si hay muchos pedidos (más de 100)
      // Esto evita timeouts y mejora el rendimiento del backend
      const BATCH_SIZE = 100
      if (requests.length > BATCH_SIZE) {
        const batches = []
        for (let i = 0; i < requests.length; i += BATCH_SIZE) {
          batches.push(requests.slice(i, i + BATCH_SIZE))
        }
        
        // Procesar lotes en paralelo
        const results = await Promise.all(
          batches.map(batch =>
            fetch(`${apiBaseUrl}/envios/verificar-existentes`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(batch),
            }).then(res => res.ok ? res.json() : {})
          )
        )
        
        // Combinar resultados
        results.forEach((resultados: Record<string, boolean>) => {
          Object.entries(resultados).forEach(([pedidoKey, existe]) => {
            if (existe) {
              enviosExistentes.add(pedidoKey)
            }
          })
        })
      } else {
        // Si hay pocos pedidos, hacer una sola petición
        const response = await fetch(`${apiBaseUrl}/envios/verificar-existentes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requests),
        })
        
        if (response.ok) {
          const resultados: Record<string, boolean> = await response.json()
          Object.entries(resultados).forEach(([pedidoKey, existe]) => {
            if (existe) {
              enviosExistentes.add(pedidoKey)
            }
          })
        }
      }
    } catch (err) {
      console.error("Error al verificar envíos existentes:", err)
    }
    
    return enviosExistentes
  }

  // Obtener método de envío del pedido (definido antes de usarlo)
  const getMetodoEnvioLocal = (pedido: any, origen?: "TiendaNube" | "Vtex" | "Shopify") => {
    // Para Shopify
    if (origen === "Shopify") {
      if (pedido.shipping_lines && pedido.shipping_lines.length > 0) {
        const shippingLine = pedido.shipping_lines[0]
        if (shippingLine.title) {
          return shippingLine.title
        }
      }
      return ""
    }
    
    // Para VTEX
    if (origen === "Vtex") {
      if (pedido.shippingData && pedido.shippingData.logisticsInfo && pedido.shippingData.logisticsInfo.length > 0) {
        const logistic = pedido.shippingData.logisticsInfo[0]
        if (logistic.selectedSla) {
          return logistic.selectedSla
        }
        if (logistic.shippingMethod) {
          return logistic.shippingMethod
        }
      }
      return ""
    }
    
    // Para Tienda Nube
    if (pedido.shipping_option) {
      return pedido.shipping_option
    }
    if (pedido.shipping_method && pedido.shipping_method.name) {
      return pedido.shipping_method.name
    }
    if (pedido.shipping && pedido.shipping.method) {
      return pedido.shipping.method
    }
    return ""
  }

  // Verificar si el método de envío coincide (definido antes de usarlo)
  const metodoEnvioCoincideLocal = (item: PedidoTiendaNube) => {
    const metodoEnvioPedido = getMetodoEnvioLocal(item.pedido, item.origen)
    
    // Obtener el método de envío configurado según el origen
    let metodoEnvioCliente: string
    if (item.origen === "Vtex") {
      metodoEnvioCliente = item.vtexMetodoEnvio || ""
    } else if (item.origen === "Shopify") {
      metodoEnvioCliente = item.shopifyMetodoEnvio || ""
    } else {
      metodoEnvioCliente = item.tiendanubeMetodoEnvio || ""
    }
    
    if (!metodoEnvioCliente || metodoEnvioCliente.trim() === "") {
      return false
    }
    
    return metodoEnvioPedido.toLowerCase().startsWith(metodoEnvioCliente.toLowerCase())
  }

  // Procesar automáticamente TODOS los pedidos que coinciden con el método de envío
  const procesarPedidosAutomaticamente = async (pedidosList: PedidoTiendaNube[], enviosExistentes: Set<string>) => {
    const pedidosParaProcesar = pedidosList.filter(item => {
      // Construir pedidoKey de la misma manera que en verificarEnviosExistentes
      let pedidoKey: string
      if (item.origen === "Vtex") {
        const orderId = item.pedido.orderId || item.pedido.id || ""
        pedidoKey = `${item.clienteId}-${orderId}`
      } else if (item.origen === "Shopify") {
        const orderNumber = item.pedido.order_number || item.pedido.id || ""
        pedidoKey = `${item.clienteId}-${orderNumber}`
      } else {
        // Tienda Nube
        const number = item.pedido.number || item.pedido.id || ""
        pedidoKey = `${item.clienteId}-${number}`
      }
      
      // NO procesar si ya tiene un envío en la base de datos
      if (enviosExistentes.has(pedidoKey)) {
        return false
      }
      
      // NO procesar si ya fue procesado en esta sesión
      if (pedidosProcesados.has(pedidoKey)) {
        return false
      }
      
      // Solo procesar si coincide con el método de envío actual
      return metodoEnvioCoincideLocal(item)
    })
    
    if (pedidosParaProcesar.length === 0) {
      console.log("No hay pedidos nuevos para procesar automáticamente")
      return
    }
    
    console.log(`Procesando automáticamente ${pedidosParaProcesar.length} pedido(s) que coinciden con el método de envío`)
    
    for (const item of pedidosParaProcesar) {
      // Construir pedidoKey de la misma manera que en el filtro
      let pedidoKey: string
      if (item.origen === "Vtex") {
        const orderId = item.pedido.orderId || item.pedido.id || ""
        pedidoKey = `${item.clienteId}-${orderId}`
      } else if (item.origen === "Shopify") {
        const orderNumber = item.pedido.order_number || item.pedido.id || ""
        pedidoKey = `${item.clienteId}-${orderNumber}`
      } else {
        // Tienda Nube
        const number = item.pedido.number || item.pedido.id || ""
        pedidoKey = `${item.clienteId}-${number}`
      }
      
      try {
        const apiBaseUrl = getApiBaseUrl()
        
        // Determinar el endpoint según el origen
        let endpoint: string
        if (item.origen === "Vtex") {
          endpoint = `${apiBaseUrl}/envios/crear-desde-vtex`
        } else if (item.origen === "Shopify") {
          endpoint = `${apiBaseUrl}/envios/crear-desde-shopify`
        } else {
          endpoint = `${apiBaseUrl}/envios/crear-desde-tiendanube`
        }
        
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pedido: item.pedido,
            clienteId: item.clienteId,
          }),
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Error al procesar pedido ${pedidoKey}:`, errorText)
          continue
        }
        
        const data = await response.json()
        console.log(`Envío creado automáticamente para pedido ${pedidoKey}:`, data)
        // Marcar como procesado para evitar procesarlo de nuevo
        setPedidosProcesados(prev => new Set(prev).add(pedidoKey))
        setPedidosConEnvioExistente(prev => new Set(prev).add(pedidoKey))
      } catch (err: any) {
        console.error(`Error al procesar pedido ${pedidoKey}:`, err)
      }
    }
    
    // NO recargar automáticamente para evitar bucles infinitos
    // El usuario puede usar el botón "Actualizar" manualmente si necesita recargar
  }

  useEffect(() => {
    if (userProfile) {
      loadPedidos()
    }
  }, [userProfile])

  // Formatear fecha (solo fecha)
  const formatFecha = (fechaStr: string | null | undefined) => {
    if (!fechaStr) return "-"
    try {
      const fecha = new Date(fechaStr)
      return fecha.toLocaleDateString("es-AR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    } catch {
      return fechaStr
    }
  }

  // Formatear fecha con hora
  const formatFechaHora = (fechaStr: string | null | undefined) => {
    if (!fechaStr) return "-"
    try {
      const fecha = new Date(fechaStr)
      return fecha.toLocaleString("es-AR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return fechaStr
    }
  }

  // Formatear hora
  const formatHora = (fechaStr: string | null | undefined) => {
    if (!fechaStr) return "-"
    try {
      const fecha = new Date(fechaStr)
      return fecha.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "-"
    }
  }

  // Obtener estado del pedido
  const getEstadoPedido = (pedido: any) => {
    if (pedido.status) {
      // Mapear estados de Tienda Nube a estados en español
      const estados: { [key: string]: string } = {
        "open": "Abierto",
        "closed": "Cerrado",
        "cancelled": "Cancelado",
        "paid": "Pagado",
        "pending": "Pendiente",
        "abandoned": "Abandonado",
      }
      return estados[pedido.status.toLowerCase()] || pedido.status
    }
    if (pedido.fulfillment_status) {
      return pedido.fulfillment_status
    }
    return "Desconocido"
  }

  // Obtener método de envío
  const getMetodoEnvio = (pedido: any, origen?: "TiendaNube" | "Vtex" | "Shopify") => {
    // Para Shopify
    if (origen === "Shopify") {
      if (pedido.shipping_lines && pedido.shipping_lines.length > 0) {
        const shippingLine = pedido.shipping_lines[0]
        if (shippingLine.title) {
          return shippingLine.title
        }
      }
      return ""
    }
    
    // Para VTEX
    if (origen === "Vtex") {
      if (pedido.shippingData && pedido.shippingData.logisticsInfo && pedido.shippingData.logisticsInfo.length > 0) {
        const logistic = pedido.shippingData.logisticsInfo[0]
        if (logistic.selectedSla) {
          return logistic.selectedSla
        }
        if (logistic.shippingMethod) {
          return logistic.shippingMethod
        }
      }
      return ""
    }
    
    // Para Tienda Nube (comportamiento original)
    // Según los logs, el método de envío está en shipping_option
    if (pedido.shipping_option) {
      return pedido.shipping_option
    }
    // Fallback a otros campos posibles
    if (pedido.shipping_method) {
      if (typeof pedido.shipping_method === "string") {
        return pedido.shipping_method
      }
      if (pedido.shipping_method.name) {
        return pedido.shipping_method.name
      }
      if (pedido.shipping_method.title) {
        return pedido.shipping_method.title
      }
    }
    if (pedido.shipping) {
      if (pedido.shipping.method) {
        return pedido.shipping.method
      }
      if (pedido.shipping.method_name) {
        return pedido.shipping.method_name
      }
      if (pedido.shipping.name) {
        return pedido.shipping.name
      }
    }
    if (pedido.shipping_method_name) {
      return pedido.shipping_method_name
    }
    if (pedido.shipping_method_title) {
      return pedido.shipping_method_title
    }
    return "-"
  }

  // Obtener nombre del destinatario
  const getDestinatario = (pedido: any) => {
    // Según los logs, el nombre está en shipping_address.name o contact_name
    if (pedido.shipping_address && pedido.shipping_address.name) {
      return pedido.shipping_address.name
    }
    if (pedido.contact_name) {
      return pedido.contact_name
    }
    if (pedido.customer) {
      if (pedido.customer.name) return pedido.customer.name
      if (pedido.customer.first_name && pedido.customer.last_name) {
        return `${pedido.customer.first_name} ${pedido.customer.last_name}`
      }
      if (pedido.customer.first_name) return pedido.customer.first_name
    }
    return "-"
  }

  // Obtener dirección
  const getDireccion = (pedido: any, origen?: "TiendaNube" | "Vtex" | "Shopify") => {
    if (pedido.shipping_address) {
      const addr = pedido.shipping_address
      const parts = []
      
      // Shopify usa address1 y address2, TiendaNube usa address y number
      if (origen === "Shopify") {
        let calle = addr.address1 || ""
        if (addr.address2 && addr.address2.trim()) {
          calle += " " + addr.address2.trim()
        }
        if (calle.trim()) parts.push(calle.trim())
        if (addr.city && addr.city.trim()) parts.push(addr.city.trim())
        if (addr.province && addr.province.trim()) parts.push(addr.province.trim())
        // No incluir country en la dirección mostrada (similar a TiendaNube)
      } else {
        // TiendaNube o VTEX
        let calle = addr.address || ""
        if (addr.number) calle += " " + addr.number
        if (addr.floor) calle += " " + addr.floor
        if (calle.trim()) parts.push(calle.trim())
        if (addr.locality) parts.push(addr.locality)
        if (addr.city) parts.push(addr.city)
        if (addr.province) parts.push(addr.province)
      }
      
      return parts.length > 0 ? parts.join(", ") : "-"
    }
    return "-"
  }

  // Obtener código postal
  const getCodigoPostal = (pedido: any, origen?: "TiendaNube" | "Vtex" | "Shopify") => {
    if (pedido.shipping_address) {
      const addr = pedido.shipping_address
      // Shopify usa "zip", TiendaNube usa "zipcode", VTEX puede usar "postalCode"
      if (origen === "Shopify") {
        return addr.zip || addr.zip_code || addr.postal_code || "-"
      } else if (origen === "Vtex") {
        return addr.postalCode || addr.zipcode || addr.zip || "-"
      } else {
        // TiendaNube
        return addr.zipcode || "-"
      }
    }
    return "-"
  }

  // Obtener nombre de la tienda (URL de Tienda Nube o VTEX)
  const getNombreTienda = (item: PedidoTiendaNube) => {
    if (item.origen === "Vtex") {
      return item.vtexUrl || "-"
    }
    if (item.origen === "Shopify") {
      return item.shopifyUrl || "-"
    }
    return item.tiendanubeUrl || "-"
  }

  // Verificar si el método de envío del pedido coincide con el configurado en el cliente
  const metodoEnvioCoincide = (item: PedidoTiendaNube) => {
    // Construir pedidoKey de la misma manera que en verificarEnviosExistentes
    let pedidoKey: string
    if (item.origen === "Vtex") {
      const orderId = item.pedido.orderId || item.pedido.id || ""
      pedidoKey = `${item.clienteId}-${orderId}`
    } else if (item.origen === "Shopify") {
      const orderNumber = item.pedido.order_number || item.pedido.id || ""
      pedidoKey = `${item.clienteId}-${orderNumber}`
    } else {
      // Tienda Nube
      const number = item.pedido.number || item.pedido.id || ""
      pedidoKey = `${item.clienteId}-${number}`
    }
    
    // Si el pedido ya tiene un envío procesado, siempre mostrarlo como verde (coincide)
    if (pedidosConEnvioExistente.has(pedidoKey)) {
      return true // Ya fue procesado, siempre verde
    }
    
    // Si el pedido ya fue visto antes (está en sessionStorage) y NO tiene envío en BD,
    // mantenerlo como rojo (no coincide) independientemente de si ahora coincide con la palabra
    // Esto evita que cambie de color automáticamente cuando se cambia la palabra de vinculación
    const pedidosVistosStorage = sessionStorage.getItem('tiendanube_pedidos_vistos')
    const pedidosVistosSet = pedidosVistosStorage ? new Set<string>(JSON.parse(pedidosVistosStorage)) : new Set<string>()
    
    if (pedidosVistosSet.has(pedidoKey)) {
      // Ya fue visto antes y no tiene envío: mantener como rojo hasta que se reprocese manualmente
      return false
    }
    
    // Si es un pedido nuevo (nunca visto antes), verificar si coincide con la palabra de vinculación actual
    const metodoEnvioPedido = getMetodoEnvio(item.pedido, item.origen)
    
    // Obtener el método de envío configurado según el origen
    let metodoEnvioCliente: string
    if (item.origen === "Vtex") {
      metodoEnvioCliente = item.vtexMetodoEnvio || ""
    } else {
      metodoEnvioCliente = item.tiendanubeMetodoEnvio || ""
    }
    
    if (!metodoEnvioCliente || metodoEnvioCliente.trim() === "") {
      return false // Si no hay método configurado, no coincide
    }
    
    // Verificar si el método del pedido empieza igual que el del cliente
    return metodoEnvioPedido.toLowerCase().startsWith(metodoEnvioCliente.toLowerCase())
  }

  // Buscar envío por tracking y abrir el modal
  const handleVerEnvio = async (item: PedidoTiendaNube) => {
    try {
      // Obtener fecha de venta en formato original
      let fechaVenta: string | null = null
      if (item.pedido.created_at) {
        fechaVenta = item.pedido.created_at
      }
      
      // Obtener destinatario
      let destinatario: string | null = null
      if (item.pedido.shipping_address?.name) {
        destinatario = item.pedido.shipping_address.name
      } else if (item.pedido.customer?.name) {
        destinatario = item.pedido.customer.name
      }
      
      if (!fechaVenta || !destinatario) {
        alert("No se encontró el envío para este pedido. Faltan datos del pedido.")
        return
      }
      
      const apiBaseUrl = getApiBaseUrl()
      
      // Buscar el envío usando cliente + fecha + destinatario (mismo método que verificarEnviosExistentes)
      const response = await fetch(`${apiBaseUrl}/envios/buscar-por-pedido`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cliente: item.clienteNombre,
          fechaVenta: fechaVenta,
          destinatario: destinatario,
          origen: item.origen === "Vtex" ? "Vtex" : item.origen === "Shopify" ? "Shopify" : "TiendaNube",
        }),
      })
      
      if (response.ok) {
        const envio = await response.json()
        setSelectedEnvio(envio)
        setIsDetailModalOpen(true)
      } else if (response.status === 404) {
        alert("No se encontró el envío para este pedido. Puede que aún no haya sido procesado.")
      } else {
        throw new Error("Error al buscar el envío")
      }
    } catch (err: any) {
      console.error("Error al buscar envío:", err)
      alert("Error al buscar el envío: " + (err.message || err))
    }
  }

  // Reprocesar pedidos seleccionados: verificar nuevamente si coinciden y procesar los que ahora coincidan
  const handleReprocesar = async () => {
    if (pedidosSeleccionados.size === 0) {
      alert("No hay pedidos seleccionados para reprocesar")
      return
    }

    setProcesando(true)
    try {
      const pedidosARevisar = Array.from(pedidosSeleccionados).map(idx => filteredPedidos[idx])
      const resultados: { procesados: number; noCoinciden: number; yaProcesados: number; errores: number } = { 
        procesados: 0, 
        noCoinciden: 0,
        yaProcesados: 0,
        errores: 0 
      }

      for (const item of pedidosARevisar) {
        // Definir pedidoId una sola vez al inicio según el origen
        let pedidoId: string
        if (item.origen === "Vtex") {
          pedidoId = item.pedido.orderId || item.pedido.id || ""
        } else if (item.origen === "Shopify") {
          pedidoId = item.pedido.order_number || item.pedido.id || ""
        } else {
          pedidoId = item.pedido.number || item.pedido.id || ""
        }
        const pedidoKey = `${item.clienteId}-${pedidoId}`
        
        try {
          // Verificar si ya fue procesado (tiene envío en BD)
          if (pedidosConEnvioExistente.has(pedidoKey)) {
            resultados.yaProcesados++
            console.log(`Pedido ${pedidoId} ya fue procesado anteriormente, no se reprocesa`)
            continue
          }

          // Verificar si el método de envío coincide con la palabra de vinculación actual
          const metodoEnvioPedido = getMetodoEnvio(item.pedido, item.origen)
          
          // Obtener el método de envío configurado según el origen
          let metodoEnvioCliente: string
          if (item.origen === "Vtex") {
            metodoEnvioCliente = item.vtexMetodoEnvio || ""
          } else if (item.origen === "Shopify") {
            metodoEnvioCliente = item.shopifyMetodoEnvio || ""
          } else {
            metodoEnvioCliente = item.tiendanubeMetodoEnvio || ""
          }
          
          console.log(`Reprocesando pedido ${pedidoId} (${item.origen}): método pedido="${metodoEnvioPedido}", método cliente="${metodoEnvioCliente}"`)
          
          if (!metodoEnvioCliente || metodoEnvioCliente.trim() === "") {
            resultados.noCoinciden++
            console.log(`Pedido ${pedidoId} no tiene método de envío configurado`)
            continue
          }
          
          const ahoraCoincide = metodoEnvioPedido.toLowerCase().startsWith(metodoEnvioCliente.toLowerCase())
          
          if (!ahoraCoincide) {
            // Si aún no coincide, no procesar
            resultados.noCoinciden++
            console.log(`Pedido ${pedidoId} aún no coincide con el método de envío configurado`)
            continue
          }

          // Si ahora coincide y no fue procesado antes, procesarlo
          console.log(`Reprocesando pedido ${pedidoId} - ahora coincide con el método de envío`)
          const apiBaseUrl = getApiBaseUrl()
          
          // Determinar el endpoint según el origen
          let endpoint: string
          if (item.origen === "Vtex") {
            endpoint = `${apiBaseUrl}/envios/crear-desde-vtex`
          } else if (item.origen === "Shopify") {
            endpoint = `${apiBaseUrl}/envios/crear-desde-shopify`
          } else {
            endpoint = `${apiBaseUrl}/envios/crear-desde-tiendanube`
          }
          
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pedido: item.pedido,
              clienteId: item.clienteId,
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error(`Error al procesar pedido ${pedidoId}:`, errorText)
            resultados.errores++
            continue
          }

          const data = await response.json()
          console.log(`Envío creado exitosamente para pedido ${pedidoId}:`, data)
          resultados.procesados++

          // Marcar como procesado
          setPedidosProcesados(prev => new Set(prev).add(pedidoKey))
          setPedidosConEnvioExistente(prev => new Set(prev).add(pedidoKey))
        } catch (err: any) {
          console.error(`Error al procesar pedido ${pedidoId}:`, err)
          resultados.errores++
        }
      }

      // Limpiar selección
      setPedidosSeleccionados(new Set())
      
      // Guardar resultados para mostrar en el modal
      setReprocesarResult(resultados)
      setShowReprocesarResult(true)
      
      // Recargar pedidos para actualizar la vista (el backend ya persistió con saveAndFlush)
      await loadPedidos()
    } catch (err: any) {
      console.error("Error al reprocesar pedidos:", err)
      alert("Error al reprocesar pedidos: " + (err.message || err))
    } finally {
      setProcesando(false)
    }
  }

  // Filtrar pedidos según los filtros aplicados
  const filteredPedidos = useMemo(() => {
    return pedidos.filter((item) => {
      const pedido = item.pedido

      // Filtro por nombre fantasia
      if (filters.nombreFantasia !== "todos" && item.clienteNombre !== filters.nombreFantasia) {
        return false
      }

      // Filtro por número de orden
      if (filters.numeroOrden) {
        const numeroOrden = (pedido.number || pedido.id || pedido.orderId || "").toString()
        if (!numeroOrden.includes(filters.numeroOrden)) {
          return false
        }
      }

      // Filtro por estado de orden
      if (filters.estadoOrden !== "todos") {
        const estado = getEstadoPedido(pedido).toLowerCase()
        if (filters.estadoOrden === "pendientes") {
          // Pendientes: estados que no sean "Cancelado" o "Cerrado"
          if (estado === "cancelado" || estado === "cerrado") {
            return false
          }
        } else if (filters.estadoOrden === "canceladas") {
          // Canceladas: solo "Cancelado" o "Cerrado"
          if (estado !== "cancelado" && estado !== "cerrado") {
            return false
          }
        }
      }

      // Filtro por tienda
      if (filters.tienda !== "todos") {
        if (filters.tienda === "tienda nube") {
          // Verificar que el origen sea TiendaNube
          if (item.origen !== "TiendaNube") {
            return false
          }
        } else if (filters.tienda === "shopify") {
          // Verificar que el origen sea Shopify
          if (item.origen !== "Shopify") {
            return false
          }
        } else if (filters.tienda === "vtex") {
          // Verificar que el origen sea Vtex
          if (item.origen !== "Vtex") {
            return false
          }
        }
      }

      // Filtro por estado procesado
      if (filters.estadoProcesado !== "todos") {
        // Por ahora todos están en "No", pero esto puede cambiar cuando se implemente el procesamiento
        // Esta lógica se actualizará cuando tengamos el campo real de estado procesado
        if (filters.estadoProcesado === "si") {
          // Aquí se verificará si el pedido está procesado
          // Por ahora retornamos false porque no hay procesados
          return false
        } else if (filters.estadoProcesado === "en procesamiento") {
          // Aquí se verificará si el pedido está en procesamiento
          // Por ahora retornamos false porque no hay en procesamiento
          return false
        }
        // Si es "no", todos los pedidos pasan (por ahora todos están en "No")
      }

      // Filtro por fulfillment
      if (filters.fulfillment !== "todos") {
        const hasFulfillment = pedido.fulfillments && pedido.fulfillments.length > 0
        if (filters.fulfillment === "si" && !hasFulfillment) {
          return false
        }
        if (filters.fulfillment === "no" && hasFulfillment) {
          return false
        }
      }

      // Filtro por estado fulfillment
      if (filters.estadoFulfillment !== "todos") {
        const fulfillmentStatus = pedido.fulfillments?.[0]?.status || ""
        const statusLower = fulfillmentStatus.toLowerCase()
        
        if (filters.estadoFulfillment === "procesado correctamente") {
          // Estados que indican procesado correctamente (ej: "PACKED", "SHIPPED", "DELIVERED")
          if (!["packed", "shipped", "delivered", "completed"].includes(statusLower)) {
            return false
          }
        } else if (filters.estadoFulfillment === "no procesado") {
          // Estados que indican no procesado (ej: vacío, "UNFULFILLED")
          if (statusLower && !["unfulfilled", "pending"].includes(statusLower)) {
            return false
          }
          if (!statusLower) {
            // Si no hay fulfillment, se considera "no procesado"
            return true
          }
        } else if (filters.estadoFulfillment === "en procesamiento") {
          // Estados que indican en procesamiento (ej: "PROCESSING", "PREPARING")
          if (!["processing", "preparing", "in_transit"].includes(statusLower)) {
            return false
          }
        }
      }

      // Filtro por método de envío (texto)
      if (filters.metodoEnvio) {
        const metodo = getMetodoEnvio(pedido).toLowerCase()
        if (!metodo.includes(filters.metodoEnvio.toLowerCase())) {
          return false
        }
      }

      // Filtro por destinatario
      if (filters.destinatario && !getDestinatario(pedido).toLowerCase().includes(filters.destinatario.toLowerCase())) {
        return false
      }

      // Filtro por dirección destinatario
      if (filters.direccionDestinatario && !getDireccion(pedido, item.origen).toLowerCase().includes(filters.direccionDestinatario.toLowerCase())) {
        return false
      }

      // Filtro por fecha desde
      if (filters.fechaDesde) {
        const fechaCreacion = pedido.created_at || pedido.date_created || pedido.created
        if (fechaCreacion) {
          const fecha = new Date(fechaCreacion)
          const fechaDesde = new Date(filters.fechaDesde)
          if (fecha < fechaDesde) {
            return false
          }
        }
      }

      // Filtro por fecha hasta
      if (filters.fechaHasta) {
        const fechaCreacion = pedido.created_at || pedido.date_created || pedido.created
        if (fechaCreacion) {
          const fecha = new Date(fechaCreacion)
          const fechaHasta = new Date(filters.fechaHasta)
          fechaHasta.setHours(23, 59, 59, 999) // Incluir todo el día
          if (fecha > fechaHasta) {
            return false
          }
        }
      }

      return true
    })
  }, [pedidos, filters])

  // Calcular paginación
  const totalPages = Math.ceil(filteredPedidos.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedPedidos = filteredPedidos.slice(startIndex, endIndex)

  // Obtener valores únicos para los selects
  const estadosUnicos = useMemo(() => {
    const estados = new Set<string>()
    pedidos.forEach((item) => {
      const pedido = item.pedido
      let estado = "Desconocido"
      if (pedido.status) {
        const estadosMap: { [key: string]: string } = {
          "open": "Abierto",
          "closed": "Cerrado",
          "cancelled": "Cancelado",
          "paid": "Pagado",
          "pending": "Pendiente",
          "abandoned": "Abandonado",
        }
        estado = estadosMap[pedido.status.toLowerCase()] || pedido.status
      } else if (pedido.fulfillment_status) {
        estado = pedido.fulfillment_status
      }
      if (estado) estados.add(estado)
    })
    return Array.from(estados).sort()
  }, [pedidos])

  // Obtener nombres de clientes que tienen vinculación (no Mercado Libre)
  // Por ahora solo mostramos los que tienen pedidos de Tienda Nube, Shopify o VTEX
  const nombresFantasiaUnicos = useMemo(() => {
    const nombres = new Set<string>()
    pedidos.forEach((item) => {
      // Solo incluir clientes que tienen pedidos de plataformas que no sean Mercado Libre
      // Por ahora todos los pedidos vienen de Tienda Nube, pero esto puede expandirse
      if (item.clienteNombre) nombres.add(item.clienteNombre)
    })
    return Array.from(nombres).sort()
  }, [pedidos])

  const estadosFulfillmentUnicos = useMemo(() => {
    const estados = new Set<string>()
    pedidos.forEach((item) => {
      const pedido = item.pedido
      if (pedido.fulfillments && pedido.fulfillments.length > 0) {
        pedido.fulfillments.forEach((fulfillment: any) => {
          if (fulfillment.status) estados.add(fulfillment.status)
        })
      }
    })
    return Array.from(estados).sort()
  }, [pedidos])

  if (!userProfile) {
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50" suppressHydrationWarning>
      <ModernHeader />
      <div className="flex-1 flex flex-col overflow-hidden" suppressHydrationWarning>
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ESTADO ORDENES</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={loadPedidos}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow mb-4 p-4">
            {/* Fila Superior */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              {/* Fecha venta desde/hasta */}
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha venta desde/hasta
                </label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={filters.fechaDesde}
                    onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
                    className="w-full text-xs"
                  />
                  <Input
                    type="date"
                    value={filters.fechaHasta}
                    onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })}
                    className="w-full text-xs"
                  />
                </div>
              </div>

              {/* Tiendas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tiendas
                </label>
                <Select
                  value={filters.tienda}
                  onValueChange={(value) => setFilters({ ...filters, tienda: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="tienda nube">Tienda Nube</SelectItem>
                    <SelectItem value="shopify">Shopify</SelectItem>
                    <SelectItem value="vtex">VTEX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Estado de la Orden */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado de la Orden
                </label>
                <Select
                  value={filters.estadoOrden}
                  onValueChange={(value) => setFilters({ ...filters, estadoOrden: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="pendientes">Pendientes</SelectItem>
                    <SelectItem value="canceladas">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Nombre fantasia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre fantasia
                </label>
                <Select
                  value={filters.nombreFantasia}
                  onValueChange={(value) => setFilters({ ...filters, nombreFantasia: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {nombresFantasiaUnicos.map((nombre) => (
                      <SelectItem key={nombre} value={nombre}>
                        {nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Número Orden */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número Orden
                </label>
                <Input
                  type="text"
                  placeholder="Buscar por número..."
                  value={filters.numeroOrden}
                  onChange={(e) => setFilters({ ...filters, numeroOrden: e.target.value })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Fila Inferior */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
              {/* Estado Procesado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado Procesado
                </label>
                <Select
                  value={filters.estadoProcesado}
                  onValueChange={(value) => setFilters({ ...filters, estadoProcesado: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="si">Si</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="en procesamiento">En procesamiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fulfillment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fulfillment
                </label>
                <Select
                  value={filters.fulfillment}
                  onValueChange={(value) => setFilters({ ...filters, fulfillment: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="si">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Estado Fulfillment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado Fulfillment
                </label>
                <Select
                  value={filters.estadoFulfillment}
                  onValueChange={(value) => setFilters({ ...filters, estadoFulfillment: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="procesado correctamente">Procesado correctamente</SelectItem>
                    <SelectItem value="no procesado">No procesado</SelectItem>
                    <SelectItem value="en procesamiento">En procesamiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Método de envío */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de envío
                </label>
                <Input
                  type="text"
                  placeholder="Buscar método..."
                  value={filters.metodoEnvio}
                  onChange={(e) => setFilters({ ...filters, metodoEnvio: e.target.value })}
                  className="w-full"
                />
              </div>

              {/* Destinatario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destinatario
                </label>
                <Input
                  type="text"
                  placeholder="Buscar destinatario..."
                  value={filters.destinatario}
                  onChange={(e) => setFilters({ ...filters, destinatario: e.target.value })}
                  className="w-full"
                />
              </div>

              {/* Dirección destinatario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección destinatario
                </label>
                <Input
                  type="text"
                  placeholder="Buscar dirección..."
                  value={filters.direccionDestinatario}
                  onChange={(e) => setFilters({ ...filters, direccionDestinatario: e.target.value })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Botón FILTRAR */}
            <div className="flex justify-center mt-4">
              <Button
                onClick={() => {
                  // Los filtros ya se aplican automáticamente con useMemo
                  // Este botón puede servir para forzar una recarga si es necesario
                }}
                className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-8 py-2 uppercase"
              >
                FILTRAR
              </Button>
            </div>
          </div>

          {isLoading && pedidos.length === 0 ? (
            <div className="flex items-center justify-center h-64" suppressHydrationWarning>
              <div className="text-center" suppressHydrationWarning>
                <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500" suppressHydrationWarning>Cargando pedidos...</p>
              </div>
            </div>
          ) : filteredPedidos.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 text-lg" suppressHydrationWarning>
                {pedidos.length === 0 
                  ? "No hay pedidos de Tienda Nube, VTEX o Shopify disponibles"
                  : "No se encontraron pedidos con los filtros aplicados"}
              </p>
              <p className="text-gray-400 text-sm mt-2" suppressHydrationWarning>
                {pedidos.length === 0
                  ? "Asegúrate de que los clientes tengan la integración de Tienda Nube o VTEX vinculada"
                  : "Intenta ajustar los filtros de búsqueda"}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-1 p-0"></th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight leading-tight whitespace-nowrap">
                        Nombre<br />Fantasia
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight whitespace-nowrap">
                        Nombre Tienda
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight whitespace-nowrap">
                        Tienda
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight whitespace-nowrap">
                        Número Orden
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight leading-tight whitespace-nowrap">
                        Estado<br />Procesado
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight whitespace-nowrap">
                        Estado Orden
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight leading-tight whitespace-nowrap">
                        Metodo<br />de envio
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight whitespace-nowrap">
                        Destinatario
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight leading-tight whitespace-nowrap">
                        Fecha<br />venta
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight leading-tight whitespace-nowrap">
                        Hora<br />ingreso
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight leading-tight whitespace-nowrap">
                        Hora<br />Procesado
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight whitespace-nowrap">
                        Direccion
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight whitespace-nowrap">
                        Destino CP
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-tight whitespace-nowrap">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedPedidos.map((item, index) => {
                      const pedido = item.pedido
                      // Para VTEX, usar creationDate; para Tienda Nube, usar created_at
                      const fechaCreacion = item.origen === "Vtex"
                        ? (pedido.creationDate || pedido.created_at || pedido.date_created || pedido.created)
                        : item.origen === "Shopify"
                        ? (pedido.created_at || pedido.date_created || pedido.created)
                        : (pedido.created_at || pedido.date_created || pedido.created)
                      const fechaActualizacion = item.origen === "Vtex"
                        ? (pedido.lastChange || pedido.updated_at || pedido.date_updated || pedido.updated)
                        : item.origen === "Shopify"
                        ? (pedido.updated_at || pedido.date_updated || pedido.updated)
                        : (pedido.updated_at || pedido.date_updated || pedido.updated)
                      const coincide = metodoEnvioCoincide(item)
                      const originalIndex = startIndex + index // Índice original en filteredPedidos
                      return (
                        <tr 
                          key={originalIndex} 
                          className={`hover:bg-gray-50 ${coincide ? 'bg-green-50' : 'bg-red-50'} relative`}
                        >
                          {/* Barra vertical de color al inicio */}
                          <td className="w-1 p-0">
                            <div className={`h-full w-1 ${coincide ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-900 whitespace-normal break-words">
                            {item.clienteNombre}
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-500 whitespace-normal break-words">
                            {getNombreTienda(item)}
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500">
                            {item.origen === "Vtex" ? "VTEX" : item.origen === "Shopify" ? "Shopify" : "Tienda Nube"}
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs font-medium text-gray-900">
                            {item.origen === "Vtex" 
                              ? (pedido.orderId || pedido.id || "-")
                              : item.origen === "Shopify"
                              ? (pedido.order_number || pedido.id || "-")
                              : (pedido.number || pedido.id || "-")
                            }
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500">
                            {(() => {
                              let pedidoKey: string
                              if (item.origen === "Vtex") {
                                const orderId = pedido.orderId || pedido.id || ""
                                pedidoKey = `${item.clienteId}-${orderId}`
                              } else if (item.origen === "Shopify") {
                                const orderNumber = pedido.order_number || pedido.id || ""
                                pedidoKey = `${item.clienteId}-${orderNumber}`
                              } else {
                                const number = pedido.number || pedido.id || ""
                                pedidoKey = `${item.clienteId}-${number}`
                              }
                              return pedidosConEnvioExistente.has(pedidoKey) ? "Si" : "No"
                            })()}
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500">
                            {getEstadoPedido(pedido)}
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-900 whitespace-normal break-words leading-tight">
                            {getMetodoEnvio(pedido, item.origen)}
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-500 whitespace-normal break-words">
                            {getDestinatario(pedido)}
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-500 whitespace-normal break-words leading-tight">
                            <div className="break-words">{formatFecha(fechaCreacion)}</div>
                            <div className="text-[10px] text-gray-400 break-words">{formatHora(fechaCreacion)}</div>
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-500 whitespace-normal break-words leading-tight">
                            <div className="break-words">{formatFecha(fechaCreacion)}</div>
                            <div className="text-[10px] text-gray-400 break-words">{formatHora(fechaCreacion)}</div>
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-500 whitespace-normal break-words leading-tight">
                            <div className="break-words">{formatFecha(fechaActualizacion)}</div>
                            <div className="text-[10px] text-gray-400 break-words">{formatHora(fechaActualizacion)}</div>
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-500 whitespace-normal break-words">
                            {getDireccion(pedido, item.origen)}
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500">
                            {getCodigoPostal(pedido, item.origen)}
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500 text-center">
                            {coincide ? (
                              // Verdes: ícono de ojo para ver el envío
                              <button
                                onClick={() => handleVerEnvio(item)}
                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                title="Ver envío"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            ) : (
                              // Rojos: checkbox para seleccionar
                              <input
                                type="checkbox"
                                checked={pedidosSeleccionados.has(originalIndex)}
                                onChange={(e) => {
                                  const newSet = new Set(pedidosSeleccionados)
                                  if (e.target.checked) {
                                    newSet.add(originalIndex)
                                  } else {
                                    newSet.delete(originalIndex)
                                  }
                                  setPedidosSeleccionados(newSet)
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Botón REPROCESAR */}
          <div className="mt-4 flex justify-center">
            <Button
              onClick={handleReprocesar}
              disabled={pedidosSeleccionados.size === 0 || procesando}
              className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-8 py-3 text-base uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {procesando ? "Procesando..." : "REPROCESAR"}
            </Button>
          </div>

          {/* Paginación */}
          {filteredPedidos.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
              {/* Información de registros */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">Total de registros: {filteredPedidos.length}</span>
                </div>
                <div className="text-sm text-gray-700 mt-2 sm:mt-0">
                  <span className="font-medium">Total de páginas: {totalPages}</span>
                </div>
              </div>

              {/* Controles de paginación */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &lt;&lt;
                </button>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &lt;
                </button>
                
                {/* Números de página */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm border rounded ${
                        currentPage === pageNum
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &gt;
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &gt;&gt;
                </button>
              </div>

              {/* Cantidad por página */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Cantidad por página</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-20 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Envio Detail Modal */}
      <EnvioDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedEnvio(null)
        }}
        envio={selectedEnvio}
        onDelete={async (envioId: number) => {
          // Manejar eliminación si es necesario
          console.log("Eliminar envío:", envioId)
          setIsDetailModalOpen(false)
          setSelectedEnvio(null)
          await loadPedidos() // Recargar pedidos
        }}
      />

      {/* Modal de Resultados de Reprocesamiento */}
      <AlertDialog open={showReprocesarResult} onOpenChange={setShowReprocesarResult}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              Reprocesamiento Completado
            </AlertDialogTitle>
            <AlertDialogDescription asChild className="pt-4">
              <div className="space-y-3">
                {reprocesarResult && reprocesarResult.procesados > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-green-800">
                        {reprocesarResult.procesados} pedido(s) procesado(s) exitosamente
                      </div>
                    </div>
                  </div>
                )}
                
                {reprocesarResult && reprocesarResult.yaProcesados > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-blue-800">
                        {reprocesarResult.yaProcesados} pedido(s) ya fueron procesados anteriormente
                      </div>
                      <div className="text-sm text-blue-600 mt-1">No se reprocesan automáticamente</div>
                    </div>
                  </div>
                )}
                
                {reprocesarResult && reprocesarResult.noCoinciden > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-yellow-800">
                        {reprocesarResult.noCoinciden} pedido(s) aún no coinciden
                      </div>
                      <div className="text-sm text-yellow-600 mt-1">No coinciden con el método de envío configurado</div>
                    </div>
                  </div>
                )}
                
                {reprocesarResult && reprocesarResult.errores > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-red-800">
                        {reprocesarResult.errores} pedido(s) con errores
                      </div>
                      <div className="text-sm text-red-600 mt-1">Revisa los logs para más detalles</div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowReprocesarResult(false)
                setReprocesarResult(null)
              }}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

