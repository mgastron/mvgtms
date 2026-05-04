"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  User,
  Clock,
  Truck,
} from "lucide-react"
import { Montserrat } from "next/font/google"
import { getApiBaseUrl } from "@/lib/api-config"
import { logDev, warnDev, errorDev } from "@/lib/logger"
import { cn } from "@/lib/utils"
import { ModernHeader } from "@/components/modern-header"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

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

const fieldLabel = "text-[12px] font-semibold uppercase tracking-wide text-[#5d6578]"
const cardClass = "rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm sm:p-6"

function TrackingPublicHeader() {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-50 w-full bg-[#f7f8fc]">
      <div className={`mx-auto w-full max-w-[1700px] px-3 pt-3 ${montserrat.className}`}>
        <div className="flex h-[64px] items-center justify-between gap-4 rounded-2xl bg-[#1459e9] px-5 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="shrink-0 transition-opacity hover:opacity-90"
            aria-label="Ir al inicio"
          >
            <img src="/logos/nexo-logo-white.png" alt="Nexo" className="h-auto w-[96px] sm:w-[102px]" />
          </button>
          <p className="min-w-0 truncate text-right text-[13px] font-medium text-white/95 sm:text-[14px]">
            Seguimiento de envío
          </p>
        </div>
      </div>
    </header>
  )
}

function estadoBadgeClass(estado: string): string {
  const e = estado.toLowerCase()
  if (e.includes("entregado")) return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
  if (e.includes("cancel") || e.includes("rechazado")) return "bg-red-50 text-red-800 ring-1 ring-red-200/80"
  if (e.includes("camino") || e.includes("retirado")) return "bg-sky-50 text-sky-900 ring-1 ring-sky-200/80"
  if (e.includes("retirar") || e.includes("reprogramado")) return "bg-[#eef4ff] text-[#1459e9] ring-1 ring-[#dbeafe]"
  return "bg-[#f4f6fb] text-[#4d5571] ring-1 ring-[#e6eaf4]"
}

export default function TrackingPage() {
  const params = useParams()
  const token = params?.token as string
  const [envio, setEnvio] = useState<Envio | null>(null)
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Evita mostrar “sin geolocalización” antes de que termine el geocoder */
  const [geoLookupStatus, setGeoLookupStatus] = useState<"idle" | "pending" | "ok" | "fail">("idle")
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const checkRefIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const checkScriptIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [useAppHeader, setUseAppHeader] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setUseAppHeader(sessionStorage.getItem("isAuthenticated") === "true")
  }, [])

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

        try {
          const historialResponse = await fetch(`${apiBaseUrl}/envios/${envioData.id}/historial`)
          if (historialResponse.ok) {
            const historialData = await historialResponse.json()
            const historialFormateado: HistorialItem[] = historialData
              .map((item: { id: number; estado: string; fecha: string; quien?: string }) => {
                const fecha = new Date(item.fecha)
                return {
                  id: item.id,
                  estado: item.estado,
                  fecha: fecha.toLocaleDateString("es-AR"),
                  horaEstimada: fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
                  quien: item.quien,
                  fechaTimestamp: fecha.getTime(),
                }
              })
              .sort((a: { fechaTimestamp: number }, b: { fechaTimestamp: number }) => a.fechaTimestamp - b.fechaTimestamp)
              .map(({ fechaTimestamp: _t, ...rest }: { fechaTimestamp: number } & HistorialItem) => rest)

            const estadosEnHistorial = new Set(historialFormateado.map((h) => h.estado))
            if (!estadosEnHistorial.has("A retirar") && envioData.fechaLlegue) {
              const fechaLlegue = new Date(envioData.fechaLlegue)
              historialFormateado.unshift({
                id: -1,
                estado: "A retirar",
                fecha: fechaLlegue.toLocaleDateString("es-AR"),
                horaEstimada: fechaLlegue.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
                quien: "Sistema",
              })
            }

            const historialFiltrado: HistorialItem[] = []
            let ultimoEstado: string | null = null
            for (const item of historialFormateado) {
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

  useEffect(() => {
    logDev("[TRACKING MAP] useEffect ejecutado", {
      tieneEnvio: !!envio,
      tieneMapRef: !!mapRef.current,
      envioData: envio
        ? {
            direccion: envio.direccion,
            localidad: envio.localidad,
            codigoPostal: envio.codigoPostal,
          }
        : null,
    })

    if (!envio) {
      logDev("[TRACKING MAP] No hay envío, saliendo")
      return
    }

    setGeoLookupStatus("pending")

    if (!mapRef.current) {
      checkRefIntervalRef.current = setInterval(() => {
        if (mapRef.current) {
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
          tieneMapRef: !!mapRef.current,
        })
        return
      }

      if (!window.google) {
        logDev("[TRACKING MAP] Google Maps API no está cargada")
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
        if (existingScript) {
          checkScriptIntervalRef.current = setInterval(() => {
            if (window.google && window.google.maps) {
              if (checkScriptIntervalRef.current) clearInterval(checkScriptIntervalRef.current)
              initializeMap()
            }
          }, 100)
        } else {
          const script = document.createElement("script")
          script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || "YOUR_API_KEY"}&libraries=places,geometry`
          script.async = true
          script.defer = true
          script.id = "google-maps-script-tracking"
          script.onload = () => initializeMap()
          script.onerror = () => {
            errorDev("[TRACKING MAP] Error al cargar Google Maps API")
            setGeoLookupStatus("fail")
          }
          document.head.appendChild(script)
        }
      } else {
        initializeMap()
      }

      function initializeMap() {
        if (!mapRef.current || !envio) {
          warnDev("[TRACKING MAP] initializeMap: Condición no cumplida", {
            tieneMapRef: !!mapRef.current,
            tieneEnvio: !!envio,
          })
          return
        }

        const geocoder = new google.maps.Geocoder()
        const addressParts = [envio.direccion, envio.localidad, envio.codigoPostal, "Argentina"]
          .map((p) => (p || "").toString().trim())
          .filter(Boolean)

        const address = addressParts.join(", ")

        geocoder.geocode({ address }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            const location = results[0].geometry.location
            setGeoLookupStatus("ok")

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
              title: address,
            })

            markerRef.current = marker
          } else {
            warnDev("[TRACKING MAP] No se pudo geocodificar la dirección", { status })
            setGeoLookupStatus("fail")
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
    }

    return () => {
      logDev("[TRACKING MAP] Cleanup ejecutado")
      if (checkRefIntervalRef.current) clearInterval(checkRefIntervalRef.current)
      if (checkScriptIntervalRef.current) clearInterval(checkScriptIntervalRef.current)
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      setGeoLookupStatus("idle")
    }
  }, [envio])

  if (loading) {
    return (
      <div
        className={cn("flex min-h-screen flex-col bg-[#f7f8fc]", montserrat.className)}
        suppressHydrationWarning
      >
        <TrackingPublicHeader />
        <div className="flex flex-1 items-center justify-center px-4 py-16" suppressHydrationWarning>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#e6eaf4] bg-white px-10 py-12 shadow-sm">
            <Loader2 className="h-10 w-10 animate-spin text-[#1459e9]" aria-hidden />
            <p className="text-center text-[15px] font-medium text-[#4d5571]">Cargando información del envío…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !envio) {
    return (
      <div className={cn("min-h-screen bg-[#f7f8fc]", montserrat.className)} suppressHydrationWarning>
        <TrackingPublicHeader />
        <main className="mx-auto max-w-lg px-4 py-16">
          <div className={cn(cardClass, "text-center")}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fef2f2] text-[#dc2626]">
              <AlertCircle className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="text-[22px] font-semibold text-[#1f2433]">Envío no encontrado</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#5d6578]">
              El enlace no es válido o el envío ya no está disponible en el sistema.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#1459e9] px-6 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[#114bce]"
            >
              Volver al inicio
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const estadoActual = envio.estado || "A retirar"

  return (
    <div className={cn("min-h-screen bg-[#f7f8fc]", montserrat.className)} suppressHydrationWarning>
      {useAppHeader ? <ModernHeader /> : <TrackingPublicHeader />}

      <main className="mx-auto w-full max-w-[1700px] px-4 pb-10 pt-4">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[30px] font-semibold tracking-tight text-[#1570ef] sm:text-[34px]">Seguimiento de envío</h1>
            <p className="mt-1 text-[14px] text-[#5d6578]">
              {envio.cliente ? (
                <>
                  <span className="font-medium text-[#1f2433]">{envio.cliente}</span>
                  <span className="text-[#8890a8]"> · </span>
                </>
              ) : null}
              <span className="font-mono text-[13px] font-semibold text-[#1f2433]">{envio.tracking}</span>
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center rounded-full px-4 py-1.5 text-[13px] font-semibold",
              estadoBadgeClass(estadoActual)
            )}
          >
            {estadoActual}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
          {/* Entrega */}
          <div className="space-y-5 lg:col-span-4">
            <section className={cardClass}>
              <h2 className="mb-4 flex items-center gap-2 text-[18px] font-semibold text-[#1570ef]">
                <Truck className="h-5 w-5 shrink-0 text-[#1459e9]" aria-hidden />
                Entrega a domicilio
              </h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#8890a8]" aria-hidden />
                  <div>
                    <p className={fieldLabel}>Dirección</p>
                    <p className="mt-1 text-[14px] font-medium leading-snug text-[#1f2433]">{envio.direccion}</p>
                    {(envio.localidad || envio.codigoPostal) && (
                      <p className="mt-1 text-[13px] text-[#5d6578]">
                        {[envio.localidad, envio.codigoPostal ? `CP ${envio.codigoPostal}` : ""].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 border-t border-[#eef1f8] pt-4">
                  <User className="mt-0.5 h-5 w-5 shrink-0 text-[#8890a8]" aria-hidden />
                  <div>
                    <p className={fieldLabel}>Destinatario</p>
                    <p className="mt-1 text-[14px] font-semibold text-[#1f2433]">{envio.nombreDestinatario}</p>
                  </div>
                </div>
                {envio.telefono ? (
                  <div className="flex gap-3 border-t border-[#eef1f8] pt-4">
                    <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[#8890a8]" aria-hidden />
                    <div>
                      <p className={fieldLabel}>Teléfono</p>
                      <p className="mt-1 text-[14px] font-medium text-[#1f2433]">{envio.telefono}</p>
                    </div>
                  </div>
                ) : null}
                {envio.email ? (
                  <div className="flex gap-3 border-t border-[#eef1f8] pt-4">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#8890a8]" aria-hidden />
                    <div>
                      <p className={fieldLabel}>Correo</p>
                      <p className="mt-1 break-all text-[14px] font-medium text-[#1f2433]">{envio.email}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className={cardClass}>
              <h2 className="mb-4 flex items-center gap-2 text-[18px] font-semibold text-[#1570ef]">
                <Package className="h-5 w-5 shrink-0 text-[#1459e9]" aria-hidden />
                Datos útiles
              </h2>
              <ul className="space-y-4 text-[14px] leading-relaxed text-[#4d5571]">
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1459e9]" aria-hidden />
                  <span>
                    <strong className="font-semibold text-[#1f2433]">Recepción:</strong> puede recibirlo cualquier
                    persona mayor de 18 años.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1459e9]" aria-hidden />
                  <span>
                    <strong className="font-semibold text-[#1f2433]">Paquete dañado:</strong> si el embalaje está
                    visiblemente deteriorado, rechazá la entrega completa.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1459e9]" aria-hidden />
                  <span>
                    <strong className="font-semibold text-[#1f2433]">Sin costo extra:</strong> no debés pagar al
                    recibir el paquete. Si el transportista pide dinero, no lo aceptes.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1459e9]" aria-hidden />
                  <span>
                    <strong className="font-semibold text-[#1f2433]">Reintentos:</strong> si no hay nadie en el
                    domicilio, se intentará entregar nuevamente según la política del transportista.
                  </span>
                </li>
              </ul>
            </section>
          </div>

          {/* Timeline */}
          <section className={cn(cardClass, "lg:col-span-4")}>
            <h2 className="mb-1 text-[18px] font-semibold text-[#1570ef]">Historial de estados</h2>
            <p className="mb-6 text-[13px] text-[#8890a8]">Último movimiento destacado</p>

            <div className="space-y-0">
              {historial.length > 0 ? (
                historial.map((item, index) => {
                  const isLast = index === historial.length - 1
                  return (
                    <div key={item.id} className="flex gap-4">
                      <div className="flex flex-col items-center pt-1">
                        <span
                          className={cn(
                            "h-3 w-3 shrink-0 rounded-full ring-4",
                            isLast ? "bg-[#1459e9] ring-[#dbeafe]" : "bg-[#c5cad8] ring-[#eef1f8]"
                          )}
                          aria-hidden
                        />
                        {index < historial.length - 1 ? (
                          <span className="my-1 min-h-[28px] w-px flex-1 bg-[#e6eaf4]" aria-hidden />
                        ) : null}
                      </div>
                      <div className={cn("min-w-0 flex-1 pb-6", index === historial.length - 1 && "pb-0")}>
                        <p className={cn("text-[15px] font-semibold", isLast ? "text-[#1f2433]" : "text-[#5d6578]")}>
                          {item.estado}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-[#8890a8]">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {item.fecha}
                          {item.horaEstimada ? ` · ${item.horaEstimada}` : ""}
                          {item.quien ? (
                            <span className="text-[12px] text-[#b0b6c4]">· {item.quien}</span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center pt-1">
                    <span className="h-3 w-3 shrink-0 rounded-full bg-[#1459e9] ring-4 ring-[#dbeafe]" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-[#1f2433]">{estadoActual}</p>
                    <p className="mt-1 flex items-center gap-2 text-[13px] text-[#8890a8]">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {envio.fechaLlegue
                        ? `${new Date(envio.fechaLlegue).toLocaleDateString("es-AR")} · ${new Date(envio.fechaLlegue).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
                        : `${new Date().toLocaleDateString("es-AR")} · ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Mapa */}
          <section className={cn(cardClass, "lg:col-span-4")}>
            <h2 className="mb-4 text-[18px] font-semibold text-[#1570ef]">Ubicación en mapa</h2>
            <div className="overflow-hidden rounded-xl border border-[#e6eaf4] bg-[#fafbff]" style={{ height: "380px" }}>
              <div ref={mapRef} className="h-full w-full min-h-[280px]" />
            </div>
            {geoLookupStatus === "fail" && envio.direccion ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-900">
                No pudimos ubicar la dirección exacta en el mapa. Mostramos una vista aproximada.
              </div>
            ) : null}
            <div className="mt-5 space-y-3 border-t border-[#eef1f8] pt-5 text-[14px] text-[#4d5571]">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#5d6578]">Resumen</p>
              <p>
                <span className="font-semibold text-[#1f2433]">Dirección: </span>
                {envio.direccion}
                {envio.localidad ? `, ${envio.localidad}` : ""}
                {envio.codigoPostal ? ` (CP ${envio.codigoPostal})` : ""}
              </p>
              <p>
                <span className="font-semibold text-[#1f2433]">Recibe: </span>
                {envio.nombreDestinatario}
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
