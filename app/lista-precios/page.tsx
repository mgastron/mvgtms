"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Pencil, Trash2, Plus, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NewListaPrecioModal } from "@/components/new-lista-precio-modal"
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
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev, errorDev } from "@/lib/logger"
import { Montserrat } from "next/font/google"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const filterAsideInputClass =
  "h-9 rounded-lg border border-slate-200 bg-slate-50/80 text-[13px] font-medium text-slate-800 shadow-none placeholder:font-normal placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-offset-0"

interface ListaPrecio {
  id: number
  codigo: string
  nombre: string
  zonaPropia: boolean
  zonas?: Array<{ id: string; codigo: string; nombre: string; cps: string; valor: string }>
  listaPrecioSeleccionada?: string
}

const mockListaPrecios: ListaPrecio[] = [
  {
    id: 1,
    codigo: "32",
    nombre: "vml online",
    zonaPropia: false,
  },
  {
    id: 2,
    codigo: "1",
    nombre: "VALENTIN",
    zonaPropia: true,
  },
  {
    id: 3,
    codigo: "7",
    nombre: "TIENDA DE FIESTA",
    zonaPropia: false,
  },
  {
    id: 4,
    codigo: "smu",
    nombre: "smud",
    zonaPropia: false,
  },
  {
    id: 5,
    codigo: "18",
    nombre: "selloskenobi",
    zonaPropia: false,
  },
  {
    id: 6,
    codigo: "17",
    nombre: "rudolph electronics",
    zonaPropia: false,
  },
  {
    id: 7,
    codigo: "14",
    nombre: "romemut",
    zonaPropia: false,
  },
  {
    id: 8,
    codigo: "00",
    nombre: "prueba",
    zonaPropia: true,
  },
]

export default function ListaPreciosPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Verificar autenticación y perfil
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const userProfile = sessionStorage.getItem("userProfile")
    
    if (!isAuthenticated) {
      router.push("/")
      return
    }
    
    // Choferes no pueden acceder
    if (userProfile === "Chofer") {
      router.push("/repartidor")
      return
    }
    
    // Clientes no pueden acceder a Administración (tarifas)
    if (userProfile === "Cliente") {
      router.push("/pedidos")
      return
    }

    // Coordinador no puede acceder a Tarifa (Administración)
    if (userProfile === "Coordinador") {
      router.push("/pedidos")
      return
    }
  }, [router])
  
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [listaPrecios, setListaPrecios] = useState<ListaPrecio[]>([])
  const [precioToDelete, setPrecioToDelete] = useState<ListaPrecio | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isNewListaPrecioModalOpen, setIsNewListaPrecioModalOpen] = useState(false)
  const [editingListaPrecio, setEditingListaPrecio] = useState<ListaPrecio | null>(null)
  const [filters, setFilters] = useState({
    codigo: "",
    nombre: "",
    zonaPropia: "TODOS",
  })
  const isInitialLoad = useRef(true)

  const loadListaPreciosFromBackend = async () => {
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/lista-precios?page=0&size=1000`)
      if (response.ok) {
        const data = await response.json()
        const content = data.content || []
        const backendListaPrecios: ListaPrecio[] = content.map((lp: any) => ({
          id: lp.id,
          codigo: lp.codigo || "",
          nombre: lp.nombre || "",
          zonaPropia: lp.zonaPropia !== undefined ? lp.zonaPropia : false,
        }))
        setListaPrecios(backendListaPrecios)
        isInitialLoad.current = false
        return
      }
    } catch (error) {
      warnDev("No se pudo cargar lista de precios del backend:", error)
    }
    setListaPrecios(mockListaPrecios)
    isInitialLoad.current = false
  }

  useEffect(() => {
    loadListaPreciosFromBackend()
  }, [])

  // Filtrar lista de precios
  const filteredListaPrecios = useMemo(() => {
    const filtered = listaPrecios.filter((precio) => {
      if (filters.codigo && !precio.codigo.toLowerCase().includes(filters.codigo.toLowerCase())) {
        return false
      }
      if (filters.nombre && !precio.nombre.toLowerCase().includes(filters.nombre.toLowerCase())) {
        return false
      }
      if (filters.zonaPropia !== "TODOS") {
        const zonaPropiaFilter = filters.zonaPropia === "SI"
        if (precio.zonaPropia !== zonaPropiaFilter) {
          return false
        }
      }
      return true
    })
    return [...filtered].sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "es", { sensitivity: "base" })
    )
  }, [filters, listaPrecios])

  // Calcular paginación
  const totalRecords = filteredListaPrecios.length
  const totalPages = Math.ceil(totalRecords / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedListaPrecios = filteredListaPrecios.slice(startIndex, endIndex)

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setCurrentPage(1)
  }

  const handleDeleteClick = (precio: ListaPrecio) => {
    setPrecioToDelete(precio)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (precioToDelete) {
      setListaPrecios((prev) => {
        const updated = prev.filter((p) => p.id !== precioToDelete.id)
        // Ajustar la página si es necesario
        const newTotalPages = Math.ceil(updated.length / itemsPerPage)
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages)
        }
        return updated
      })
      setPrecioToDelete(null)
      setIsDeleteDialogOpen(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100/80">
      <ModernHeader />
      <main className={`px-4 pb-8 pt-4 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Administración</p>
              <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight text-slate-900">Tarifas</h1>
              <p className="mt-1 max-w-xl text-[13px] text-slate-600">Listas por código, nombre y si usan zona propia.</p>
            </div>
            <Button
              className="h-10 shrink-0 gap-2 rounded-lg border border-slate-800 bg-slate-900 px-5 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800"
              onClick={() => {
                setEditingListaPrecio(null)
                setIsNewListaPrecioModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Nueva tarifa
            </Button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_1fr] lg:items-start">
            <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Refinar listado</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600">Código</label>
                  <Input
                    value={filters.codigo}
                    onChange={(e) => handleFilterChange("codigo", e.target.value)}
                    placeholder="Código…"
                    className={filterAsideInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600">Nombre</label>
                  <Input
                    value={filters.nombre}
                    onChange={(e) => handleFilterChange("nombre", e.target.value)}
                    placeholder="Nombre…"
                    className={filterAsideInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600">Zona propia</label>
                  <Select value={filters.zonaPropia} onValueChange={(value) => handleFilterChange("zonaPropia", value)}>
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/80 text-[13px] font-medium text-slate-800 shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos</SelectItem>
                      <SelectItem value="SI">Sí</SelectItem>
                      <SelectItem value="NO">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </aside>

            <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                <h2 className="text-[15px] font-semibold text-slate-900">Listas</h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-medium tabular-nums text-slate-600">
                  {totalRecords} registro{totalRecords !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90">
                      <th className="px-4 py-2.5 font-semibold text-slate-600 sm:px-5">Código</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 sm:px-5">Nombre</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 sm:px-5">Zona propia</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-slate-600 sm:px-5">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedListaPrecios.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-14 text-center">
                          <div className="mx-auto flex max-w-md flex-col items-center">
                            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                              <Inbox className="h-5 w-5 text-slate-500" aria-hidden />
                            </div>
                            <p className="text-[14px] font-semibold text-slate-800">Sin coincidencias</p>
                            <p className="mt-1 text-[13px] text-slate-500">Ajustá los criterios de la columna izquierda</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedListaPrecios.map((precio) => (
                        <tr key={precio.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 sm:px-5">{precio.codigo}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-800 sm:px-5">{precio.nombre}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 sm:px-5">
                            {precio.zonaPropia ? "Sí" : "No"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 sm:px-5">
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                onClick={() => {
                                  setEditingListaPrecio(precio)
                                  setIsNewListaPrecioModalOpen(true)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600"
                                onClick={() => handleDeleteClick(precio)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="flex flex-wrap items-center gap-3 text-[13px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Total</span>
                    <span className="rounded-md bg-white px-2 py-0.5 font-semibold text-slate-800 ring-1 ring-slate-200/80">
                      {totalRecords}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Páginas</span>
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-700">
                      {totalPages || 1}
                    </span>
                  </div>
                </div>

                  <div className="flex w-full items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 sm:w-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="h-8 px-2.5 text-[13px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                    >
                      &lt;&lt;
                    </Button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-8 min-w-[2rem] px-2 text-[13px] font-medium ${
                            currentPage === pageNum
                              ? "bg-slate-800 text-white shadow-sm hover:bg-slate-800 hover:text-white"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="h-8 px-2.5 text-[13px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                    >
                      &gt;&gt;
                    </Button>
                  </div>

                  <div className="flex justify-start sm:justify-end">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1">
                      <span className="text-[13px] font-medium text-slate-600">Por página</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(v) => {
                          setItemsPerPage(Number(v))
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="h-8 w-14 border-0 bg-transparent text-[13px] font-semibold text-slate-800 shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className={montserrat.className}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-[#1f2433]">¿Eliminar esta tarifa?</AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] leading-relaxed text-[#5d6578]">
              ¿Estás seguro de que deseas eliminar la tarifa{" "}
              <span className="font-semibold text-[#1f2433]">
                {precioToDelete?.codigo} - {precioToDelete?.nombre}
              </span>
              ? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              onClick={() => setPrecioToDelete(null)}
              className="rounded-xl border border-[#e6eaf4] bg-white text-[#1570ef] hover:bg-[#f7faff]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Nueva Lista de Precios */}
      <NewListaPrecioModal
        isOpen={isNewListaPrecioModalOpen}
        onClose={() => {
          setIsNewListaPrecioModalOpen(false)
          setEditingListaPrecio(null)
        }}
        onSave={async (listaPrecioData) => {
          const apiBaseUrl = getApiBaseUrl()
          const body = {
            codigo: listaPrecioData.codigo,
            nombre: listaPrecioData.nombre,
            zonaPropia: listaPrecioData.tipoZonas === "Zonas propias",
            listaPrecioSeleccionada: listaPrecioData.listaPrecioSeleccionada || null,
            zonas: (listaPrecioData.zonas || []).map((z: any) => ({
              codigo: z.codigo || "",
              nombre: z.nombre || "",
              cps: z.cps || "",
              valor: z.valor || "",
            })),
          }
          try {
            if (listaPrecioData.id) {
              const res = await fetch(`${apiBaseUrl}/lista-precios/${listaPrecioData.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              })
              if (!res.ok) throw new Error("Error al actualizar")
            } else {
              const res = await fetch(`${apiBaseUrl}/lista-precios`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              })
              if (!res.ok) throw new Error("Error al crear")
            }
            await loadListaPreciosFromBackend()
          } catch (e) {
            errorDev("Error al guardar lista de precios:", e)
            alert("No se pudo guardar la lista de precios. Verificá que el backend esté accesible.")
            throw e
          }
          setIsNewListaPrecioModalOpen(false)
          setEditingListaPrecio(null)
        }}
        editingListaPrecio={editingListaPrecio}
        listasPreciosConZonasPropias={listaPrecios.filter((p) => p.zonaPropia).map((p) => ({
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
        }))}
      />
    </div>
  )
}

