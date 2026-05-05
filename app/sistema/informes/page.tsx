"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileBarChart, Download, Search } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"
import { cn } from "@/lib/utils"
import { Montserrat } from "next/font/google"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const fieldLabelClass = "block text-[14px] font-medium text-[#4d5571]"
const inputClass =
  "mt-1.5 h-10 w-full rounded-xl border border-[#e6eaf4] bg-white text-[14px] font-medium text-[#1f2433] shadow-sm focus-visible:border-[#1570ef] focus-visible:ring-2 focus-visible:ring-[#1570ef]/20 focus-visible:ring-offset-0"
import { Checkbox } from "@/components/ui/checkbox"

interface Grupo {
  id: number
  nombre: string
  clientes?: { id: number; codigo: string; nombreFantasia?: string }[]
}

interface Cliente {
  id: number
  codigo: string
  nombreFantasia?: string
}

const TIPO_DESTINATARIO = {
  GRUPOS: "GRUPOS",
  CUENTAS: "CUENTAS",
  TODOS_GRUPOS: "TODOS_GRUPOS",
  TODAS_CUENTAS: "TODAS_CUENTAS",
} as const

const FORMATO = { EXCEL: "EXCEL", PDF: "PDF" } as const
const TOMAR_ENVIOS = {
  SOLO_ENTREGADOS: "SOLO_ENTREGADOS",
  RETIRADOS_EXCEPTO: "RETIRADOS_EXCEPTO_RECHAZADOS_CANCELADOS",
} as const

export default function InformesPage() {
  const router = useRouter()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingGrupos, setLoadingGrupos] = useState(false)
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [tipoDestinatario, setTipoDestinatario] = useState<string>(TIPO_DESTINATARIO.TODOS_GRUPOS)
  const [idsGrupos, setIdsGrupos] = useState<number[]>([])
  const [idsCuentas, setIdsCuentas] = useState<number[]>([])
  const [formato, setFormato] = useState<string>(FORMATO.EXCEL)
  const [tomarEnvios, setTomarEnvios] = useState<string>(TOMAR_ENVIOS.RETIRADOS_EXCEPTO)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroCuentas, setFiltroCuentas] = useState("")

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const userProfile = sessionStorage.getItem("userProfile")
    if (!isAuthenticated) {
      router.push("/")
      return
    }
    if (userProfile === "Chofer") {
      router.push("/chofer")
      return
    }
    if (userProfile === "Cliente") {
      router.push("/clientes")
      return
    }
  }, [router])

  const loadGrupos = async () => {
    setLoadingGrupos(true)
    try {
      const apiBaseUrl = getApiBaseUrl()
      const res = await fetch(`${apiBaseUrl}/grupos`)
      if (res.ok) {
        const data = await res.json()
        const list: Grupo[] = Array.isArray(data) ? data : []
        list.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
        setGrupos(list)
      } else {
        setGrupos([])
      }
    } catch (e: unknown) {
      warnDev("Error al cargar grupos:", e)
      setGrupos([])
    } finally {
      setLoadingGrupos(false)
    }
  }

  const loadClientes = async () => {
    setLoadingClientes(true)
    try {
      const apiBaseUrl = getApiBaseUrl()
      const res = await fetch(`${apiBaseUrl}/clientes?page=0&size=1000`)
      if (res.ok) {
        const data = await res.json()
        const list: Cliente[] = Array.isArray(data?.content) ? data.content : []
        list.sort((a, b) => (a.codigo || "").localeCompare(b.codigo || "", "es", { sensitivity: "base" }))
        setClientes(list)
      } else {
        setClientes([])
      }
    } catch (e: unknown) {
      warnDev("Error al cargar clientes:", e)
      setClientes([])
    } finally {
      setLoadingClientes(false)
    }
  }

  useEffect(() => {
    loadGrupos()
  }, [])
  useEffect(() => {
    if (tipoDestinatario === TIPO_DESTINATARIO.CUENTAS || tipoDestinatario === TIPO_DESTINATARIO.TODAS_CUENTAS) {
      loadClientes()
    }
  }, [tipoDestinatario])

  const toggleGrupo = (id: number) => {
    setIdsGrupos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const toggleCuenta = (id: number) => {
    setIdsCuentas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const clientesFiltrados = useMemo(() => {
    const q = filtroCuentas.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) => {
      const codigo = (c.codigo || "").toLowerCase()
      const nombre = (c.nombreFantasia || "").toLowerCase()
      return codigo.includes(q) || nombre.includes(q)
    })
  }, [clientes, filtroCuentas])

  const handleDescargar = async () => {
    setError(null)
    if (!fechaDesde || !fechaHasta) {
      setError("Debe indicar un rango de fechas válido.")
      return
    }
    if (new Date(fechaDesde) > new Date(fechaHasta)) {
      setError("El rango de fechas es inválido.")
      return
    }
    if (tipoDestinatario === TIPO_DESTINATARIO.GRUPOS && idsGrupos.length === 0) {
      setError("Seleccione al menos un grupo.")
      return
    }
    if (tipoDestinatario === TIPO_DESTINATARIO.CUENTAS && idsCuentas.length === 0) {
      setError("Seleccione al menos un vendedor.")
      return
    }

    setDownloading(true)
    try {
      const apiBaseUrl = getApiBaseUrl()
      const body = {
        fechaDesde,
        fechaHasta,
        tipoDestinatario,
        idsGrupos: tipoDestinatario === TIPO_DESTINATARIO.GRUPOS ? idsGrupos : undefined,
        idsCuentas: tipoDestinatario === TIPO_DESTINATARIO.CUENTAS ? idsCuentas : undefined,
        formato,
        tomarEnvios,
      }
      const res = await fetch(`${apiBaseUrl}/informes/generar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/octet-stream",
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        setError(text || "No fue posible generar el informe. Reintente.")
        return
      }
      const blob = await res.blob()
      const disp = res.headers.get("Content-Disposition")
      const extPorFormato = formato === FORMATO.PDF ? "pdf" : "xlsx"
      let filename = `informe_colectados.${extPorFormato}`
      if (disp) {
        const match = /filename\*?=(?:UTF-8'')?([^;\s]+)/i.exec(disp) || /filename=["']?([^"'\s;]+)/i.exec(disp)
        if (match?.[1]) {
          try {
            filename = decodeURIComponent(match[1].replace(/^["']|["']$/g, "").trim())
          } catch {
            filename = `informe_colectados.${extPorFormato}`
          }
        }
      } else {
        const buf = await blob.arrayBuffer()
        const arr = new Uint8Array(buf)
        const isZip = arr.length >= 4 && arr[0] === 0x50 && arr[1] === 0x4B && arr[2] === 0x03 && arr[3] === 0x04
        if (isZip) filename = "informe_colectados.zip"
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      warnDev("Error descargando informe:", e)
      setError("Error de conexión al generar el informe.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]" suppressHydrationWarning>
      <ModernHeader />
      <main className={`px-4 pb-6 pt-3 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="mb-4 flex items-center gap-3">
            <FileBarChart className="h-8 w-8 shrink-0 text-[#1570ef]" aria-hidden />
            <h1 className="text-[34px] font-semibold tracking-tight text-[#1570ef]">Informes</h1>
          </div>

          <div className="ml-2 w-full max-w-[640px] space-y-5 rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm sm:p-6">
            <div className="space-y-2">
              <h2 className="text-[18px] font-semibold text-[#1570ef]">Pedidos colectados</h2>
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <div className="min-w-[140px] flex-1">
                  <label className={fieldLabelClass}>Desde</label>
                  <Input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className={inputClass}
                    suppressHydrationWarning
                  />
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className={fieldLabelClass}>Hasta</label>
                  <Input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className={inputClass}
                    suppressHydrationWarning
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-[#eef1f8] pt-5">
              <label className={fieldLabelClass}>Hacer informe para</label>
              <Select
                value={tipoDestinatario}
                onValueChange={(v) => {
                  setTipoDestinatario(v)
                  setIdsGrupos([])
                  setIdsCuentas([])
                  setFiltroCuentas("")
                }}
              >
                <SelectTrigger className="h-10 text-[14px] font-medium text-[#1f2433]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TIPO_DESTINATARIO.GRUPOS}>Grupos</SelectItem>
                  <SelectItem value={TIPO_DESTINATARIO.CUENTAS}>Vendedores</SelectItem>
                  <SelectItem value={TIPO_DESTINATARIO.TODOS_GRUPOS}>Todos los grupos</SelectItem>
                  <SelectItem value={TIPO_DESTINATARIO.TODAS_CUENTAS}>Todos los vendedores</SelectItem>
                </SelectContent>
              </Select>
              {tipoDestinatario === TIPO_DESTINATARIO.GRUPOS && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-[#e6eaf4] bg-[#fafbff] p-3">
                  <p className="mb-2 text-[12px] font-medium text-[#5d6578]">Seleccioná uno o más grupos</p>
                  {loadingGrupos ? (
                    <p className="text-[14px] text-[#8890a8]">Cargando grupos…</p>
                  ) : grupos.length === 0 ? (
                    <p className="text-[14px] text-[#8890a8]">No hay grupos.</p>
                  ) : (
                    <div className="space-y-2">
                      {grupos.map((g) => (
                        <label key={g.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-0.5 hover:bg-white/80">
                          <Checkbox checked={idsGrupos.includes(g.id)} onCheckedChange={() => toggleGrupo(g.id)} />
                          <span className="text-[14px] text-[#1f2433]">{g.nombre}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {tipoDestinatario === TIPO_DESTINATARIO.CUENTAS && (
                <div className="mt-3 rounded-xl border border-[#e6eaf4] bg-[#fafbff] p-3">
                  <p className="mb-2 text-[12px] font-medium text-[#5d6578]">Seleccioná uno o más vendedores</p>
                  {loadingClientes ? (
                    <p className="text-[14px] text-[#8890a8]">Cargando vendedores…</p>
                  ) : clientes.length === 0 ? (
                    <p className="text-[14px] text-[#8890a8]">No hay vendedores.</p>
                  ) : (
                    <>
                      <div className="relative mb-2">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8890a8]" aria-hidden />
                        <Input
                          type="search"
                          value={filtroCuentas}
                          onChange={(e) => setFiltroCuentas(e.target.value)}
                          placeholder="Buscar por código o nombre…"
                          autoComplete="off"
                          aria-label="Filtrar vendedores"
                          className={cn(inputClass, "mt-0 pl-9")}
                        />
                      </div>
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-0.5">
                        {clientesFiltrados.length === 0 ? (
                          <p className="text-[14px] text-[#8890a8]">Ningún vendedor coincide con la búsqueda.</p>
                        ) : (
                          clientesFiltrados.map((c) => (
                            <label
                              key={c.id}
                              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-0.5 hover:bg-white/80"
                            >
                              <Checkbox checked={idsCuentas.includes(c.id)} onCheckedChange={() => toggleCuenta(c.id)} />
                              <span className="text-[14px] text-[#1f2433]">
                                {c.codigo}
                                {c.nombreFantasia ? ` - ${c.nombreFantasia}` : ""}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-[#eef1f8] pt-5">
              <label className={fieldLabelClass}>Forma de descarga</label>
              <Select value={formato} onValueChange={setFormato}>
                <SelectTrigger className="h-10 text-[14px] font-medium text-[#1f2433]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FORMATO.EXCEL}>Excel</SelectItem>
                  <SelectItem value={FORMATO.PDF}>PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 border-t border-[#eef1f8] pt-5">
              <label className={fieldLabelClass}>Tomar pedidos</label>
              <Select value={tomarEnvios} onValueChange={setTomarEnvios}>
                <SelectTrigger className="h-10 min-h-[2.75rem] whitespace-normal py-2 text-left text-[14px] font-medium leading-snug text-[#1f2433] sm:min-h-10 sm:whitespace-nowrap">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TOMAR_ENVIOS.SOLO_ENTREGADOS}>Solo entregados</SelectItem>
                  <SelectItem value={TOMAR_ENVIOS.RETIRADOS_EXCEPTO}>
                    Todos los retirados exceptuando los rechazados por el comprador y los cancelados
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-800">
                {error}
              </div>
            )}

            <div className="border-t border-[#eef1f8] pt-4">
              <Button
                onClick={handleDescargar}
                disabled={downloading}
                className="h-11 w-full gap-2 rounded-xl bg-[#1459e9] px-6 text-[14px] font-semibold text-white shadow-sm hover:bg-[#114bce] disabled:opacity-50 sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {downloading ? "Generando…" : "Descargar"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
