"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiBaseUrl } from "@/lib/api-config"
import { cn } from "@/lib/utils"
import { Montserrat } from "next/font/google"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

type DashboardData = {
  fechaDesde: string
  fechaHasta: string
  kpis: {
    total: number
    entregados: number
    enCamino: number
    aRetirar: number
    retirados: number
    nadie: number
    rechazados: number
    cancelados: number
    sinChofer: number
    sinGeocode: number
    cambiosDireccion: number
    tasaExito: number
    codEsperado: number
    costoEnvios: number
  }
  comparacion: {
    periodoAnteriorDesde: string
    periodoAnteriorHasta: string
    totalAnterior: number
    tasaExitoAnterior: number
    deltaTotalPct: number | null
    deltaTasaExitoPp: number | null
  }
  porEstado: { nombre: string; cantidad: number }[]
  porZona: { nombre: string; total: number; entregados: number; fallidos: number; tasaExito: number }[]
  porChofer: {
    id: number
    nombre: string
    total: number
    entregados: number
    enCamino: number
    nadie: number
    rechazados: number
    cambiosDireccion: number
    tasaExito: number
    codEsperado: number
  }[]
  porDia: { fecha: string; total: number; entregados: number; fallidos: number; enCamino: number }[]
  porOrigen: { nombre: string; cantidad: number }[]
  alertas: { severidad: string; codigo: string; titulo: string; detalle: string; cantidad: number }[]
}

type ChoferOpt = { id: number; nombre: string; apellido?: string }

const ESTADO_COLORS: Record<string, string> = {
  Entregado: "#16a34a",
  "En camino al destinatario": "#2563eb",
  "A retirar": "#64748b",
  Retirado: "#7c3aed",
  Nadie: "#ea580c",
  "Rechazado por el comprador": "#dc2626",
  Cancelado: "#94a3b8",
  "Reprogramado por comprador": "#ca8a04",
}

const PIE_FALLBACK = ["#1570ef", "#0ea5e9", "#6366f1", "#8b5cf6", "#14b8a6", "#f59e0b", "#ef4444", "#64748b"]

function todayIso() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function daysAgoIso(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function formatDelta(v: number | null | undefined, suffix = "%") {
  if (v == null || Number.isNaN(v)) return "—"
  const sign = v > 0 ? "+" : ""
  return `${sign}${v.toFixed(1)}${suffix}`
}

function fmtDiaLabel(fecha: string) {
  const [, m, d] = fecha.split("-")
  return `${d}/${m}`
}

export default function DashboardPage() {
  const router = useRouter()
  const [fechaDesde, setFechaDesde] = useState(daysAgoIso(6))
  const [fechaHasta, setFechaHasta] = useState(todayIso())
  const [choferId, setChoferId] = useState<string>("todos")
  const [zona, setZona] = useState<string>("todas")
  const [choferes, setChoferes] = useState<ChoferOpt[]>([])
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const userProfile = sessionStorage.getItem("userProfile")
    if (!isAuthenticated) {
      router.push("/")
      return
    }
    if (userProfile === "Chofer") {
      router.push("/repartidor")
      return
    }
    if (userProfile === "Cliente") {
      router.push("/pedidos")
    }
  }, [router])

  useEffect(() => {
    const loadChoferes = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/usuarios/choferes`)
        if (res.ok) {
          const list = await res.json()
          setChoferes(Array.isArray(list) ? list : [])
        }
      } catch {
        /* ignore */
      }
    }
    loadChoferes()
  }, [])

  const loadDashboard = useCallback(async () => {
    if (!fechaDesde || !fechaHasta) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ desde: fechaDesde, hasta: fechaHasta })
      if (choferId !== "todos") params.set("choferId", choferId)
      if (zona !== "todas") params.set("zona", zona)
      const res = await fetch(`${getApiBaseUrl()}/dashboard?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      setData(await res.json())
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el dashboard")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta, choferId, zona])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const zonasOpts = useMemo(() => {
    const fromData = data?.porZona?.map((z) => z.nombre) ?? []
    const base = ["CABA", "Zona 1", "Zona 2", "Zona 3", "Sin Zona"]
    return Array.from(new Set([...base, ...fromData]))
  }, [data])

  const aplicarPreset = (preset: "hoy" | "7" | "30" | "mes") => {
    const hasta = todayIso()
    if (preset === "hoy") {
      setFechaDesde(hasta)
      setFechaHasta(hasta)
    } else if (preset === "7") {
      setFechaDesde(daysAgoIso(6))
      setFechaHasta(hasta)
    } else if (preset === "30") {
      setFechaDesde(daysAgoIso(29))
      setFechaHasta(hasta)
    } else {
      const d = new Date()
      const first = new Date(d.getFullYear(), d.getMonth(), 1)
      setFechaDesde(first.toISOString().slice(0, 10))
      setFechaHasta(hasta)
    }
  }

  const k = data?.kpis
  const cmp = data?.comparacion

  return (
    <div className={cn("min-h-screen bg-[#f7f8fc]", montserrat.className)}>
      <ModernHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#1570ef]">
              <LayoutDashboard className="h-6 w-6" />
              <span className="text-sm font-semibold uppercase tracking-wide">Administración</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-[#1f2433] sm:text-3xl">Dashboard operativo</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#6b7289]">
              Volumen, éxito de entrega, zonas, choferes y alertas según fecha de carga del pedido.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["hoy", "Hoy"],
              ["7", "7 días"],
              ["30", "30 días"],
              ["mes", "Este mes"],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                className="h-9 rounded-xl border-[#e6eaf4] bg-white text-xs font-semibold text-[#4d5571]"
                onClick={() => aplicarPreset(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-6 grid gap-3 rounded-2xl border border-[#e6eaf4] bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="text-xs font-medium text-[#6b7289]">Desde</label>
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="mt-1 h-10 rounded-xl border-[#e6eaf4]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6b7289]">Hasta</label>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="mt-1 h-10 rounded-xl border-[#e6eaf4]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6b7289]">Chofer</label>
            <Select value={choferId} onValueChange={setChoferId}>
              <SelectTrigger className="mt-1 h-10 rounded-xl border-[#e6eaf4]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {choferes.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {[c.nombre, c.apellido].filter(Boolean).join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#6b7289]">Zona</label>
            <Select value={zona} onValueChange={setZona}>
              <SelectTrigger className="mt-1 h-10 rounded-xl border-[#e6eaf4]">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {zonasOpts.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className="h-10 w-full rounded-xl bg-[#1570ef] text-sm font-semibold hover:bg-[#1260d0]"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-2xl border border-[#e6eaf4] bg-white py-20 text-center text-sm text-[#6b7289]">
            Cargando métricas…
          </div>
        ) : data && k ? (
          <>
            {/* KPIs */}
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              <KpiCard
                title="Pedidos cargados"
                value={String(k.total)}
                hint={
                  cmp?.deltaTotalPct != null
                    ? `${formatDelta(cmp.deltaTotalPct)} vs período anterior`
                    : "Sin base de comparación"
                }
                delta={cmp?.deltaTotalPct}
              />
              <KpiCard
                title="Tasa de éxito"
                value={`${k.tasaExito.toFixed(1)}%`}
                hint="Entregados / (entregados + nadie + rechazados)"
                delta={cmp?.deltaTasaExitoPp}
                deltaSuffix=" pp"
              />
              <KpiCard title="En camino" value={String(k.enCamino)} hint={`${k.aRetirar} a retirar · ${k.retirados} retirados`} />
              <KpiCard
                title="Excepciones"
                value={String(k.nadie + k.rechazados)}
                hint={`${k.nadie} nadie · ${k.rechazados} rechazados`}
                accent="warn"
              />
              <KpiCard title="Entregados" value={String(k.entregados)} hint={`${k.cancelados} cancelados`} accent="ok" />
              <KpiCard title="COD esperado" value={formatMoney(k.codEsperado)} hint="Suma total a cobrar del período" />
              <KpiCard title="Costo envíos" value={formatMoney(k.costoEnvios)} hint="Según lista de precios" />
              <KpiCard
                title="Alertas operativas"
                value={String(data.alertas.length)}
                hint={`${k.sinChofer} sin chofer · ${k.sinGeocode} sin geo · ${k.cambiosDireccion} cambios dir.`}
                accent={data.alertas.some((a) => a.severidad === "critical") ? "crit" : "warn"}
              />
            </div>

            {/* Alertas */}
            {data.alertas.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#4d5571]">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Alertas
                </h2>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {data.alertas.map((a) => (
                    <div
                      key={`${a.codigo}-${a.titulo}`}
                      className={cn(
                        "rounded-xl border px-4 py-3",
                        a.severidad === "critical" && "border-red-200 bg-red-50",
                        a.severidad === "warning" && "border-amber-200 bg-amber-50",
                        a.severidad === "info" && "border-sky-200 bg-sky-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#1f2433]">{a.titulo}</p>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-[#4d5571]">
                          {a.cantidad}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#4d5571]">{a.detalle}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Charts row */}
            <div className="mb-6 grid gap-4 lg:grid-cols-5">
              <CardPanel title="Evolución diaria" className="lg:col-span-3">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.porDia.map((d) => ({ ...d, label: fmtDiaLabel(d.fecha) }))}>
                      <defs>
                        <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1570ef" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#1570ef" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef1f8" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7289" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7289" }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, borderColor: "#e6eaf4", fontSize: 12 }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fecha ?? ""}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="total" name="Cargados" stroke="#1570ef" fill="url(#gTotal)" strokeWidth={2} />
                      <Area type="monotone" dataKey="entregados" name="Entregados" stroke="#16a34a" fill="transparent" strokeWidth={2} />
                      <Area type="monotone" dataKey="fallidos" name="Fallidos" stroke="#ea580c" fill="transparent" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardPanel>

              <CardPanel title="Por estado" className="lg:col-span-2">
                <div className="h-72">
                  {data.porEstado.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.porEstado}
                          dataKey="cantidad"
                          nameKey="nombre"
                          cx="50%"
                          cy="48%"
                          innerRadius={52}
                          outerRadius={88}
                          paddingAngle={2}
                        >
                          {data.porEstado.map((entry, i) => (
                            <Cell
                              key={entry.nombre}
                              fill={ESTADO_COLORS[entry.nombre] || PIE_FALLBACK[i % PIE_FALLBACK.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e6eaf4", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardPanel>
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <CardPanel title="Por zona">
                <div className="h-72">
                  {data.porZona.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.porZona.map((z) => ({
                          ...z,
                          otros: Math.max(0, z.total - z.entregados - z.fallidos),
                        }))}
                        layout="vertical"
                        margin={{ left: 8, right: 12 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f8" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7289" }} />
                        <YAxis type="category" dataKey="nombre" width={72} tick={{ fontSize: 11, fill: "#4d5571" }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, borderColor: "#e6eaf4", fontSize: 12 }}
                          labelFormatter={(label, payload) => {
                            const row = payload?.[0]?.payload
                            return row ? `${label} · éxito ${row.tasaExito}%` : String(label)
                          }}
                        />
                        <Bar dataKey="entregados" name="Entregados" stackId="a" fill="#16a34a" />
                        <Bar dataKey="fallidos" name="Fallidos" stackId="a" fill="#ea580c" />
                        <Bar dataKey="otros" name="Otros" stackId="a" fill="#94a3b8" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardPanel>

              <CardPanel title="Por origen">
                <div className="h-72">
                  {data.porOrigen.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.porOrigen}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f8" />
                        <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: "#6b7289" }} interval={0} angle={-15} textAnchor="end" height={50} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7289" }} />
                        <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e6eaf4", fontSize: 12 }} />
                        <Bar dataKey="cantidad" name="Pedidos" fill="#6366f1" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardPanel>
            </div>

            {/* Choferes table */}
            <CardPanel title="Rendimiento por chofer" className="mb-8">
              {data.porChofer.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#6b7289]">No hay envíos adjudicados en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#e6eaf4] text-xs uppercase tracking-wide text-[#6b7289]">
                        <th className="px-3 py-2 font-semibold">Chofer</th>
                        <th className="px-3 py-2 font-semibold text-right">Total</th>
                        <th className="px-3 py-2 font-semibold text-right">Entreg.</th>
                        <th className="px-3 py-2 font-semibold text-right">En camino</th>
                        <th className="px-3 py-2 font-semibold text-right">Nadie</th>
                        <th className="px-3 py-2 font-semibold text-right">Rechaz.</th>
                        <th className="px-3 py-2 font-semibold text-right">Éxito</th>
                        <th className="px-3 py-2 font-semibold text-right">Cambios dir.</th>
                        <th className="px-3 py-2 font-semibold text-right">COD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.porChofer.map((c) => (
                        <tr key={c.id} className="border-b border-[#f0f2f8] hover:bg-[#f8fafc]">
                          <td className="px-3 py-2.5 font-medium text-[#1f2433]">{c.nombre}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{c.total}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{c.entregados}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-blue-700">{c.enCamino}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-orange-700">{c.nadie}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-red-700">{c.rechazados}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span
                              className={cn(
                                "inline-flex min-w-[3.5rem] justify-end rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                                c.tasaExito >= 80 && "bg-green-100 text-green-800",
                                c.tasaExito >= 60 && c.tasaExito < 80 && "bg-amber-100 text-amber-800",
                                c.tasaExito < 60 && "bg-red-100 text-red-800"
                              )}
                            >
                              {c.tasaExito.toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {c.cambiosDireccion > 0 ? (
                              <span className="font-semibold text-violet-700">{c.cambiosDireccion}</span>
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-[#4d5571]">
                            {formatMoney(c.codEsperado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {cmp && (
                <p className="mt-4 border-t border-[#eef1f8] pt-3 text-xs text-[#6b7289]">
                  Comparación vs {cmp.periodoAnteriorDesde} → {cmp.periodoAnteriorHasta}:{" "}
                  {cmp.totalAnterior} pedidos · tasa {cmp.tasaExitoAnterior.toFixed(1)}%
                </p>
              )}
            </CardPanel>
          </>
        ) : null}
      </main>
    </div>
  )
}

function KpiCard({
  title,
  value,
  hint,
  delta,
  deltaSuffix = "%",
  accent,
}: {
  title: string
  value: string
  hint?: string
  delta?: number | null
  deltaSuffix?: string
  accent?: "ok" | "warn" | "crit"
}) {
  const up = delta != null && delta > 0
  const down = delta != null && delta < 0
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm",
        accent === "ok" && "border-green-100",
        accent === "warn" && "border-amber-100",
        accent === "crit" && "border-red-100",
        !accent && "border-[#e6eaf4]"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7289]">{title}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold tabular-nums text-[#1f2433]">{value}</p>
        {delta != null && !Number.isNaN(delta) && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              up && "bg-green-50 text-green-700",
              down && "bg-red-50 text-red-700",
              !up && !down && "bg-slate-50 text-slate-600"
            )}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : down ? <ArrowDownRight className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {formatDelta(delta, deltaSuffix)}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs leading-snug text-[#8b93a7]">{hint}</p>}
    </div>
  )
}

function CardPanel({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-2xl border border-[#e6eaf4] bg-white p-4 shadow-sm", className)}>
      <h2 className="mb-3 text-sm font-bold text-[#1f2433]">{title}</h2>
      {children}
    </section>
  )
}

function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-sm text-[#8b93a7]">Sin datos en el período</div>
}
