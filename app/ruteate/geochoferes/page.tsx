"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Montserrat } from "next/font/google"
import { Search, X } from "lucide-react"
import { ModernHeader } from "@/components/modern-header"
import { Input } from "@/components/ui/input"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev, errorDev } from "@/lib/logger"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const searchInputClass =
  "h-10 rounded-xl border border-[#e6eaf4] bg-white pl-9 pr-8 text-[14px] font-medium text-[#1f2433] shadow-sm placeholder:font-normal placeholder:text-[#8890a8] focus-visible:border-[#1570ef] focus-visible:ring-2 focus-visible:ring-[#1570ef]/20 focus-visible:ring-offset-0"

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
    <div className="flex h-screen flex-col bg-[#f7f8fc]">
      <ModernHeader />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`flex w-80 shrink-0 flex-col border-r border-[#e6eaf4] bg-white shadow-sm ${montserrat.className}`}
        >
          <div className="border-b border-[#e6eaf4] px-4 py-4">
            <h1 className="mb-3 text-[18px] font-semibold tracking-tight text-[#1570ef]">Ubicación</h1>

            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8890a8]"
                  aria-hidden
                />
                <Input
                  type="text"
                  placeholder="Ubicar chofer"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={searchInputClass}
                  aria-label="Buscar chofer"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8890a8] hover:bg-[#f7f8fc] hover:text-[#1f2433]"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div
                className="flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-xl border border-[#e6eaf4] bg-[#fafbff] px-2 text-[13px] font-semibold tabular-nums text-[#1459e9]"
                title="Segundos hasta la próxima actualización"
              >
                {countdown}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-[14px] font-medium text-[#5d6578]">Cargando choferes…</div>
            ) : choferesFiltrados.length === 0 ? (
              <div className="px-4 py-8 text-center text-[14px] text-[#5d6578]">
                {searchTerm ? "No se encontraron choferes" : "No hay choferes con envíos asignados"}
              </div>
            ) : (
              <ul className="divide-y divide-[#eef1f8]">
                {choferesFiltrados.map((chofer) => (
                  <li key={chofer.id}>
                    <button
                      type="button"
                      onClick={() => handleChoferClick(chofer)}
                      className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#f7faff]"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4ff]">
                          <span className="text-[13px] font-semibold text-[#1459e9]">
                            {chofer.nombre.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-semibold text-[#1f2433]">
                            {chofer.nombreCompleto}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[#5d6578]">
                            <span>
                              {chofer.cantidadEnvios} envío{chofer.cantidadEnvios !== 1 ? "s" : ""}
                            </span>
                            {chofer.bateria !== null && chofer.bateria !== undefined ? (
                              <span
                                className={
                                  chofer.bateria > 50
                                    ? "font-medium text-emerald-600"
                                    : chofer.bateria > 20
                                      ? "font-medium text-amber-600"
                                      : "font-medium text-rose-600"
                                }
                              >
                                {chofer.bateria}%
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          chofer.latitud && chofer.longitud ? "bg-emerald-500" : "bg-[#cfd6e6]"
                        }`}
                        title={chofer.latitud && chofer.longitud ? "Ubicación disponible" : "Sin ubicación"}
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className="relative min-h-0 min-w-0 flex-1">
          <div ref={mapRef} className="h-full w-full" />
        </div>
      </div>
    </div>
  )
}

