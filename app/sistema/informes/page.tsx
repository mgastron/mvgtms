"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileBarChart, Download } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"
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
        setGrupos(Array.isArray(data) ? data : [])
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
        const list = data?.content ?? []
        setClientes(Array.isArray(list) ? list : [])
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

  const handleDescargar = async () => {
    setError(null)
    if (!fechaDesde || !fechaHasta) {
      setError("Debe indicar fecha desde y hasta.")
      return
    }
    if (new Date(fechaDesde) > new Date(fechaHasta)) {
      setError("La fecha desde no puede ser posterior a la fecha hasta.")
      return
    }
    if (tipoDestinatario === TIPO_DESTINATARIO.GRUPOS && idsGrupos.length === 0) {
      setError("Seleccione al menos un grupo.")
      return
    }
    if (tipoDestinatario === TIPO_DESTINATARIO.CUENTAS && idsCuentas.length === 0) {
      setError("Seleccione al menos una cuenta.")
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
        setError(text || "Error al generar el informe.")
        return
      }
      const blob = await res.blob()
      const disp = res.headers.get("Content-Disposition")
      const ext = formato === FORMATO.PDF ? "pdf" : "xlsx"
      let filename = `informe_colectados.${ext}`
      if (disp) {
        const match = /filename\*?=(?:UTF-8'')?([^;\s]+)/i.exec(disp) || /filename=["']?([^"'\s;]+)/i.exec(disp)
        if (match?.[1]) {
          try {
            filename = decodeURIComponent(match[1].replace(/^["']|["']$/g, "").trim())
          } catch {
            filename = `informe_colectados.${ext}`
          }
        }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50" suppressHydrationWarning>
      <ModernHeader />
      <main className="p-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <FileBarChart className="h-7 w-7 text-indigo-600" />
              Informes
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Informe de pedidos colectados por rango de fechas y cliente o grupo.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-6">
            {/* Pedidos colectados desde / hasta */}
            <div className="space-y-2">
              <label className="text-base font-medium text-gray-900">Pedidos colectados desde y hasta</label>
              <p className="text-xs text-gray-500">
                Son los pedidos que fueron <strong>colectados</strong> (retirados) en el rango indicado. Defina el límite desde y hasta.
              </p>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs text-gray-600">Desde</label>
                  <Input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs text-gray-600">Hasta</label>
                  <Input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Hacer pedido para */}
            <div className="space-y-2">
              <label className="text-base font-medium text-gray-900">Hacer informe para</label>
              <Select value={tipoDestinatario} onValueChange={(v) => { setTipoDestinatario(v); setIdsGrupos([]); setIdsCuentas([]) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TIPO_DESTINATARIO.GRUPOS}>Grupos</SelectItem>
                  <SelectItem value={TIPO_DESTINATARIO.CUENTAS}>Cuentas</SelectItem>
                  <SelectItem value={TIPO_DESTINATARIO.TODOS_GRUPOS}>Todos los grupos</SelectItem>
                  <SelectItem value={TIPO_DESTINATARIO.TODAS_CUENTAS}>Todas las cuentas</SelectItem>
                </SelectContent>
              </Select>
              {tipoDestinatario === TIPO_DESTINATARIO.GRUPOS && (
                <div className="mt-3 border rounded-lg p-3 bg-gray-50/50 max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-600 mb-2">Seleccione uno o más grupos:</p>
                  {loadingGrupos ? (
                    <p className="text-sm text-gray-500">Cargando grupos...</p>
                  ) : grupos.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay grupos.</p>
                  ) : (
                    <div className="space-y-2">
                      {grupos.map((g) => (
                        <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={idsGrupos.includes(g.id)}
                            onCheckedChange={() => toggleGrupo(g.id)}
                          />
                          <span className="text-sm">{g.nombre}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {tipoDestinatario === TIPO_DESTINATARIO.CUENTAS && (
                <div className="mt-3 border rounded-lg p-3 bg-gray-50/50 max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-600 mb-2">Seleccione una o más cuentas (clientes):</p>
                  {loadingClientes ? (
                    <p className="text-sm text-gray-500">Cargando clientes...</p>
                  ) : clientes.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay clientes.</p>
                  ) : (
                    <div className="space-y-2">
                      {clientes.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={idsCuentas.includes(c.id)}
                            onCheckedChange={() => toggleCuenta(c.id)}
                          />
                          <span className="text-sm">{c.codigo}{c.nombreFantasia ? ` - ${c.nombreFantasia}` : ""}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Forma de descarga */}
            <div className="space-y-2">
              <label className="text-base font-medium text-gray-900">Forma de descarga</label>
              <Select value={formato} onValueChange={setFormato}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FORMATO.EXCEL}>Excel</SelectItem>
                  <SelectItem value={FORMATO.PDF}>PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tomar envíos */}
            <div className="space-y-2">
              <label className="text-base font-medium text-gray-900">Tomar envíos</label>
              <Select value={tomarEnvios} onValueChange={setTomarEnvios}>
                <SelectTrigger>
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
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <Button
              onClick={handleDescargar}
              disabled={downloading}
              className="w-full sm:w-auto gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Generando..." : "Descargar"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
