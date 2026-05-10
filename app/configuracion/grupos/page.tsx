"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Layers } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"
import { Montserrat } from "next/font/google"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const inputEditClass =
  "h-10 max-w-xs rounded-xl border border-[#e6eaf4] bg-white text-[14px] font-medium text-[#1f2433] shadow-sm focus-visible:border-[#1570ef] focus-visible:ring-2 focus-visible:ring-[#1570ef]/20 focus-visible:ring-offset-0"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ClienteResumen {
  id: number
  codigo: string
  nombreFantasia?: string
}

interface Grupo {
  id: number
  nombre: string
  clientes?: ClienteResumen[]
}

export default function GruposPage() {
  const router = useRouter()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingNombre, setEditingNombre] = useState("")
  const [saving, setSaving] = useState(false)
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; message: string }>({ open: false, message: "" })
  const [clientesModalGroup, setClientesModalGroup] = useState<Grupo | null>(null)

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
      return
    }
  }, [router])

  const loadGrupos = async () => {
    setLoading(true)
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/grupos`)
      if (response.ok) {
        const data = await response.json()
        const list: Grupo[] = Array.isArray(data) ? data : []
        list.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
        setGrupos(list)
      } else {
        setGrupos([])
      }
    } catch (error: any) {
      warnDev("Error al cargar grupos:", error)
      setGrupos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGrupos()
  }, [])

  const handleStartEdit = (g: Grupo) => {
    setEditingId(g.id)
    setEditingNombre(g.nombre)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingNombre("")
  }

  const handleSaveNombre = async () => {
    if (editingId == null) return
    const nombre = editingNombre.trim()
    if (!nombre) {
      setErrorDialog({ open: true, message: "El nombre del grupo es obligatorio." })
      return
    }
    setSaving(true)
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/grupos/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      })
      if (response.ok) {
        await loadGrupos()
        handleCancelEdit()
      } else {
        const err = await response.json().catch(() => ({}))
        setErrorDialog({ open: true, message: err.message || "Error al actualizar el nombre." })
      }
    } catch (e: any) {
      setErrorDialog({ open: true, message: e?.message || "Error de conexión." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]" suppressHydrationWarning>
      <ModernHeader />
      <main className={`px-4 pb-6 pt-3 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5d6578]">Configuración</p>
            <h1 className="mt-1 text-[34px] font-semibold tracking-tight text-[#1570ef]">Grupos</h1>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e6eaf4] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6eaf4] bg-[#fafbff] px-4 py-3 sm:px-5">
              <h2 className="text-[16px] font-semibold text-[#1f2433]">Grupos de clientes</h2>
              <div className="flex items-center gap-2 rounded-full border border-[#e6eaf4] bg-white px-3 py-1 text-[13px] font-medium text-[#5d6578]">
                <Layers className="h-3.5 w-3.5 text-[#1570ef]" aria-hidden />
                <span className="text-[#1570ef]">{grupos.length}</span>
                <span>grupos</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e6eaf4] bg-[#f7f8fc]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Clientes asignados
                    </th>
                    <th className="w-24 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f8]">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-[14px] text-[#8890a8]">
                        Cargando…
                      </td>
                    </tr>
                  ) : grupos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-14 text-center">
                        <div className="mx-auto flex max-w-md flex-col items-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff]">
                            <Layers className="h-6 w-6 text-[#1570ef]" aria-hidden />
                          </div>
                          <p className="text-[14px] font-semibold text-[#1f2433]">No hay grupos</p>
                          <p className="mt-2 text-[13px] leading-relaxed text-[#8890a8]">
                            Los grupos se crean al dar de alta un cliente (opción &quot;Crear grupo a partir del cliente&quot;) o desde la tabla de Clientes.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    grupos.map((g, index) => (
                      <tr
                        key={g.id}
                        className={`transition-colors hover:bg-[#f7faff] ${index % 2 === 0 ? "bg-white" : "bg-[#fafbff]"}`}
                      >
                        <td className="px-4 py-3 sm:px-5">
                          {editingId === g.id ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                value={editingNombre}
                                onChange={(e) => setEditingNombre(e.target.value)}
                                className={inputEditClass}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveNombre()}
                              />
                              <Button
                                size="sm"
                                onClick={handleSaveNombre}
                                disabled={saving}
                                className="h-9 rounded-xl bg-[#1459e9] px-4 text-[13px] font-semibold text-white hover:bg-[#114bce] disabled:opacity-50"
                              >
                                {saving ? "Guardando…" : "Guardar"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={saving}
                                className="h-9 rounded-xl border-[#e6eaf4] text-[13px] font-semibold text-[#1570ef] hover:bg-[#f7faff]"
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[14px] font-medium text-[#1f2433]">{g.nombre}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 sm:px-5">
                          {g.clientes && g.clientes.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setClientesModalGroup(g)}
                              className="-m-1 w-full rounded-xl p-2 text-left transition-colors hover:bg-[#eef4ff] focus:outline-none focus:ring-2 focus:ring-[#1570ef]/25"
                            >
                              <ul className="space-y-0.5 text-[14px] text-[#5d6578]">
                                {g.clientes.slice(0, 5).map((c) => (
                                  <li key={c.id}>
                                    {c.codigo}
                                    {c.nombreFantasia ? ` - ${c.nombreFantasia}` : ""}
                                  </li>
                                ))}
                                {g.clientes.length > 5 && (
                                  <li className="pt-0.5 text-[13px] font-medium text-[#1570ef]">
                                    + {g.clientes.length - 5} más — clic para ver todos
                                  </li>
                                )}
                              </ul>
                            </button>
                          ) : (
                            <span className="text-[14px] text-[#8890a8]">Ningún cliente</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center sm:px-5">
                          {editingId === g.id ? null : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-lg text-[#5d6578] hover:bg-[#eef4ff] hover:text-[#1570ef]"
                              onClick={() => handleStartEdit(g)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
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

      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog((p) => ({ ...p, open }))}>
        <AlertDialogContent className={montserrat.className}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-[#1f2433]">Error</AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] leading-relaxed text-[#5d6578]">
              {errorDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="rounded-xl bg-[#1459e9] px-6 text-[14px] font-semibold text-white hover:bg-[#114bce]">
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!clientesModalGroup} onOpenChange={(open) => !open && setClientesModalGroup(null)}>
        <AlertDialogContent className={`flex max-h-[85vh] max-w-md flex-col ${montserrat.className}`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-[#1f2433]">
              Clientes de {clientesModalGroup?.nombre ?? ""}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-[#5d6578]">
              {clientesModalGroup?.clientes?.length ?? 0} cliente(s) en este grupo
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="-mx-1 max-h-[50vh] overflow-y-auto rounded-xl border border-[#e6eaf4] bg-[#fafbff] px-3 py-2">
            <ul className="space-y-1.5 text-[14px] text-[#5d6578]">
              {clientesModalGroup?.clientes?.map((c) => (
                <li key={c.id} className="border-b border-[#eef1f8] py-2 last:border-0">
                  <span className="font-semibold text-[#1f2433]">{c.codigo}</span>
                  {c.nombreFantasia ? <span> — {c.nombreFantasia}</span> : null}
                </li>
              ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setClientesModalGroup(null)}
              className="rounded-xl border border-[#e6eaf4] bg-white text-[#1570ef] hover:bg-[#f7faff]"
            >
              Cerrar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
