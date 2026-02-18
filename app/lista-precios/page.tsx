"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Pencil, Trash2, Plus } from "lucide-react"
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
      router.push("/chofer")
      return
    }
    
    // Clientes no pueden acceder a Sistema
    if (userProfile === "Cliente") {
      router.push("/clientes")
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
    return listaPrecios.filter((precio) => {
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <ModernHeader />
      <main className="p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px] space-y-6">

          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#6B46FF] to-[#8B5CF6] shadow-lg shadow-purple-500/20">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">Lista Precios</h1>
                <p className="mt-1 text-sm text-gray-500">Gestiona las listas de precios del sistema</p>
              </div>
            </div>
            <Button
              className="gap-2 bg-gradient-to-r from-[#6B46FF] to-[#8B5CF6] shadow-lg shadow-purple-500/30 hover:from-[#5a3ad6] hover:to-[#7c4dd4] transition-all duration-200"
              onClick={() => {
                setEditingListaPrecio(null)
                setIsNewListaPrecioModalOpen(true)
              }}
            >
              <Plus className="h-5 w-5" />
              Nuevo
            </Button>
          </div>

          {/* Filter Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6B46FF] to-[#8B5CF6]">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Filtros de búsqueda</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Codigo</label>
                <Input
                  value={filters.codigo}
                  onChange={(e) => handleFilterChange("codigo", e.target.value)}
                  placeholder="Buscar por código..."
                  className="h-10 rounded-lg border-gray-300 bg-gray-50 transition-all focus:border-[#6B46FF] focus:bg-white focus:ring-2 focus:ring-[#6B46FF]/20"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <Input
                  value={filters.nombre}
                  onChange={(e) => handleFilterChange("nombre", e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="h-10 rounded-lg border-gray-300 bg-gray-50 transition-all focus:border-[#6B46FF] focus:bg-white focus:ring-2 focus:ring-[#6B46FF]/20"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Zona Propia</label>
                <Select value={filters.zonaPropia} onValueChange={(value) => handleFilterChange("zonaPropia", value)}>
                  <SelectTrigger className="h-10 rounded-lg border-2 border-[#6B46FF] bg-white text-gray-600 focus:ring-2 focus:ring-[#6B46FF]/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="SI">Si</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Lista de Precios</h3>
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5">
                  <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">{totalRecords} precios</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Codigo</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Nombre</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">ZONA PROPIA</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginatedListaPrecios.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <p className="text-sm font-medium text-gray-900">No se encontraron listas de precios</p>
                          <p className="mt-1 text-sm text-gray-500">Intenta ajustar los filtros de búsqueda</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedListaPrecios.map((precio, index) => (
                      <tr
                        key={precio.id}
                        className={`transition-all hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-transparent ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{precio.codigo}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{precio.nombre}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{precio.zonaPropia ? "SI" : "NO"}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-lg text-gray-600 transition-all hover:bg-purple-100 hover:text-purple-700"
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
                              className="h-9 w-9 rounded-lg text-gray-600 transition-all hover:bg-red-100 hover:text-red-600"
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

            {/* Pagination */}
            <div className="flex flex-col gap-4 border-t border-gray-200 bg-gradient-to-r from-gray-50/50 to-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Total:</span>
                  <span className="rounded-md bg-purple-100 px-2 py-1 font-semibold text-purple-700">{totalRecords}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Páginas:</span>
                  <span className="rounded-md bg-gray-100 px-2 py-1 font-semibold text-gray-700">{totalPages || 1}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="h-8 px-3 text-gray-600 transition-all hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40"
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
                        variant={currentPage === pageNum ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-8 px-3 transition-all ${
                          currentPage === pageNum
                            ? "bg-gradient-to-r from-[#6B46FF] to-[#8B5CF6] text-white shadow-sm"
                            : "text-gray-600 hover:bg-purple-50 hover:text-purple-700"
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
                    className="h-8 px-3 text-gray-600 transition-all hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40"
                  >
                    &gt;&gt;
                  </Button>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
                  <span className="text-sm font-medium text-gray-700">Por página:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="h-8 rounded border-0 bg-transparent text-sm focus:outline-none focus:ring-0"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lista de precios?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la lista de precios{" "}
              <span className="font-semibold text-foreground">
                {precioToDelete?.codigo} - {precioToDelete?.nombre}
              </span>
              ? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPrecioToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

