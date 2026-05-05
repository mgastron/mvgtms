"use client"

import { Pencil, Trash2, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev, errorDev } from "@/lib/logger"
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
import { useState, useMemo, useEffect } from "react"

import type { FiltroIntegracionCliente } from "@/components/filter-section"

interface Client {
  id?: number
  codigo: string
  nombreFantasia: string
  razonSocial: string
  numDoc: string
  habilitado: boolean
  tokenApi?: string
  listaPreciosId?: number
  grupoId?: number | null
  grupoNombre?: string
  flexIdVendedor?: string
  flexUsername?: string
  tiendanubeUrl?: string
  tiendanubeMetodoEnvio?: string
  tiendanubeAccessToken?: string
  tiendanubeStoreId?: string
  shopifyUrl?: string
  shopifyClaveUnica?: string
  vtexUrl?: string
  vtexKey?: string
  vtexToken?: string
  vtexIdLogistica?: string
}

function hasFlexConfigured(c: Client): boolean {
  return !!(String(c.flexIdVendedor || "").trim() || String(c.flexUsername || "").trim())
}

function hasTiendaNubeConfigured(c: Client): boolean {
  return !!(
    String(c.tiendanubeUrl || "").trim() ||
    String(c.tiendanubeAccessToken || "").trim() ||
    String(c.tiendanubeStoreId || "").trim()
  )
}

function hasShopifyConfigured(c: Client): boolean {
  return !!(String(c.shopifyUrl || "").trim() || String(c.shopifyClaveUnica || "").trim())
}

function hasVtexConfigured(c: Client): boolean {
  return !!(
    String(c.vtexUrl || "").trim() ||
    String(c.vtexKey || "").trim() ||
    String(c.vtexToken || "").trim() ||
    String(c.vtexIdLogistica || "").trim()
  )
}

/** Coincide con los valores del `Select` en `FilterSection` (solo clientes con esa integración configurada). */
export function clientMatchesIntegracionFiltro(client: Client, modo: string): boolean {
  const m = (modo || "todos") as FiltroIntegracionCliente
  if (m === "todos") return true
  switch (m) {
    case "flex":
      return hasFlexConfigured(client)
    case "tiendanube":
      return hasTiendaNubeConfigured(client)
    case "shopify":
      return hasShopifyConfigured(client)
    case "vtex":
      return hasVtexConfigured(client)
    default:
      return true
  }
}

interface ClientsTableProps {
  filters: {
    nombreFantasia: string
    grupoId: string
    integraciones?: string
    razonSocial?: string
    numeroDocumento?: string
    habilitado?: string
  }
  newClient?: any
  onClientAdded?: () => void
  refreshTrigger?: number
  onClientError?: (error: string) => void
  onEditClient?: (client: Client) => void
}

export function ClientsTable({
  filters,
  newClient,
  onClientAdded,
  refreshTrigger,
  onClientError,
  onEditClient,
}: ClientsTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [clients, setClients] = useState<Client[]>([])
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Cargar clientes solo desde el backend (sin localStorage)
  const loadClientsFromBackend = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("tms_clientes")
      }
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/clientes?size=100`)
      if (response.ok) {
        const data = await response.json()
        const content = data.content || []
        const backendClients: Client[] = content.map((c: any) => ({
          id: c.id,
          codigo: c.codigo,
          nombreFantasia: c.nombreFantasia || "",
          razonSocial: c.razonSocial || "",
          numDoc: c.numeroDocumento || "",
          habilitado: c.habilitado !== undefined ? c.habilitado : true,
          tokenApi: c.integraciones || "",
          listaPreciosId: c.listaPreciosId || undefined,
          grupoId: c.grupoId ?? undefined,
          grupoNombre: c.grupoNombre || "",
          flexIdVendedor: c.flexIdVendedor || "",
          flexUsername: c.flexUsername || "",
          tiendanubeUrl: c.tiendanubeUrl || "",
          tiendanubeMetodoEnvio: c.tiendanubeMetodoEnvio || "",
          tiendanubeAccessToken: c.tiendanubeAccessToken || "",
          tiendanubeStoreId: c.tiendanubeStoreId || "",
          shopifyUrl: c.shopifyUrl || "",
          shopifyClaveUnica: c.shopifyClaveUnica || "",
          vtexUrl: c.vtexUrl || "",
          vtexKey: c.vtexKey || "",
          vtexToken: c.vtexToken || "",
          vtexIdLogistica: c.vtexIdLogistica || "",
        }))
        setClients(backendClients)
      } else {
        setClients([])
      }
    } catch (error) {
      warnDev("No se pudo cargar clientes del backend:", error)
      setClients([])
    }
  }

  useEffect(() => {
    loadClientsFromBackend()
  }, [refreshTrigger])

  // Agregar o actualizar cliente cuando se crea o edita uno
  useEffect(() => {
    if (newClient) {
      // Convertir el cliente del backend al formato local
      const clientToAdd: Client = {
        id: newClient.id,
        codigo: newClient.codigo,
        nombreFantasia: newClient.nombreFantasia || "",
        razonSocial: newClient.razonSocial || "",
        numDoc: newClient.numeroDocumento || "",
        habilitado: newClient.habilitado !== undefined ? newClient.habilitado : true,
        tokenApi: newClient.integraciones || "",
        listaPreciosId: newClient.listaPreciosId || undefined,
        grupoId: newClient.grupoId ?? undefined,
        grupoNombre: newClient.grupoNombre || "",
        flexIdVendedor: newClient.flexIdVendedor || "",
        flexUsername: newClient.flexUsername || "",
        tiendanubeUrl: newClient.tiendanubeUrl || "",
        shopifyUrl: newClient.shopifyUrl || "",
        shopifyClaveUnica: newClient.shopifyClaveUnica || "",
        vtexUrl: newClient.vtexUrl || "",
        vtexKey: newClient.vtexKey || "",
        vtexToken: newClient.vtexToken || "",
        vtexIdLogistica: newClient.vtexIdLogistica || "",
      }

      // Verificar si es una actualización (tiene ID y ya existe en la lista)
      setClients((prevClients) => {
        if (clientToAdd.id) {
          const existingIndex = prevClients.findIndex((c) => c.id === clientToAdd.id)
          if (existingIndex !== -1) {
            // Actualizar cliente existente
            const updated = [...prevClients]
            updated[existingIndex] = clientToAdd
            requestAnimationFrame(() => {
              if (onClientAdded) {
                onClientAdded()
              }
            })
            return updated
          }
        }

        // Si no es actualización, verificar que no exista ya (por código) - comparación case-insensitive
        // Excluir el cliente actual si tiene ID (para evitar falsos positivos al actualizar)
        const exists = prevClients.some(
          (c) =>
            c.id !== clientToAdd.id &&
            c.grupoId === clientToAdd.grupoId &&
            (c.nombreFantasia || "").trim().toLowerCase() === (clientToAdd.nombreFantasia || "").trim().toLowerCase()
        )
        if (exists) {
          // Si ya existe, programar la notificación de error después del render
          requestAnimationFrame(() => {
            if (onClientError) {
              onClientError("Ya existe un vendedor con ese nombre en el mismo grupo.")
            }
            if (onClientAdded) {
              onClientAdded()
            }
          })
          return prevClients
        }
        // Agregar al principio de la lista para que aparezca primero
        // Programar la notificación de éxito después del render
        requestAnimationFrame(() => {
          if (onClientAdded) {
            onClientAdded()
          }
        })
        return [clientToAdd, ...prevClients]
      })
    }
  }, [newClient, onClientAdded, onClientError])

  // Filtrar clientes según los filtros aplicados y ordenar por código
  const filteredClients = useMemo(() => {
    const filtered = clients.filter((client) => {
      if (
        filters.nombreFantasia &&
        !client.nombreFantasia.toLowerCase().includes(filters.nombreFantasia.toLowerCase())
      ) {
        return false
      }

      if (filters.grupoId && String(client.grupoId ?? "") !== filters.grupoId) {
        return false
      }

      if (!clientMatchesIntegracionFiltro(client, filters.integraciones ?? "todos")) {
        return false
      }

      return true
    })
    return [...filtered].sort((a, b) =>
      (a.nombreFantasia || "").localeCompare(b.nombreFantasia || "", "es", { sensitivity: "base" })
    )
  }, [filters, clients])

  // Calcular paginación
  const totalRecords = filteredClients.length
  const totalPages = Math.ceil(totalRecords / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedClients = filteredClients.slice(startIndex, endIndex)

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  // Función para abrir el diálogo de confirmación
  const handleDeleteClick = (client: Client) => {
    setClientToDelete(client)
    setIsDeleteDialogOpen(true)
  }

  // Función para confirmar la eliminación
  const handleConfirmDelete = async () => {
    if (!clientToDelete) return

    setIsDeleting(true)

    try {
      let clientId = clientToDelete.id
      let backendAvailable = false

      // Intentar eliminar en el backend si hay ID o si podemos buscarlo
      if (clientId) {
        // Si ya tenemos el ID, intentar eliminar directamente
        try {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/clientes/${clientId}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
          })

          if (response.ok) {
            backendAvailable = true
          } else if (response.status === 404) {
            // Cliente no encontrado en el backend, continuar con eliminación local
            warnDev("Cliente no encontrado en el backend")
          } else {
            throw new Error(`Error del servidor: ${response.status}`)
          }
        } catch (fetchError) {
          // Si el backend no está disponible, continuar con eliminación local
          warnDev("Backend no disponible, eliminando solo del estado local:", fetchError)
        }
      } else {
        // Si no hay ID, intentar buscar el cliente por código
        try {
          const apiBaseUrl = getApiBaseUrl()
          const searchResponse = await fetch(
            `${apiBaseUrl}/clientes?codigo=${encodeURIComponent(clientToDelete.codigo)}&size=1`,
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
          )

          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            if (searchData.content && searchData.content.length > 0) {
              clientId = searchData.content[0].id

              // Intentar eliminar con el ID encontrado
              const deleteResponse = await fetch(`${apiBaseUrl}/clientes/${clientId}`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                },
              })

              if (deleteResponse.ok) {
                backendAvailable = true
              }
            }
          }
        } catch (fetchError) {
          // Si el backend no está disponible, continuar con eliminación local
          warnDev("Backend no disponible, eliminando solo del estado local:", fetchError)
        }
      }

      // Siempre eliminar del estado local (funciona con o sin backend)
      setClients((prevClients) => {
        const updatedClients = prevClients.filter((c) => c.id !== clientToDelete.id)
        
        // Ajustar la página si es necesario
        const filteredAfterDelete = updatedClients.filter((client: Client) => {
          if (filters.grupoId && String(client.grupoId ?? "") !== filters.grupoId) return false
          if (filters.nombreFantasia && !client.nombreFantasia.toLowerCase().includes(filters.nombreFantasia.toLowerCase())) return false
          if (filters.razonSocial && !client.razonSocial.toLowerCase().includes(filters.razonSocial.toLowerCase())) return false
          if (filters.numeroDocumento && !client.numDoc.includes(filters.numeroDocumento)) return false
          if (filters.habilitado === "habilitado" && !client.habilitado) return false
          if (filters.habilitado === "deshabilitado" && client.habilitado) return false
          if (!clientMatchesIntegracionFiltro(client, filters.integraciones ?? "todos")) return false
          return true
        })
        
        const totalPagesAfterDelete = Math.ceil(filteredAfterDelete.length / itemsPerPage)
        if (currentPage > totalPagesAfterDelete && totalPagesAfterDelete > 0) {
          setCurrentPage(totalPagesAfterDelete)
        }
        
        return updatedClients
      })
      setClientToDelete(null)
      setIsDeleteDialogOpen(false)

      if (backendAvailable) {
        // Refrescar la lista desde el backend para mantener consistencia
        loadClientsFromBackend()
      } else {
        alert(
          "El vendedor se quitó de la lista pero no se pudo eliminar en el servidor. " +
            "Al actualizar podría reaparecer. Comprobá que el backend esté accesible."
        )
        loadClientsFromBackend()
      }
    } catch (error) {
      errorDev("Error inesperado al eliminar cliente:", error)
      alert("Error al eliminar el vendedor. Por favor, intente nuevamente.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e6eaf4] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6eaf4] bg-[#fafbff] px-4 py-3 sm:px-5">
        <h3 className="text-[16px] font-semibold text-[#1f2433]">Listado</h3>
        <div className="flex items-center gap-2 rounded-full border border-[#e6eaf4] bg-white px-3 py-1 text-[13px] font-medium text-[#5d6578]">
          <span className="text-[#1570ef]">{totalRecords}</span>
          <span>{totalRecords === 1 ? "vendedor" : "vendedores"}</span>
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
                Grupo
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef1f8]">
            {paginatedClients.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-14 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff]">
                      <Inbox className="h-6 w-6 text-[#1570ef]" aria-hidden />
                    </div>
                    <p className="text-[14px] font-semibold text-[#1f2433]">No se encontraron vendedores</p>
                    <p className="mt-2 text-[13px] text-[#8890a8]">Probá cambiar los filtros</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedClients.map((client, index) => (
                <tr
                  key={client.id != null ? `c-${client.id}` : client.codigo}
                  className={`transition-colors hover:bg-[#f7faff] ${index % 2 === 0 ? "bg-white" : "bg-[#fafbff]"}`}
                >
                  <td className="px-4 py-3 text-[14px] text-[#1f2433] sm:px-5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef4ff] text-[12px] font-bold text-[#1459e9]">
                        {(client.nombreFantasia || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{client.nombreFantasia || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[14px] text-[#5d6578] sm:px-5">{client.grupoNombre || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-[#5d6578] hover:bg-[#eef4ff] hover:text-[#1570ef]"
                        onClick={() => onEditClient && onEditClient(client)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-[#5d6578] hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleDeleteClick(client)}
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
              onValueChange={(value) => {
                setItemsPerPage(Number(value))
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

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-[#1f2433]">¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] leading-relaxed text-[#5d6578]">
              ¿Estás seguro de que deseas eliminar al cliente{" "}
              <span className="font-semibold text-[#1f2433]">
                {clientToDelete?.nombreFantasia || clientToDelete?.codigo}
              </span>
              ? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

