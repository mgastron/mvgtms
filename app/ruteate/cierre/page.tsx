"use client"

import { useState, useEffect } from "react"
import { Montserrat } from "next/font/google"
import { ModernHeader } from "@/components/modern-header"
import { Clock, Home, Inbox, Package } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { getApiBaseUrl } from "@/lib/api-config"
import { errorDev } from "@/lib/logger"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

interface ChoferCierre {
  id: number
  nombreCompleto: string
  cantidadEnvios: number
}

export default function CierrePage() {
  const [soloFlex, setSoloFlex] = useState<boolean>(false)
  const [choferes, setChoferes] = useState<ChoferCierre[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [tiempoVisita, setTiempoVisita] = useState("")
  const [visitaCerrada, setVisitaCerrada] = useState(false)
  const [tiempoEntrega, setTiempoEntrega] = useState("")
  const [entregaCerrada, setEntregaCerrada] = useState(false)

  useEffect(() => {
    loadChoferes()
  }, [soloFlex])

  /** Cuenta regresiva hasta una hora de corte en Buenos Aires (AR = UTC-3 → +3 en Date.UTC). */
  useEffect(() => {
    const ZONA_ARGENTINA = "America/Argentina/Buenos_Aires"

    const tickCierre = (ahora: Date, horaCorteAr: number) => {
      const arParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: ZONA_ARGENTINA,
        hour: "numeric",
        hour12: false,
      }).formatToParts(ahora)
      const arDateParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: ZONA_ARGENTINA,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(ahora)

      const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
        parts.find((p) => p.type === type)?.value ?? "0"
      const horaAr = parseInt(getPart(arParts, "hour"), 10)
      const yearAr = parseInt(getPart(arDateParts, "year"), 10)
      const monthAr = parseInt(getPart(arDateParts, "month"), 10) - 1
      const dayAr = parseInt(getPart(arDateParts, "day"), 10)

      if (horaAr >= horaCorteAr) {
        return { cerrado: true, tiempo: "" as const }
      }

      const cierreUtc = new Date(Date.UTC(yearAr, monthAr, dayAr, horaCorteAr + 3, 0, 0))
      const diferenciaMs = cierreUtc.getTime() - ahora.getTime()

      if (diferenciaMs <= 0) {
        return { cerrado: true, tiempo: "" as const }
      }

      const horasRestantes = Math.floor(diferenciaMs / (1000 * 60 * 60))
      const minutosRestantes = Math.floor((diferenciaMs % (1000 * 60 * 60)) / (1000 * 60))
      const segundosRestantes = Math.floor((diferenciaMs % (1000 * 60)) / 1000)
      const tiempo = [horasRestantes, minutosRestantes, segundosRestantes]
        .map((n) => n.toString().padStart(2, "0"))
        .join(":")

      return { cerrado: false, tiempo }
    }

    const calcular = () => {
      const ahora = new Date()
      const v = tickCierre(ahora, 21)
      const e = tickCierre(ahora, 23)
      setVisitaCerrada(v.cerrado)
      setTiempoVisita(v.tiempo)
      setEntregaCerrada(e.cerrado)
      setTiempoEntrega(e.tiempo)
    }

    calcular()
    const interval = setInterval(calcular, 1000)
    return () => clearInterval(interval)
  }, [])

  const loadChoferes = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${getApiBaseUrl()}/ruteate/cierre?soloFlex=${soloFlex}`)
      if (response.ok) {
        const data = await response.json()
        const choferesFiltrados = data
          .filter((chofer: ChoferCierre) => chofer.cantidadEnvios > 0)
          .sort((a: ChoferCierre, b: ChoferCierre) => b.cantidadEnvios - a.cantidadEnvios)
        setChoferes(choferesFiltrados)
      } else {
        setChoferes([])
      }
    } catch (error) {
      errorDev("Error cargando choferes:", error)
      setChoferes([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <ModernHeader />
      <main className={`px-4 pb-6 pt-3 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1100px] space-y-4">
          <div>
            <h1 className="text-[34px] font-semibold tracking-tight text-[#1570ef]">Cierre</h1>
            <p className="mt-1 text-[14px] text-[#5d6578]">
              Resumen de envíos pendientes por chofer — día de hoy (hora Argentina)
            </p>
          </div>

          <div className="space-y-3">
            {visitaCerrada ? (
              <div
                className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm"
                role="status"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90">
                  <Home className="h-5 w-5 text-orange-700" aria-hidden />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-orange-950">Cierre para visitar domicilio</p>
                  <p className="mt-0.5 text-[14px] text-orange-900/85">El plazo de hoy finalizó a las 21:00 (Buenos Aires).</p>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e8d4a8] bg-[#fff8e8] p-5 shadow-sm"
                role="status"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e8d4a8] bg-white">
                  <Home className="h-5 w-5 text-[#a16207]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[#713f12]">
                    Tiempo restante hasta el cierre de Flex para visitar domicilio
                  </p>
                  <p className="mt-1 text-[13px] text-[#854d0e]/90">Corte a las 21:00 (Buenos Aires)</p>
                </div>
                <div className="rounded-xl border border-[#e8d4a8]/90 bg-white px-4 py-2 font-mono text-[22px] font-bold tabular-nums tracking-wide text-[#92400e] shadow-sm">
                  {tiempoVisita}
                </div>
              </div>
            )}

            {entregaCerrada ? (
              <div
                className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm"
                role="status"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80">
                  <Package className="h-5 w-5 text-red-600" aria-hidden />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-red-900">Cierre para entregar pedidos</p>
                  <p className="mt-0.5 text-[14px] text-red-800/90">El plazo de hoy finalizó a las 23:00 (Buenos Aires).</p>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-5 shadow-sm"
                role="status"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white">
                  <Clock className="h-5 w-5 text-amber-700" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-amber-900">
                    Tiempo restante hasta el cierre de Flex para entregar pedidos
                  </p>
                  <p className="mt-1 text-[13px] text-amber-800/90">Corte a las 23:00 (Buenos Aires)</p>
                </div>
                <div className="rounded-xl border border-amber-200/80 bg-white px-4 py-2 font-mono text-[22px] font-bold tabular-nums tracking-wide text-[#b45309] shadow-sm">
                  {tiempoEntrega}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-[18px] font-semibold text-[#4f46ce]">Filtros</h2>
            <div className="flex items-center gap-3">
              <Checkbox
                id="soloFlex"
                checked={soloFlex}
                onCheckedChange={(checked) => setSoloFlex(!!checked)}
                className="h-4 w-4 rounded border-[#cfd6e6] text-[#1459e9] focus:ring-2 focus:ring-[#1570ef]/30 focus:ring-offset-0"
              />
              <label htmlFor="soloFlex" className="cursor-pointer text-[14px] font-medium text-[#1f2433] select-none">
                Solo Flex
              </label>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e6eaf4] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6eaf4] bg-[#fafbff] px-4 py-3 sm:px-5">
              <h3 className="text-[16px] font-semibold text-[#1f2433]">Listado</h3>
              {!loading && (
                <div className="flex items-center gap-2 rounded-full border border-[#e6eaf4] bg-white px-3 py-1 text-[13px] font-medium text-[#5d6578]">
                  <span className="text-[#1570ef]">{choferes.length}</span>
                  <span>{choferes.length === 1 ? "chofer" : "choferes"}</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e6eaf4] bg-[#f7f8fc]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Chofer
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Envíos restantes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f8]">
                  {loading ? (
                    <tr>
                      <td colSpan={2} className="px-5 py-14 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div
                            className="h-9 w-9 animate-spin rounded-full border-2 border-[#e6eaf4] border-t-[#1570ef]"
                            aria-hidden
                          />
                          <p className="text-[14px] font-medium text-[#5d6578]">Cargando…</p>
                        </div>
                      </td>
                    </tr>
                  ) : choferes.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-5 py-14 text-center">
                        <div className="mx-auto flex max-w-md flex-col items-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff]">
                            <Inbox className="h-6 w-6 text-[#1570ef]" aria-hidden />
                          </div>
                          <p className="text-[14px] font-semibold text-[#1f2433]">
                            No hay choferes con envíos pendientes
                          </p>
                          <p className="mt-2 text-[13px] text-[#8890a8]">Para el día de hoy, con los filtros actuales</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    choferes.map((chofer, index) => (
                      <tr
                        key={chofer.id}
                        className={`transition-colors hover:bg-[#f7faff] ${index % 2 === 0 ? "bg-white" : "bg-[#fafbff]"}`}
                      >
                        <td className="px-4 py-3 sm:px-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[13px] font-semibold text-[#1459e9]">
                              {chofer.nombreCompleto.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[14px] font-medium text-[#1f2433]">{chofer.nombreCompleto}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 sm:px-5">
                          <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-[#eef4ff] px-2.5 py-1 text-[14px] font-semibold tabular-nums text-[#1459e9]">
                            {chofer.cantidadEnvios}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
