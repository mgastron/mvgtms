"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { montserrat } from "@/lib/fonts"
import { Search, X } from "lucide-react"
import { ModernHeader } from "@/components/modern-header"
import { Input } from "@/components/ui/input"
import { getApiBaseUrl } from "@/lib/api-config"
import { errorDev } from "@/lib/logger"
import { OsmMap } from "@/components/osm-map"
import { getTenantDepot, type TenantDepot } from "@/lib/tenant"


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

export default function GeochoferesPage() {
  const router = useRouter()
  const mapApiRef = useRef<{ setView: (lat: number, lng: number, zoom?: number) => void } | null>(null)
  const [deposito, setDeposito] = useState<TenantDepot>(() => getTenantDepot("nexo"))
  const [choferes, setChoferes] = useState<ChoferConUbicacion[]>([])
  const [choferesFiltrados, setChoferesFiltrados] = useState<ChoferConUbicacion[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [countdown, setCountdown] = useState(30)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setDeposito(getTenantDepot())
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    if (!isAuthenticated) {
      router.push("/")
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

  useEffect(() => {
    loadChoferes()
  }, [])

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
    if (chofer.latitud && chofer.longitud) {
      mapApiRef.current?.setView(chofer.latitud, chofer.longitud, 15)
    }
  }

  const mapMarkers = [
    {
      lat: deposito.lat,
      lng: deposito.lng,
      title: "Depósito",
      popup: deposito.address,
      color: "#dc2626",
    },
    ...choferesFiltrados
      .filter((c) => c.latitud != null && c.longitud != null)
      .map((c) => ({
        lat: c.latitud as number,
        lng: c.longitud as number,
        title: c.nombreCompleto,
        popup: `${c.cantidadEnvios} pedidos en ruta`,
        color: "#1570ef",
      })),
  ]

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fc] md:h-screen">
      <ModernHeader />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside
          className={`flex max-h-[42vh] w-full shrink-0 flex-col border-b border-[#e6eaf4] bg-white shadow-sm md:max-h-none md:w-80 md:border-b-0 md:border-r ${montserrat.className}`}
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
                  placeholder="Ubicar repartidor"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={searchInputClass}
                  aria-label="Buscar repartidor"
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
              <div className="px-4 py-8 text-center text-[14px] font-medium text-[#5d6578]">Cargando repartidores…</div>
            ) : choferesFiltrados.length === 0 ? (
              <div className="px-4 py-8 text-center text-[14px] text-[#5d6578]">
                {searchTerm ? "No se encontraron repartidores" : "Ningún chofer con ubicación reciente"}
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
                              {chofer.cantidadEnvios} en ruta
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
                        className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
                        title="Ubicación disponible"
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className="relative min-h-[48vh] min-w-0 flex-1 md:min-h-0">
          <OsmMap
            className="h-full min-h-[48vh] w-full md:min-h-0"
            center={{ lat: deposito.lat, lng: deposito.lng }}
            zoom={12}
            markers={mapMarkers}
            mapRefOut={(api) => {
              mapApiRef.current = api
            }}
          />
        </div>
      </div>
    </div>
  )
}

