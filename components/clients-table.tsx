"use client"

import { Pencil, Trash2 } from "lucide-react"
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

interface Client {
  id?: number
  codigo: string
  nombreFantasia: string
  razonSocial: string
  numDoc: string
  habilitado: boolean
  tokenApi?: string
  listaPreciosId?: number
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

interface ClientsTableProps {
  filters: {
    codigo: string
    nombreFantasia: string
    integraciones: string
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
            c.id !== clientToAdd.id && // Excluir el mismo cliente si tiene ID
            c.codigo.toLowerCase().trim() === clientToAdd.codigo.toLowerCase().trim()
        )
        if (exists) {
          // Si ya existe, programar la notificación de error después del render
          requestAnimationFrame(() => {
            if (onClientError) {
              onClientError("Ya existe un cliente con ese código")
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

  // Filtrar clientes según los filtros aplicados
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      // Filtro por código
      if (filters.codigo && !client.codigo.toLowerCase().includes(filters.codigo.toLowerCase())) {
        return false
      }

      // Filtro por nombre fantasía
      if (
        filters.nombreFantasia &&
        !client.nombreFantasia.toLowerCase().includes(filters.nombreFantasia.toLowerCase())
      ) {
        return false
      }

      // Filtro por integraciones (si el cliente tiene integraciones en el campo correspondiente)
      // Nota: Este filtro se aplicaría si tuviéramos un campo de integraciones en el cliente
      // Por ahora lo dejamos como placeholder

      return true
    })
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
        const updatedClients = prevClients.filter((c) => c.codigo !== clientToDelete.codigo)
        
        // Ajustar la página si es necesario
        const filteredAfterDelete = updatedClients.filter((client: Client) => {
          if (filters.codigo && !client.codigo.toLowerCase().includes(filters.codigo.toLowerCase())) return false
          if (filters.nombreFantasia && !client.nombreFantasia.toLowerCase().includes(filters.nombreFantasia.toLowerCase())) return false
          if (filters.razonSocial && !client.razonSocial.toLowerCase().includes(filters.razonSocial.toLowerCase())) return false
          if (filters.numeroDocumento && !client.numDoc.includes(filters.numeroDocumento)) return false
          if (filters.habilitado === "habilitado" && !client.habilitado) return false
          if (filters.habilitado === "deshabilitado" && client.habilitado) return false
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
          "El cliente se quitó de la lista pero no se pudo eliminar en el servidor. " +
            "Al actualizar podría reaparecer. Comprobá que el backend esté accesible en api.mvgtms.com.ar"
        )
        loadClientsFromBackend()
      }
    } catch (error) {
      errorDev("Error inesperado al eliminar cliente:", error)
      alert("Error al eliminar el cliente. Por favor, intenta nuevamente.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Lista de Clientes</h3>
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5">
            <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">{totalRecords} clientes</span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                Código
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                Nombre Fantasía
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-700">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {paginatedClients.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                      <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900">No se encontraron clientes</p>
                    <p className="mt-1 text-sm text-gray-500">Intenta ajustar los filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedClients.map((client, index) => (
                <tr
                  key={client.codigo}
                  className="transition-all hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-transparent"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6B46FF] to-[#8B5CF6] text-xs font-bold text-white shadow-sm">
                        {client.codigo.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{client.codigo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">{client.nombreFantasia || "-"}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-gray-600 transition-all hover:bg-purple-100 hover:text-purple-700"
                        onClick={() => onEditClient && onEditClient(client)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-gray-600 transition-all hover:bg-red-100 hover:text-red-600"
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
            <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
              <SelectTrigger className="h-8 w-16 border-0 bg-transparent shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
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
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar al cliente{" "}
              <span className="font-semibold text-foreground">
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

