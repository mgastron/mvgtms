"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Pencil, Trash2, Plus, DollarSign, Filter } from "lucide-react"
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

const fieldLabelClass = "block text-[14px] font-medium text-[#4d5571]"
const filterInputClass =
  "h-10 rounded-xl border border-[#e6eaf4] bg-white text-[14px] font-medium text-[#1f2433] shadow-sm placeholder:font-normal placeholder:text-[#8890a8] focus-visible:border-[#1570ef] focus-visible:ring-2 focus-visible:ring-[#1570ef]/20 focus-visible:ring-offset-0"

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

    // Coordinador no puede acceder a Lista Precios (Sistema)
    if (userProfile === "Coordinador") {
      router.push("/envios")
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
    <div className="min-h-screen bg-[#f7f8fc]">
      <ModernHeader />
      <main className={`px-4 pb-6 pt-3 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px] space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 shrink-0 text-[#1570ef]" aria-hidden />
              <h1 className="text-[34px] font-semibold tracking-tight text-[#1570ef]">Lista Precios</h1>
            </div>
            <Button
              className="h-10 gap-2 rounded-xl bg-[#1459e9] px-5 text-[14px] font-semibold text-white shadow-sm hover:bg-[#114bce]"
              onClick={() => {
                setEditingListaPrecio(null)
                setIsNewListaPrecioModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          </div>

          <div className="rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#1570ef]" aria-hidden />
              <h2 className="text-[18px] font-semibold text-[#1570ef]">Filtros</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>Código</label>
                <Input
                  value={filters.codigo}
                  onChange={(e) => handleFilterChange("codigo", e.target.value)}
                  placeholder="Buscar por código…"
                  className={filterInputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>Nombre</label>
                <Input
                  value={filters.nombre}
                  onChange={(e) => handleFilterChange("nombre", e.target.value)}
                  placeholder="Buscar por nombre…"
                  className={filterInputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>Zona propia</label>
                <Select value={filters.zonaPropia} onValueChange={(value) => handleFilterChange("zonaPropia", value)}>
                  <SelectTrigger className="h-10 text-[14px] font-medium text-[#1f2433]">
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
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e6eaf4] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6eaf4] bg-[#fafbff] px-4 py-3 sm:px-5">
              <h3 className="text-[16px] font-semibold text-[#1f2433]">Listado</h3>
              <div className="flex items-center gap-2 rounded-full border border-[#e6eaf4] bg-white px-3 py-1 text-[13px] font-medium text-[#5d6578]">
                <span className="text-[#1570ef]">{totalRecords}</span>
                <span>precios</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e6eaf4] bg-[#f7f8fc]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Código
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Zona propia
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f8]">
                  {paginatedListaPrecios.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-14 text-center">
                        <div className="mx-auto flex max-w-md flex-col items-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff]">
                            <DollarSign className="h-6 w-6 text-[#1570ef]" aria-hidden />
                          </div>
                          <p className="text-[14px] font-semibold text-[#1f2433]">No se encontraron listas de precios</p>
                          <p className="mt-2 text-[13px] text-[#8890a8]">Probá cambiar los filtros</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedListaPrecios.map((precio, index) => (
                      <tr
                        key={precio.id}
                        className={`transition-colors hover:bg-[#f7faff] ${index % 2 === 0 ? "bg-white" : "bg-[#fafbff]"}`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] text-[#1f2433] sm:px-5">{precio.codigo}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] text-[#1f2433] sm:px-5">{precio.nombre}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] text-[#5d6578] sm:px-5">
                          {precio.zonaPropia ? "Sí" : "No"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-lg text-[#5d6578] hover:bg-[#eef4ff] hover:text-[#1570ef]"
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
                              className="h-9 w-9 rounded-lg text-[#5d6578] hover:bg-red-50 hover:text-red-600"
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

            <div className="flex flex-col gap-3 border-t border-[#e6eaf4] bg-[#fafbff] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#5d6578]">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">Total</span>
                  <span className="rounded-md bg-[#eef4ff] px-2 py-0.5 font-semibold text-[#1459e9]">{totalRecords}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">Páginas</span>
                  <span className="rounded-md border border-[#e6eaf4] bg-white px-2 py-0.5 font-semibold text-[#4d5571]">
                    {totalPages || 1}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-0.5 rounded-xl border border-[#e6eaf4] bg-white p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="h-8 px-2.5 text-[13px] text-[#5d6578] hover:bg-[#eef4ff] hover:text-[#1459e9] disabled:opacity-40"
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
                            ? "bg-[#1459e9] text-white shadow-sm hover:bg-[#114bce] hover:text-white"
                            : "text-[#5d6578] hover:bg-[#eef4ff] hover:text-[#1459e9]"
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
                    className="h-8 px-2.5 text-[13px] text-[#5d6578] hover:bg-[#eef4ff] hover:text-[#1459e9] disabled:opacity-40"
                  >
                    &gt;&gt;
                  </Button>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-[#e6eaf4] bg-white px-2.5 py-1">
                  <span className="text-[13px] font-medium text-[#4d5571]">Por página</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(v) => {
                      setItemsPerPage(Number(v))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-14 border-0 bg-transparent text-[13px] font-semibold text-[#1459e9] shadow-none focus:ring-0">
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
      </main>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className={montserrat.className}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-[#1f2433]">¿Eliminar lista de precios?</AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] leading-relaxed text-[#5d6578]">
              ¿Estás seguro de que deseas eliminar la lista de precios{" "}
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

