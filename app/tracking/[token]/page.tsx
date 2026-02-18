"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { getApiBaseUrl } from "@/lib/api-config"
import { logDev, warnDev, errorDev } from "@/lib/logger"

interface Envio {
  id: number
  tracking: string
  nombreDestinatario: string
  direccion: string
  localidad?: string
  codigoPostal?: string
  telefono?: string
  email?: string
  estado?: string
  cliente?: string
  fechaLlegue?: string
  fecha?: string
}

interface HistorialItem {
  id: number
  estado: string
  fecha: string
  horaEstimada?: string
  quien?: string
}

const estadosOrden = [
  "A retirar",
  "Retirado",
  "En camino al destinatario",
  "Entregado",
  "Nadie",
  "Cancelado",
  "Rechazado por el comprador",
  "reprogramado por comprador",
]

export default function TrackingPage() {
  const params = useParams()
  const token = params?.token as string
  const [envio, setEnvio] = useState<Envio | null>(null)
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geolocalizacionEncontrada, setGeolocalizacionEncontrada] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const checkRefIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const checkScriptIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!token) return

    const loadEnvio = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(`${apiBaseUrl}/envios/tracking/${token}`)
        
        if (!response.ok) {
          setError("Envío no encontrado")
          setLoading(false)
          return
        }

        const envioData = await response.json()
        setEnvio(envioData)

        // Cargar historial
        try {
          const historialResponse = await fetch(`${apiBaseUrl}/envios/${envioData.id}/historial`)
          if (historialResponse.ok) {
            const historialData = await historialResponse.json()
            // El backend devuelve ordenado por fecha descendente, necesitamos ordenarlo ascendente
            const historialFormateado: HistorialItem[] = historialData
              .map((item: any) => {
                // Parsear la fecha desde ISO string del backend
                const fecha = new Date(item.fecha)
                return {
                  id: item.id,
                  estado: item.estado,
                  fecha: fecha.toLocaleDateString("es-AR"),
                  horaEstimada: fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
                  quien: item.quien,
                  fechaTimestamp: fecha.getTime(), // Guardar timestamp para ordenar
                }
              })
              // Ordenar por timestamp ascendente (más antiguo primero) para timeline acumulativo
              .sort((a: any, b: any) => a.fechaTimestamp - b.fechaTimestamp)
              // Limpiar fechaTimestamp antes de guardar
              .map(({ fechaTimestamp, ...rest }: any) => rest)
            
            // Si el historial no incluye el estado inicial "A retirar" y el envío tiene fechaLlegue,
            // agregarlo al inicio del timeline
            const estadosEnHistorial = new Set(historialFormateado.map(h => h.estado))
            if (!estadosEnHistorial.has("A retirar") && envioData.fechaLlegue) {
              const fechaLlegue = new Date(envioData.fechaLlegue)
              historialFormateado.unshift({
                id: -1, // ID temporal para el estado inicial
                estado: "A retirar",
                fecha: fechaLlegue.toLocaleDateString("es-AR"),
                horaEstimada: fechaLlegue.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
                quien: "Sistema",
              })
            }
            
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
          }
        } catch (e) {
          errorDev("Error cargando historial:", e)
        }

        setLoading(false)
      } catch (err) {
        errorDev("Error cargando envío:", err)
        setError("Error al cargar el envío")
        setLoading(false)
      }
    }

    loadEnvio()
  }, [token])

  // Inicializar mapa de Google Maps (copiado EXACTAMENTE del modal que funciona)
  useEffect(() => {
    logDev("[TRACKING MAP] useEffect ejecutado", { 
      tieneEnvio: !!envio, 
      tieneMapRef: !!mapRef.current,
      envioData: envio ? {
        direccion: envio.direccion,
        localidad: envio.localidad,
        codigoPostal: envio.codigoPostal
      } : null
    })

    if (!envio) {
      logDev("[TRACKING MAP] No hay envío, saliendo")
      return
    }

    // Esperar a que el mapRef esté disponible (el div se monta después del render)
    if (!mapRef.current) {
      logDev("[TRACKING MAP] mapRef no disponible aún, esperando...")
      // Usar un pequeño intervalo para verificar cuando el ref esté disponible
      checkRefIntervalRef.current = setInterval(() => {
        if (mapRef.current) {
          logDev("[TRACKING MAP] mapRef ahora disponible, continuando...")
          if (checkRefIntervalRef.current) clearInterval(checkRefIntervalRef.current)
          initializeMapLogic()
        }
      }, 50)
    } else {
      initializeMapLogic()
    }

    function initializeMapLogic() {
      if (!envio || !mapRef.current) {
        logDev("[TRACKING MAP] Condición no cumplida en initializeMapLogic", {
          tieneEnvio: !!envio,
          tieneMapRef: !!mapRef.current
        })
        return
      }

      // Cargar script de Google Maps si no está cargado
      if (!window.google) {
        logDev("[TRACKING MAP] Google Maps API no está cargada")
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
        if (existingScript) {
          logDev("[TRACKING MAP] Script existente encontrado, esperando carga...")
          // Si el script ya existe, esperar a que cargue
          checkScriptIntervalRef.current = setInterval(() => {
            if (window.google && window.google.maps) {
              logDev("[TRACKING MAP] Script cargado, inicializando mapa")
              if (checkScriptIntervalRef.current) clearInterval(checkScriptIntervalRef.current)
              initializeMap()
            }
          }, 100)
        } else {
          logDev("[TRACKING MAP] Cargando script de Google Maps...")
          const script = document.createElement("script")
          script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || "YOUR_API_KEY"}&libraries=places,geometry`
          script.async = true
          script.defer = true
          script.id = "google-maps-script-tracking"
          script.onload = () => {
            logDev("[TRACKING MAP] Script cargado exitosamente, inicializando mapa")
            initializeMap()
          }
          script.onerror = () => {
            errorDev("[TRACKING MAP] Error al cargar Google Maps API")
          }
          document.head.appendChild(script)
        }
      } else {
        logDev("[TRACKING MAP] Google Maps API ya está cargada, inicializando mapa directamente")
        initializeMap()
      }

      function initializeMap() {
        logDev("[TRACKING MAP] initializeMap llamado", {
          tieneMapRef: !!mapRef.current,
          tieneEnvio: !!envio
        })

        if (!mapRef.current || !envio) {
          warnDev("[TRACKING MAP] initializeMap: Condición no cumplida", {
            tieneMapRef: !!mapRef.current,
            tieneEnvio: !!envio
          })
          return
        }

        logDev("[TRACKING MAP] Datos del envío:", {
          direccion: envio.direccion,
          localidad: envio.localidad,
          codigoPostal: envio.codigoPostal,
          tipoDireccion: typeof envio.direccion,
          tipoLocalidad: typeof envio.localidad,
          tipoCodigoPostal: typeof envio.codigoPostal
        })

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
        logDev("[TRACKING MAP] Dirección construida para geocodificación:", address)
        logDev("[TRACKING MAP] Partes de la dirección:", addressParts)

        geocoder.geocode({ address }, (results, status) => {
          logDev("[TRACKING MAP] Resultado de geocodificación:", {
            status,
            resultsCount: results?.length || 0,
            firstResult: results?.[0] ? {
              formatted_address: results[0].formatted_address,
              location: results[0].geometry.location ? {
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng()
              } : null
            } : null
          })

          if (status === "OK" && results && results[0]) {
            const location = results[0].geometry.location
            logDev("[TRACKING MAP] Ubicación encontrada:", {
              lat: location.lat(),
              lng: location.lng()
            })
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
            logDev("[TRACKING MAP] Mapa creado exitosamente")

            // Crear marcador
            const marker = new google.maps.Marker({
              position: location,
              map: map,
              title: address,
            })

            markerRef.current = marker
            logDev("[TRACKING MAP] Marcador creado exitosamente")
          } else {
            warnDev("[TRACKING MAP] No se pudo geocodificar la dirección", {
              status,
              errorMessage: status === "ZERO_RESULTS" ? "No se encontraron resultados" :
                            status === "OVER_QUERY_LIMIT" ? "Límite de consultas excedido" :
                            status === "REQUEST_DENIED" ? "Solicitud denegada" :
                            status === "INVALID_REQUEST" ? "Solicitud inválida" :
                            "Error desconocido"
            })
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
            logDev("[TRACKING MAP] Mapa por defecto creado")
          }
        })
      }
    }

    return () => {
      logDev("[TRACKING MAP] Cleanup ejecutado")
      // Limpiar intervalos
      if (checkRefIntervalRef.current) clearInterval(checkRefIntervalRef.current)
      if (checkScriptIntervalRef.current) clearInterval(checkScriptIntervalRef.current)
      // Limpiar marcador al cerrar
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      setGeolocalizacionEncontrada(false)
    }
  }, [envio])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" suppressHydrationWarning>
        <div className="text-center" suppressHydrationWarning>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" suppressHydrationWarning></div>
          <p className="text-gray-600">Cargando información del envío...</p>
        </div>
      </div>
    )
  }

  if (error || !envio) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" suppressHydrationWarning>
        <div className="text-center" suppressHydrationWarning>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Envío no encontrado</h1>
          <p className="text-gray-600">El envío que buscas no existe o el token es inválido.</p>
        </div>
      </div>
    )
  }

  // Determinar el estado actual
  const estadoActual = envio.estado || "A retirar"
  const estadoIndex = estadosOrden.indexOf(estadoActual)
  const estadosHastaActual = estadoIndex >= 0 ? estadosOrden.slice(0, estadoIndex + 1) : [estadoActual]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Seguimiento del envío {envio.tracking}
          </h1>
          {envio.cliente && (
            <p className="text-gray-600">{envio.cliente}</p>
          )}
        </div>

        {/* Main Content - 3 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Recipient Info */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Entrega a domicilio</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-600">{envio.direccion}</p>
                    {envio.localidad && (
                      <p className="text-sm text-gray-500">{envio.localidad}</p>
                    )}
                    {envio.codigoPostal && (
                      <p className="text-sm text-gray-500">CP: {envio.codigoPostal}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{envio.nombreDestinatario}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Information Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">DATOS CLAVE SOBRE TU ENVÍO</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-gray-800">✔ RECEPCIÓN DEL PAQUETE</p>
                  <p className="text-gray-600 mt-1">Cualquier persona mayor de 18 años puede recibirlo.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">📦 PAQUETE DAÑADO</p>
                  <p className="text-gray-600 mt-1">Si el embalaje está visiblemente deteriorado, no lo aceptes y rechaza la entrega completa.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">💰 ENTREGA SIN COSTO EXTRA</p>
                  <p className="text-gray-600 mt-1">No debes pagar ningún importe adicional al recibir el paquete. Si el transportista te solicita dinero, no lo aceptes.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">🚚 INTENTOS DE ENTREGA</p>
                  <p className="text-gray-600 mt-1">Si no se logra entregar en la primera visita, se intentará nuevamente hasta una vez más.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Status Timeline */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">{estadoActual}</h2>
            
            <div className="space-y-4">
              {historial.length > 0 ? (
                historial.map((item, index) => {
                  // El último item (más reciente) debe estar resaltado
                  const isLast = index === historial.length - 1
                  return (
                    <div key={item.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-4 h-4 rounded-full ${isLast ? "bg-green-500" : "bg-gray-300"}`}></div>
                        {index < historial.length - 1 && (
                          <div className="w-0.5 h-12 bg-gray-300 mt-2"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className={`font-medium ${isLast ? "text-gray-800" : "text-gray-600"}`}>{item.estado}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {item.fecha} {item.horaEstimada && `- ${item.horaEstimada}`}
                        </p>
                      </div>
                    </div>
                  )
                })
              ) : (
                // Si no hay historial, mostrar solo el estado actual
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{estadoActual}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {envio.fechaLlegue 
                        ? new Date(envio.fechaLlegue).toLocaleDateString("es-AR") + " - " + new Date(envio.fechaLlegue).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
                        : new Date().toLocaleDateString("es-AR") + " - " + new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Map */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Ubicación de entrega</h2>
            <div className="border-2 border-gray-200 rounded-lg overflow-hidden" style={{ height: "400px" }}>
              <div ref={mapRef} className="w-full h-full" />
            </div>
            {!geolocalizacionEncontrada && envio.direccion && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">Dirección sin geolocalización</p>
              </div>
            )}
            {envio.direccion && (
              <div className="mt-4 space-y-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">Dirección:</p>
                  <p className="text-gray-600">{envio.direccion}</p>
                  {envio.localidad && (
                    <p className="text-gray-600">{envio.localidad}</p>
                  )}
                  {envio.codigoPostal && (
                    <p className="text-gray-600">CP: {envio.codigoPostal}</p>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-800">Recibe:</p>
                  <p className="text-gray-600">{envio.nombreDestinatario}</p>
                </div>
                {envio.telefono && (
                  <div>
                    <p className="font-medium text-gray-800">Tel:</p>
                    <p className="text-gray-600">{envio.telefono}</p>
                  </div>
                )}
                {envio.email && (
                  <div>
                    <p className="font-medium text-gray-800">Email:</p>
                    <p className="text-gray-600">{envio.email}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

