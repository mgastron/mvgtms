"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { ClientsTable } from "@/components/clients-table"
import { FilterSection } from "@/components/filter-section"
import { NewClientModal } from "@/components/new-client-modal"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl } from "@/lib/api-config"
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
      router.push("/chofer")
      return
    }
  }, [router])
  const [filters, setFilters] = useState({
    codigo: "",
    nombreFantasia: "",
    integraciones: "",
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<any>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newClient, setNewClient] = useState<any>(null)
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  })

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleClearFilters = () => {
    setFilters({
      codigo: "",
      nombreFantasia: "",
      integraciones: "",
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
          console.log("Cliente actualizado en el backend:", updatedClient)
          console.log("Token API del cliente actualizado:", updatedClient.integraciones)
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
        console.warn("Backend no disponible para actualizar cliente:", fetchError)
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
      // Crear nuevo cliente
      // Verificar si el código ya existe en el backend
      let codeExists = false
      let backendAvailable = false

      try {
        const checkResponse = await fetch(
          `${getApiBaseUrl()}/clientes?codigo=${encodeURIComponent(clientData.codigo)}&size=1`
        )
        if (checkResponse.ok) {
          backendAvailable = true
          const checkData = await checkResponse.json()
          if (checkData.content && checkData.content.length > 0) {
            codeExists = true
          }
        }
      } catch (checkError) {
        // Backend no disponible, se verificará en la lista local
        console.warn("Backend no disponible para verificar código")
      }

      // Si el código ya existe en el backend, lanzar error
      if (codeExists) {
        throw new Error("Ya existe un cliente con ese código")
      }

      // Si el backend está disponible, intentar crear
      if (backendAvailable) {
        try {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/clientes`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(clientData),
          })

          if (response.ok) {
            const createdClient = await response.json()
            console.log("Cliente creado en el backend:", createdClient)
            console.log("Token API del cliente creado:", createdClient.integraciones)
            setNewClient(createdClient)
            return
          } else {
            const errorData = await response.json().catch(() => ({}))
            // Si el error es por código duplicado
            if (response.status === 400 || response.status === 409) {
              throw new Error("Ya existe un cliente con ese código")
            }
            throw new Error(errorData.message || `Error del servidor: ${response.status}`)
          }
        } catch (fetchError: any) {
          // Si el error es por código duplicado, relanzarlo
          if (fetchError.message && fetchError.message.includes("código")) {
            throw fetchError
          }
          throw fetchError
        }
      } else {
        // Si el backend no está disponible, pasar el cliente a la tabla para que verifique localmente
        // La tabla verificará si el código ya existe antes de agregarlo
        setNewClient({
          codigo: clientData.codigo,
          nombreFantasia: clientData.nombreFantasia || "",
          razonSocial: "",
          numDoc: "",
          habilitado: clientData.habilitado !== undefined ? clientData.habilitado : true,
          integraciones: clientData.integraciones || null,
          listaPreciosId: clientData.listaPreciosId || null,
          // Campos de integraciones
          flexIdVendedor: clientData.flexIdVendedor || null,
          flexUsername: clientData.flexUsername || null,
          tiendanubeUrl: clientData.tiendanubeUrl || null,
          shopifyUrl: clientData.shopifyUrl || null,
          shopifyClaveUnica: clientData.shopifyClaveUnica || null,
          vtexUrl: clientData.vtexUrl || null,
          vtexKey: clientData.vtexKey || null,
          vtexToken: clientData.vtexToken || null,
          vtexIdLogistica: clientData.vtexIdLogistica || null,
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50" suppressHydrationWarning>
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">Clientes</h1>
                <p className="mt-1 text-sm text-gray-500">Gestiona tus clientes y sus integraciones</p>
              </div>
            </div>
            <Button
              className="gap-2 bg-gradient-to-r from-[#6B46FF] to-[#8B5CF6] shadow-lg shadow-purple-500/30 hover:from-[#5a3ad6] hover:to-[#7c4dd4] transition-all duration-200"
              onClick={() => {
                setEditingClient(null)
                setIsModalOpen(true)
              }}
            >
              <UserPlus className="h-5 w-5" />
              Nuevo Cliente
            </Button>
          </div>

          {/* Filter Section */}
          <FilterSection filters={filters} onFilterChange={handleFilterChange} />

          {/* Table */}
          <ClientsTable
            filters={filters}
            newClient={newClient}
            onClientAdded={() => setNewClient(null)}
            refreshTrigger={refreshKey}
            onClientError={(error) => {
              setErrorDialog({ open: true, message: error })
              // Limpiar newClient después de un pequeño delay para evitar el error de React
              setTimeout(() => setNewClient(null), 0)
            }}
            onEditClient={(client) => {
              setEditingClient(client)
              setIsModalOpen(true)
            }}
          />

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
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Error al crear cliente</AlertDialogTitle>
                <AlertDialogDescription>{errorDialog.message}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setErrorDialog({ open: false, message: "" })}>
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

