"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Globe, Search, X } from "lucide-react"
import { ModernHeader } from "@/components/modern-header"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev, errorDev } from "@/lib/logger"

interface ChoferConUbicacion {
  id: number
  nombre: string
  apellido: string
  nombreCompleto: string
  latitud: number | null
  longitud: number | null
  ultimaActualizacionUbicacion: string | null
  bateria: number | null
  cantidadEnvios: number
  envios: any[]
}

declare global {
  interface Window {
    google: any
  }
}

export default function GeochoferesPage() {
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<number, google.maps.Marker>>(new Map())
  const depositoMarkerRef = useRef<google.maps.Marker | null>(null)
  const [choferes, setChoferes] = useState<ChoferConUbicacion[]>([])
  const [choferesFiltrados, setChoferesFiltrados] = useState<ChoferConUbicacion[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [countdown, setCountdown] = useState(30)
  const [isLoading, setIsLoading] = useState(true)

  // Verificar autenticación
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    if (!isAuthenticated) {
      router.push("/")
      return
    }
  }, [router])

  // Cargar choferes
  const loadChoferes = async () => {
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/usuarios/choferes-con-envios`)
      if (response.ok) {
        const data = await response.json()
        setChoferes(data)
        setChoferesFiltrados(data)
      } else {
        errorDev("Error al cargar choferes:", response.statusText)
      }
    } catch (error) {
      errorDev("Error de conexión al cargar choferes:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current) return

    // Cargar script de Google Maps si no está cargado
    if (!window.google) {
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
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
      script.id = "google-maps-script-geochoferes"
      script.onload = () => initializeMap()
      script.onerror = () => {
        errorDev("Error al cargar Google Maps API")
      }
      document.head.appendChild(script)
    } else {
      initializeMap()
    }

    function initializeMap() {
      if (!mapRef.current) return

      // Centro en Buenos Aires
      const buenosAires = { lat: -34.6037, lng: -58.3816 }

      const map = new google.maps.Map(mapRef.current, {
        center: buenosAires,
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      })

      mapInstanceRef.current = map
      
      // Geocodificar y agregar marcador del depósito
      const geocoder = new google.maps.Geocoder()
      const depositoAddress = "José C. Paz 3108, Buenos Aires, Argentina"
      
      geocoder.geocode({ address: depositoAddress }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const location = results[0].geometry.location
          
          // Crear marcador del depósito con ícono y color diferente
          // Usar un ícono personalizado SVG para el depósito
          const depositoIcon = {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#DC2626", // Rojo
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 3,
            scale: 12,
            labelOrigin: new google.maps.Point(0, 0),
          }

          const depositoMarker = new google.maps.Marker({
            position: location,
            map: map,
            title: "Depósito - José C. Paz 3108",
            icon: depositoIcon,
            zIndex: 1000, // Asegurar que esté por encima de otros marcadores
            label: {
              text: "🏢",
              fontSize: "20px",
              fontWeight: "bold",
            },
          })

          // Info window del depósito
          const depositoInfoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px;">
                <strong>🏢 Depósito</strong><br/>
                José C. Paz 3108<br/>
                Buenos Aires, Argentina
              </div>
            `,
          })

          depositoMarker.addListener("click", () => {
            depositoInfoWindow.open(map, depositoMarker)
          })

          depositoMarkerRef.current = depositoMarker
        } else {
          warnDev("No se pudo geocodificar la dirección del depósito:", depositoAddress)
        }
      })
      
      loadChoferes()
    }
  }, [])

  // Actualizar marcadores en el mapa
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // Limpiar marcadores de choferes anteriores (pero NO el del depósito)
    markersRef.current.forEach((marker) => {
      marker.setMap(null)
    })
    markersRef.current.clear()

    // Crear nuevos marcadores
    choferesFiltrados.forEach((chofer) => {
      if (chofer.latitud && chofer.longitud) {
        const marker = new google.maps.Marker({
          position: { lat: chofer.latitud, lng: chofer.longitud },
          map: mapInstanceRef.current,
          title: chofer.nombreCompleto,
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            scaledSize: new google.maps.Size(40, 40),
          },
        })

        // Info window con nombre del chofer
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px;">
              <strong>${chofer.nombreCompleto}</strong><br/>
              Envíos: ${chofer.cantidadEnvios}
            </div>
          `,
        })

        marker.addListener("click", () => {
          infoWindow.open(mapInstanceRef.current, marker)
        })

        markersRef.current.set(chofer.id, marker)
      }
    })
  }, [choferesFiltrados])

  // Filtro de búsqueda
  useEffect(() => {
    if (!searchTerm.trim()) {
      setChoferesFiltrados(choferes)
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = choferes.filter(
      (chofer) =>
        chofer.nombre.toLowerCase().includes(term) ||
        chofer.apellido.toLowerCase().includes(term) ||
        chofer.nombreCompleto.toLowerCase().includes(term)
    )
    setChoferesFiltrados(filtered)
  }, [searchTerm, choferes])

  // Countdown y actualización automática cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadChoferes()
          return 30
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Zoom al hacer click en chofer
  const handleChoferClick = (chofer: ChoferConUbicacion) => {
    if (!mapInstanceRef.current) return

    if (chofer.latitud && chofer.longitud) {
      const position = { lat: chofer.latitud, lng: chofer.longitud }
      mapInstanceRef.current.setCenter(position)
      mapInstanceRef.current.setZoom(15)

      // Abrir info window del marcador
      const marker = markersRef.current.get(chofer.id)
      if (marker) {
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px;">
              <strong>${chofer.nombreCompleto}</strong><br/>
              Envíos: ${chofer.cantidadEnvios}
            </div>
          `,
        })
        infoWindow.open(mapInstanceRef.current, marker)
      }
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <ModernHeader />
      
      {/* Contenido principal */}
      <div className="flex flex-1 overflow-hidden">
      {/* Lista de choferes */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-[#6B46FF]" />
            <h1 className="text-lg font-semibold text-gray-900">GEO CHOFERES</h1>
          </div>
          
          {/* Búsqueda */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ubicar chofer"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6B46FF] focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="text-sm text-gray-600 font-medium min-w-[30px] text-center">
              {countdown}
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Cargando choferes...</div>
          ) : choferesFiltrados.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? "No se encontraron choferes" : "No hay choferes con envíos asignados"}
            </div>
          ) : (
            choferesFiltrados.map((chofer) => (
              <div
                key={chofer.id}
                onClick={() => handleChoferClick(chofer)}
                className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-[#6B46FF]/10 flex items-center justify-center">
                      <span className="text-[#6B46FF] font-semibold text-sm">
                        {chofer.nombre.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {chofer.nombreCompleto}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{chofer.cantidadEnvios} envío{chofer.cantidadEnvios !== 1 ? "s" : ""}</span>
                        {chofer.bateria !== null && chofer.bateria !== undefined && (
                          <span
                            className={
                              chofer.bateria > 50
                                ? "text-green-600"
                                : chofer.bateria > 20
                                ? "text-yellow-600"
                                : "text-red-600"
                            }
                          >
                            {chofer.bateria}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {chofer.latitud && chofer.longitud ? (
                    <div className="w-3 h-3 rounded-full bg-green-500 ml-2"></div>
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-gray-300 ml-2"></div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mapa */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />
      </div>
      </div>
    </div>
  )
}

