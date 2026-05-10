"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Montserrat } from "next/font/google"
import { ModernHeader } from "@/components/modern-header"
import { ClientsTable } from "@/components/clients-table"
import { NewClientModal } from "@/components/new-client-modal"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const filterAsideInputClass =
  "h-9 rounded-lg border border-slate-200 bg-slate-50/80 text-[13px] font-medium text-slate-800 shadow-none placeholder:font-normal placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-offset-0"

interface GrupoOpt {
  id: number
  nombre: string
}
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ClientsPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Verificar autenticación y perfil
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const userProfile = sessionStorage.getItem("userProfile")
    
    if (!isAuthenticated) {
      router.push("/")
      return
    }
    
    // Choferes no pueden acceder a esta página
    if (userProfile === "Chofer") {
      router.push("/repartidor")
      return
    }

    if (userProfile === "Cliente") {
      router.push("/pedidos")
      return
    }
  }, [router])
  const [filters, setFilters] = useState({
    nombreFantasia: "",
    grupoId: "",
    integraciones: "todos",
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<any>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newClient, setNewClient] = useState<any>(null)
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  })
  const [grupos, setGrupos] = useState<GrupoOpt[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/grupos`)
        if (res.ok) {
          const data = await res.json()
          setGrupos(Array.isArray(data) ? data : [])
        }
      } catch (e) {
        warnDev("No se pudieron cargar grupos para el filtro:", e)
        setGrupos([])
      }
    }
    load()
  }, [])

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleClearFilters = () => {
    setFilters({
      nombreFantasia: "",
      grupoId: "",
      integraciones: "todos",
    })
  }

  const handleSaveClient = async (clientData: any) => {
    const isEditing = !!clientData.id

    if (isEditing) {
      // Actualizar cliente existente
      let backendAvailable = false

      try {
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(`${apiBaseUrl}/clientes/${clientData.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(clientData),
        })

        if (response.ok) {
          backendAvailable = true
          const updatedClient = await response.json()
          // Actualizar el cliente en la tabla
          setNewClient(updatedClient)
          return
        } else {
          const errorData = await response.json().catch(() => ({}))
          // Si el error es por código duplicado al editar, mostrar mensaje más claro
          if (response.status === 400 || response.status === 409) {
            const errorMessage = errorData.message || "Ya existe un cliente con ese código"
            // Si el mensaje menciona código duplicado, lanzar error específico
            if (errorMessage.toLowerCase().includes("código") || errorMessage.toLowerCase().includes("codigo")) {
              throw new Error(errorMessage)
            }
          }
          throw new Error(errorData.message || `Error del servidor: ${response.status}`)
        }
      } catch (fetchError: any) {
        if (fetchError.message && !fetchError.message.includes("Failed to fetch")) {
          throw fetchError
        }
        warnDev("Backend no disponible para actualizar cliente:", fetchError)
        // Si el backend no está disponible, actualizar localmente
        setNewClient({
          id: clientData.id,
          codigo: clientData.codigo,
          nombreFantasia: clientData.nombreFantasia || "",
          razonSocial: "",
          numDoc: "",
          habilitado: clientData.habilitado !== undefined ? clientData.habilitado : true,
          integraciones: clientData.integraciones,
          // Campos de integraciones
          flexIdVendedor: clientData.flexIdVendedor,
          flexUsername: clientData.flexUsername,
          tiendanubeUrl: clientData.tiendanubeUrl,
          shopifyUrl: clientData.shopifyUrl,
          shopifyClaveUnica: clientData.shopifyClaveUnica,
          vtexUrl: clientData.vtexUrl,
          vtexKey: clientData.vtexKey,
          vtexToken: clientData.vtexToken,
          vtexIdLogistica: clientData.vtexIdLogistica,
        })
      }
    } else {
      try {
        const apiBaseUrl = getApiBaseUrl()
        const payload = { ...clientData }
        if (!payload.codigo || !String(payload.codigo).trim()) {
          delete payload.codigo
        }
        const response = await fetch(`${apiBaseUrl}/clientes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          const createdClient = await response.json()
          setNewClient(createdClient)
          return
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Error del servidor: ${response.status}`)
      } catch (fetchError: any) {
        if (fetchError.message && !fetchError.message.includes("Failed to fetch")) {
          throw fetchError
        }
        warnDev("Backend no disponible para crear vendedor:", fetchError)
        throw new Error("No se pudo conectar con el servidor. Intente nuevamente.")
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-100/80" suppressHydrationWarning>
      <ModernHeader />

      <main className={`px-4 pb-8 pt-4 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Configuración</p>
              <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight text-slate-900">Vendedores</h1>
              <p className="mt-1 max-w-xl text-[13px] text-slate-600">Cuentas comerciales y datos de integración.</p>
            </div>
            <Button
              className="h-10 shrink-0 gap-2 rounded-lg border border-slate-800 bg-slate-900 px-5 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800"
              onClick={() => {
                setEditingClient(null)
                setIsModalOpen(true)
              }}
            >
              <UserPlus className="h-4 w-4" />
              Nuevo vendedor
            </Button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_1fr] lg:items-start">
            <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Refinar listado</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600">Nombre</label>
                  <Input
                    value={filters.nombreFantasia}
                    onChange={(e) => handleFilterChange("nombreFantasia", e.target.value)}
                    placeholder="Nombre…"
                    className={filterAsideInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600">Grupo</label>
                  <Select
                    value={filters.grupoId || "todos"}
                    onValueChange={(v) => handleFilterChange("grupoId", v === "todos" ? "" : v)}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/80 text-[13px] font-medium text-slate-800 shadow-none">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los grupos</SelectItem>
                      {grupos.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600">Integración</label>
                  <Select value={filters.integraciones} onValueChange={(v) => handleFilterChange("integraciones", v)}>
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/80 text-[13px] font-medium text-slate-800 shadow-none">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      <SelectItem value="flex">Flex</SelectItem>
                      <SelectItem value="tiendanube">Tienda Nube</SelectItem>
                      <SelectItem value="shopify">Shopify</SelectItem>
                      <SelectItem value="vtex">VTEX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearFilters}
                  className="h-9 w-full rounded-lg border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Limpiar filtros
                </Button>
              </div>
            </aside>

            <ClientsTable
              tone="slate"
              filters={filters}
              newClient={newClient}
              onClientAdded={() => setNewClient(null)}
              refreshTrigger={refreshKey}
              onClientError={(error) => {
                setErrorDialog({ open: true, message: error })
                setTimeout(() => setNewClient(null), 0)
              }}
              onEditClient={(client) => {
                setEditingClient(client)
                setIsModalOpen(true)
              }}
            />
          </div>

          {/* New Client Modal */}
          <NewClientModal
            open={isModalOpen}
            onOpenChange={(open) => {
              setIsModalOpen(open)
              if (!open) {
                setEditingClient(null)
              }
            }}
            onSave={handleSaveClient}
            editingClient={editingClient}
          />

          {/* Error Dialog */}
          <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog({ open, message: "" })}>
            <AlertDialogContent className={montserrat.className}>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg font-semibold text-[#1f2433]">
                  Error al guardar vendedor
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[14px] leading-relaxed text-[#5d6578]">
                  {errorDialog.message}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction
                  className="rounded-xl bg-[#1459e9] text-white hover:bg-[#114bce]"
                  onClick={() => setErrorDialog({ open: false, message: "" })}
                >
                  Aceptar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </div>
  )
}

