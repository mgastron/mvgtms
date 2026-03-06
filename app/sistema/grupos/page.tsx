"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Layers } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"
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
      router.push("/chofer")
      return
    }
    if (userProfile === "Cliente") {
      router.push("/clientes")
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
        setGrupos(Array.isArray(data) ? data : [])
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50" suppressHydrationWarning>
      <ModernHeader />
      <main className="p-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Grupos de clientes</h1>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Lista de grupos</h3>
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5">
                  <Layers className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">{grupos.length} grupos</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Nombre</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Clientes asignados</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-700 w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500">Cargando...</td>
                    </tr>
                  ) : grupos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-16 text-center">
                        <p className="text-sm font-medium text-gray-900">No hay grupos</p>
                        <p className="mt-1 text-sm text-gray-500">Los grupos se crean al dar de alta un cliente (opción &quot;Crear grupo a partir del cliente&quot;) o desde la tabla de Clientes.</p>
                      </td>
                    </tr>
                  ) : (
                    grupos.map((g) => (
                      <tr key={g.id} className="transition-all hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          {editingId === g.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingNombre}
                                onChange={(e) => setEditingNombre(e.target.value)}
                                className="h-9 max-w-xs"
                                onKeyDown={(e) => e.key === "Enter" && handleSaveNombre()}
                              />
                              <Button size="sm" onClick={handleSaveNombre} disabled={saving}>
                                {saving ? "Guardando..." : "Guardar"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={saving}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-gray-900">{g.nombre}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {g.clientes && g.clientes.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setClientesModalGroup(g)}
                              className="text-left w-full rounded-md p-1 -m-1 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 transition-colors"
                            >
                              <ul className="text-sm text-gray-600 space-y-0.5">
                                {g.clientes.slice(0, 5).map((c) => (
                                  <li key={c.id}>
                                    {c.codigo}
                                    {c.nombreFantasia ? ` - ${c.nombreFantasia}` : ""}
                                  </li>
                                ))}
                                {g.clientes.length > 5 && (
                                  <li className="text-gray-500 font-medium pt-0.5">
                                    + {g.clientes.length - 5} más — clic para ver todos
                                  </li>
                                )}
                              </ul>
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">Ningún cliente</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {editingId === g.id ? null : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-lg text-gray-600 hover:bg-purple-100 hover:text-purple-700"
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorDialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!clientesModalGroup} onOpenChange={(open) => !open && setClientesModalGroup(null)}>
        <AlertDialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Clientes de {clientesModalGroup?.nombre ?? ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clientesModalGroup?.clientes?.length ?? 0} cliente(s) en este grupo
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="overflow-y-auto max-h-[50vh] rounded-lg border border-gray-200 bg-gray-50/50 py-2 -mx-1 px-3">
            <ul className="text-sm text-gray-700 space-y-1.5">
              {clientesModalGroup?.clientes?.map((c) => (
                <li key={c.id} className="py-1.5 border-b border-gray-100 last:border-0">
                  <span className="font-medium text-gray-800">{c.codigo}</span>
                  {c.nombreFantasia ? (
                    <span className="text-gray-600"> — {c.nombreFantasia}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClientesModalGroup(null)}>Cerrar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
