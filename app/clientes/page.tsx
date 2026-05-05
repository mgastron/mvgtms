"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Montserrat } from "next/font/google"
import { ModernHeader } from "@/components/modern-header"
import { ClientsTable } from "@/components/clients-table"
import { FilterSection } from "@/components/filter-section"
import { NewClientModal } from "@/components/new-client-modal"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})
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
    <div className="min-h-screen bg-[#f7f8fc]" suppressHydrationWarning>
      <ModernHeader />

      <main className={`px-4 pb-6 pt-3 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px] space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-[34px] font-semibold tracking-tight text-[#1570ef]">Vendedores</h1>
            <Button
              className="h-10 gap-2 rounded-xl bg-[#1459e9] px-5 text-[14px] font-semibold text-white shadow-sm hover:bg-[#114bce]"
              onClick={() => {
                setEditingClient(null)
                setIsModalOpen(true)
              }}
            >
              <UserPlus className="h-4 w-4" />
              Nuevo vendedor
            </Button>
          </div>

          <FilterSection
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />

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

