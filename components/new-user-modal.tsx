"use client"

import { useState, useEffect } from "react"
import { X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiBaseUrl } from "@/lib/api-config"

interface NewUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (userData: any) => void
  editingUser?: {
    id: number
    nombre: string
    apellido: string
    usuario: string
    perfil: string
    contraseña: string
    codigoCliente?: string
  } | null
}

export function NewUserModal({ isOpen, onClose, onSave, editingUser }: NewUserModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    tipoUsuario: "",
    usuario: "",
    contraseña: "",
    codigoCliente: "",
  })
  const [clients, setClients] = useState<Array<{ codigo: string; nombreFantasia: string }>>([])
  const [loadingClients, setLoadingClients] = useState(false)

  const totalSteps = 3
  const isEditing = !!editingUser

  // Cargar clientes desde el backend cuando se abre el modal o cuando cambia el tipo de usuario a "Cliente"
  const tipoUsuario = formData.tipoUsuario
  useEffect(() => {
    if (!isOpen) {
      // Resetear la lista cuando se cierra el modal
      setClients([])
      return
    }

    if (tipoUsuario === "Cliente") {
      const loadClients = async () => {
        setLoadingClients(true)
        try {
          const apiBaseUrl = getApiBaseUrl()
          console.log("Cargando clientes desde:", apiBaseUrl)
          const response = await fetch(`${apiBaseUrl}/clientes?size=1000`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log("Respuesta del backend de clientes:", data)
            
            if (data.content && Array.isArray(data.content) && data.content.length > 0) {
              const clientesList = data.content.map((c: any) => ({
                codigo: c.codigo || "",
                nombreFantasia: c.nombreFantasia || "",
              })).filter((c: any) => c.codigo) // Filtrar clientes sin código
              
              console.log("Clientes cargados del backend:", clientesList.length, "clientes")
              setClients(clientesList)
            } else {
              console.warn("El backend respondió pero no hay clientes en data.content o está vacío")
              setClients([])
            }
          } else {
            const errorText = await response.text()
            console.error("Error del backend:", response.status, response.statusText, errorText)
            setClients([])
            alert(`Error al cargar clientes: ${response.status} ${response.statusText}`)
          }
        } catch (error) {
          console.error("Error al cargar clientes del backend:", error)
          setClients([])
          alert("No se pudo cargar la lista de clientes. Asegúrate de que el backend esté accesible.")
        } finally {
          setLoadingClients(false)
        }
      }
      
      loadClients()
    } else {
      // Si no es Cliente, limpiar la lista de clientes
      setClients([])
      setLoadingClients(false)
    }
  }, [isOpen, tipoUsuario])

  // Cargar datos del usuario cuando se abre el modal para editar
  useEffect(() => {
    if (isOpen && editingUser) {
      setFormData({
        nombre: editingUser.nombre || "",
        apellido: editingUser.apellido || "",
        tipoUsuario: editingUser.perfil || "",
        usuario: editingUser.usuario || "",
        contraseña: editingUser.contraseña || "",
        codigoCliente: (editingUser as any).codigoCliente || "",
      })
      // Si estamos editando, empezar desde el paso 1 pero mostrar todos los datos
      setCurrentStep(1)
    } else if (isOpen && !editingUser) {
      // Resetear formulario cuando se abre para crear nuevo usuario
      setFormData({
        nombre: "",
        apellido: "",
        tipoUsuario: "",
        usuario: "",
        contraseña: "",
        codigoCliente: "",
      })
      setCurrentStep(1)
    }
  }, [isOpen, editingUser])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    if (currentStep === 1) {
      // Validar que nombre y apellido estén completos
      if (!formData.nombre.trim() || !formData.apellido.trim()) {
        return
      }
    }
    if (currentStep === 2) {
      // Validar que se haya seleccionado un tipo de usuario
      if (!formData.tipoUsuario) {
        return
      }
      // Si es tipo Cliente, validar que se haya seleccionado un código de cliente
      if (formData.tipoUsuario === "Cliente" && !formData.codigoCliente) {
        return
      }
    }
    if (currentStep === 3) {
      // Validar que usuario y contraseña estén completos
      if (!formData.usuario.trim() || !formData.contraseña.trim()) {
        return
      }
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleClose = () => {
    setCurrentStep(1)
    setFormData({
      nombre: "",
      apellido: "",
      tipoUsuario: "",
      usuario: "",
      contraseña: "",
      codigoCliente: "",
    })
    onClose()
  }

  if (!isOpen) return null

  const getStepLabel = (step: number) => {
    switch (step) {
      case 1:
        return "Información"
      case 2:
        return "Tipo de usuario"
      case 3:
        return "Usuario y contra..."
      default:
        return ""
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header con indicador de pasos */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">{isEditing ? "Editar Usuario" : "Nuevo Usuario"}</h2>
            <button
              onClick={handleClose}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Indicador de pasos */}
          <div className="mt-4 flex items-center justify-between">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
              <div key={step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      step === currentStep
                        ? "border-[#6B46FF] bg-[#6B46FF] text-white"
                        : step < currentStep
                        ? "border-[#6B46FF] bg-[#6B46FF] text-white"
                        : "border-gray-300 bg-white text-gray-400"
                    }`}
                  >
                    {step < currentStep ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{step}</span>
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      step === currentStep ? "text-[#6B46FF]" : step < currentStep ? "text-[#6B46FF]" : "text-gray-400"
                    }`}
                  >
                    {getStepLabel(step)}
                  </span>
                </div>
                {step < totalSteps && (
                  <div
                    className={`mx-2 h-0.5 flex-1 ${
                      step < currentStep ? "bg-[#6B46FF]" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contenido del modal */}
        <div className="p-6">
          {/* Paso 1: Información */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre: <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => handleInputChange("nombre", e.target.value)}
                    placeholder="Nombre"
                    className="h-10 rounded-lg border-gray-300 focus:border-[#6B46FF] focus:ring-2 focus:ring-[#6B46FF]/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Apellido: <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.apellido}
                    onChange={(e) => handleInputChange("apellido", e.target.value)}
                    placeholder="Apellido"
                    className="h-10 rounded-lg border-gray-300 focus:border-[#6B46FF] focus:ring-2 focus:ring-[#6B46FF]/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Paso 2: Tipo de usuario */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Seleccione el tipo de usuario que quiere crear</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Tipo de usuario: <span className="text-red-500">*</span>
                  </label>
                  <Select value={formData.tipoUsuario} onValueChange={(value) => handleInputChange("tipoUsuario", value)}>
                    <SelectTrigger className="h-10 rounded-lg border-2 border-[#6B46FF] bg-white text-gray-600 focus:ring-2 focus:ring-[#6B46FF]/20">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrativo">Administrativo</SelectItem>
                      <SelectItem value="Cliente">Cliente</SelectItem>
                      <SelectItem value="Chofer">Chofer</SelectItem>
                      <SelectItem value="Coordinador">Coordinador</SelectItem>
                      <SelectItem value="Logística Externa">Logística Externa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Selector de cliente cuando se selecciona tipo "Cliente" */}
                {formData.tipoUsuario === "Cliente" && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Código de usuario: <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.codigoCliente}
                      onValueChange={(value) => handleInputChange("codigoCliente", value)}
                    >
                      <SelectTrigger className="h-10 rounded-lg border-2 border-[#6B46FF] bg-white text-gray-600 focus:ring-2 focus:ring-[#6B46FF]/20">
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingClients ? (
                          <div className="px-2 py-1.5 text-sm text-gray-500">Cargando clientes...</div>
                        ) : clients.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-gray-500">No hay clientes disponibles</div>
                        ) : (
                          clients.map((client) => (
                            <SelectItem key={client.codigo} value={client.codigo}>
                              {client.codigo} - {client.nombreFantasia}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Paso 3: Usuario y contraseña */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Cree el usuario y contraseña</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Usuario: <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.usuario}
                    onChange={(e) => handleInputChange("usuario", e.target.value)}
                    placeholder="Usuario"
                    className="h-10 rounded-lg border-gray-300 focus:border-[#6B46FF] focus:ring-2 focus:ring-[#6B46FF]/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Contraseña: <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="password"
                    value={formData.contraseña}
                    onChange={(e) => handleInputChange("contraseña", e.target.value)}
                    placeholder="Contraseña"
                    className="h-10 rounded-lg border-gray-300 focus:border-[#6B46FF] focus:ring-2 focus:ring-[#6B46FF]/20"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            CERRAR
          </Button>
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={handlePrevious}
              className="border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
            >
              ANTERIOR
            </Button>
          )}
          {currentStep < totalSteps ? (
            <Button
              onClick={handleNext}
              disabled={
                (currentStep === 1 && (!formData.nombre.trim() || !formData.apellido.trim())) ||
                (currentStep === 2 && (!formData.tipoUsuario || (formData.tipoUsuario === "Cliente" && !formData.codigoCliente))) ||
                (currentStep === 3 && (!formData.usuario.trim() || !formData.contraseña.trim()))
              }
              className="bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
            >
              SIGUIENTE
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (onSave) {
                  onSave({
                    ...formData,
                    id: editingUser?.id,
                  })
                }
                handleClose()
              }}
              disabled={!formData.usuario.trim() || !formData.contraseña.trim()}
              className="bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
            >
              GUARDAR
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

