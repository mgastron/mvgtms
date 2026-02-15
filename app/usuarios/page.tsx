"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Pencil, Trash2, UserPlus, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NewUserModal } from "@/components/new-user-modal"
import { getApiBaseUrl } from "@/lib/api-config"
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

interface User {
  id: number
  nombre: string
  apellido: string
  usuario: string
  perfil: string
  contraseña: string
  codigoCliente?: string
  habilitado: boolean
  bloqueado: boolean
}

const mockUsers: User[] = [
  {
    id: 1,
    nombre: "iseul",
    apellido: "market",
    usuario: "iseulmarket",
    perfil: "Cliente",
    contraseña: "pass123",
    habilitado: true,
    bloqueado: false,
  },
  {
    id: 2,
    nombre: "andres",
    apellido: "torres",
    usuario: "andrestorres",
    perfil: "Chofer",
    contraseña: "pass456",
    habilitado: true,
    bloqueado: false,
  },
  {
    id: 3,
    nombre: "mauro",
    apellido: "coria",
    usuario: "maurocoria",
    perfil: "Chofer",
    contraseña: "pass789",
    habilitado: true,
    bloqueado: false,
  },
  {
    id: 4,
    nombre: "fernando",
    apellido: "bautier",
    usuario: "fernandobautier",
    perfil: "Chofer",
    contraseña: "pass101",
    habilitado: true,
    bloqueado: false,
  },
  {
    id: 5,
    nombre: "ignacio",
    apellido: "folgar",
    usuario: "nachofolgar",
    perfil: "Chofer",
    contraseña: "pass202",
    habilitado: true,
    bloqueado: false,
  },
  {
    id: 6,
    nombre: "jonathan",
    apellido: "vargas",
    usuario: "jonathanvargas",
    perfil: "Chofer",
    contraseña: "pass303",
    habilitado: true,
    bloqueado: false,
  },
  {
    id: 7,
    nombre: "osta",
    apellido: "el que reparte",
    usuario: "osta",
    perfil: "Chofer",
    contraseña: "pass404",
    habilitado: true,
    bloqueado: false,
  },
  {
    id: 8,
    nombre: "smud",
    apellido: "smud",
    usuario: "smudchofer",
    perfil: "Chofer",
    contraseña: "pass505",
    habilitado: true,
    bloqueado: false,
  },
  {
    id: 9,
    nombre: "Micaela",
    apellido: "Silva",
    usuario: "Micasilva",
    perfil: "Chofer",
    contraseña: "pass606",
    habilitado: true,
    bloqueado: false,
  },
  {
    id: 10,
    nombre: "Marco",
    apellido: "Torres",
    usuario: "Torres",
    perfil: "Chofer",
    contraseña: "pass707",
    habilitado: true,
    bloqueado: false,
  },
]

export default function UsuariosPage() {
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
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [filters, setFilters] = useState({
    nombre: "",
    apellido: "",
    usuario: "",
    perfil: "Todos",
  })
  const isInitialLoad = useRef(true)

  // Cargar usuarios del backend solo al montar el componente
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl()
        console.log("Cargando usuarios desde:", apiBaseUrl)
        const response = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
        
        if (response.ok) {
          const data = await response.json()
          console.log("Usuarios recibidos del backend:", data.content?.length || 0)
          
          if (data.content && data.content.length > 0) {
            // Convertir los datos del backend al formato de la interfaz User
            const backendUsers: User[] = data.content.map((u: any) => ({
              id: u.id,
              nombre: u.nombre || "",
              apellido: u.apellido || "",
              usuario: u.usuario || "",
              perfil: u.perfil || "",
              contraseña: u.contraseña || u.password || "",
              codigoCliente: u.codigoCliente || undefined,
              habilitado: u.habilitado !== undefined ? u.habilitado : true,
              bloqueado: u.bloqueado !== undefined ? u.bloqueado : false,
            }))
            setUsers(backendUsers)
            // Guardar en localStorage
            localStorage.setItem("tms_usuarios", JSON.stringify(backendUsers))
            isInitialLoad.current = false
            return
          } else {
            console.warn("El backend respondió pero no hay usuarios en data.content")
          }
        } else {
          const errorText = await response.text()
          console.error("Error del backend al cargar usuarios:", response.status, response.statusText, errorText)
        }
      } catch (error: any) {
        console.error("Error al cargar usuarios del backend:", error)
        console.error("Detalles del error:", error.message)
        
        // Si es un error de conexión, mostrar mensaje más claro
        if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
          console.error("⚠️ No se pudo conectar al backend. Verifica que:")
          console.error("1. El backend esté corriendo")
          console.error("2. NEXT_PUBLIC_BACKEND_TUNNEL_URL esté configurado en .env.local")
          console.error("3. El túnel de Cloudflare esté activo")
        }
      }
      
      // Si el backend no tiene datos o no está disponible, intentar cargar de localStorage
      const savedUsers = localStorage.getItem("tms_usuarios")
      if (savedUsers) {
        try {
          const parsedUsers = JSON.parse(savedUsers)
          setUsers(parsedUsers)
        } catch (e) {
          console.warn("Error al parsear usuarios de localStorage:", e)
          // Si hay error, usar datos mock
          setUsers(mockUsers)
        }
      } else {
        // Si no hay datos guardados, usar datos mock
        setUsers(mockUsers)
      }
      isInitialLoad.current = false
    }

    loadUsers()
  }, [])

  // Guardar usuarios en localStorage cada vez que cambien (excepto durante la carga inicial)
  useEffect(() => {
    if (!isInitialLoad.current && users.length > 0) {
      localStorage.setItem("tms_usuarios", JSON.stringify(users))
    }
  }, [users])

  // Filtrar usuarios
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (filters.nombre && !user.nombre.toLowerCase().includes(filters.nombre.toLowerCase())) {
        return false
      }
      if (filters.apellido && !user.apellido.toLowerCase().includes(filters.apellido.toLowerCase())) {
        return false
      }
      if (filters.usuario && !user.usuario.toLowerCase().includes(filters.usuario.toLowerCase())) {
        return false
      }
      if (filters.perfil !== "Todos" && user.perfil !== filters.perfil) {
        return false
      }
      return true
    })
  }, [filters, users])

  // Calcular paginación
  const totalRecords = filteredUsers.length
  const totalPages = Math.ceil(totalRecords / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setCurrentPage(1)
  }

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (userToDelete) {
      try {
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(`${apiBaseUrl}/usuarios/${userToDelete.id}`, {
          method: 'DELETE',
        })

        if (response.ok || response.status === 204) {
          // Eliminar del estado local
          setUsers((prev) => {
            const updatedUsers = prev.filter((u) => u.id !== userToDelete.id)
            // Ajustar la página si es necesario
            const newTotalPages = Math.ceil(updatedUsers.length / itemsPerPage)
            if (currentPage > newTotalPages && newTotalPages > 0) {
              setCurrentPage(newTotalPages)
            }
            return updatedUsers
          })
          setUserToDelete(null)
          setIsDeleteDialogOpen(false)
        } else {
          const error = await response.json()
          alert(`Error al eliminar usuario: ${error.message || 'Error desconocido'}`)
        }
      } catch (error: any) {
        console.error('Error al eliminar usuario:', error)
        alert(`Error al eliminar usuario: ${error.message || 'Error de conexión. Verifica que el backend esté corriendo.'}`)
      }
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
                <UserPlus className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">Usuarios</h1>
                <p className="mt-1 text-sm text-gray-500">Gestiona los usuarios del sistema</p>
              </div>
            </div>
            <Button
              className="gap-2 bg-gradient-to-r from-[#6B46FF] to-[#8B5CF6] shadow-lg shadow-purple-500/30 hover:from-[#5a3ad6] hover:to-[#7c4dd4] transition-all duration-200"
              onClick={() => {
                setEditingUser(null)
                setIsNewUserModalOpen(true)
              }}
            >
              <UserPlus className="h-5 w-5" />
              Nuevo
            </Button>
          </div>

          {/* Filter Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6B46FF] to-[#8B5CF6]">
                  <Filter className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Filtros de búsqueda</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
                  <label className="block text-sm font-medium text-gray-700">Apellido</label>
                  <Input
                    value={filters.apellido}
                    onChange={(e) => handleFilterChange("apellido", e.target.value)}
                    placeholder="Buscar por apellido..."
                    className="h-10 rounded-lg border-gray-300 bg-gray-50 transition-all focus:border-[#6B46FF] focus:bg-white focus:ring-2 focus:ring-[#6B46FF]/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Usuario</label>
                  <Input
                    value={filters.usuario}
                    onChange={(e) => handleFilterChange("usuario", e.target.value)}
                    placeholder="Buscar por usuario..."
                    className="h-10 rounded-lg border-gray-300 bg-gray-50 transition-all focus:border-[#6B46FF] focus:bg-white focus:ring-2 focus:ring-[#6B46FF]/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Perfil</label>
                  <Select value={filters.perfil} onValueChange={(value) => handleFilterChange("perfil", value)}>
                    <SelectTrigger className="h-10 rounded-lg border-2 border-[#6B46FF] bg-white text-[#6B46FF] font-medium focus:ring-2 focus:ring-[#6B46FF]/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos</SelectItem>
                      <SelectItem value="Administrativo">Administrativo</SelectItem>
                      <SelectItem value="Cliente">Cliente</SelectItem>
                      <SelectItem value="Chofer">Chofer</SelectItem>
                      <SelectItem value="Coordinador">Coordinador</SelectItem>
                      <SelectItem value="Logística Externa">Logística Externa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Lista de Usuarios</h3>
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5">
                  <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">{totalRecords} usuarios</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Nombre</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Apellido</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Usuario</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Perfil</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">Contraseña</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                              />
                            </svg>
                          </div>
                          <p className="text-sm font-medium text-gray-900">No se encontraron usuarios</p>
                          <p className="mt-1 text-sm text-gray-500">Intenta ajustar los filtros de búsqueda</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user, index) => (
                      <tr
                        key={user.id}
                        className={`transition-all hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-transparent ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{user.nombre}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{user.apellido}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{user.usuario}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{user.perfil}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 font-mono">{user.contraseña}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-lg text-gray-600 transition-all hover:bg-purple-100 hover:text-purple-700"
                              onClick={() => {
                                setEditingUser(user)
                                setIsNewUserModalOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-lg text-gray-600 transition-all hover:bg-red-100 hover:text-red-600"
                              onClick={() => handleDeleteClick(user)}
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
                  <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                    <SelectTrigger className="h-8 w-16 border-0 bg-transparent shadow-none focus:ring-0">
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

      {/* Modal de Nuevo Usuario */}
      <NewUserModal
        isOpen={isNewUserModalOpen}
        onClose={() => {
          setIsNewUserModalOpen(false)
          setEditingUser(null)
        }}
        onSave={async (userData) => {
          try {
            if (userData.id) {
              // Actualizar usuario existente en el backend
              const apiBaseUrl = getApiBaseUrl()
              const response = await fetch(`${apiBaseUrl}/usuarios/${userData.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  nombre: userData.nombre,
                  apellido: userData.apellido,
                  usuario: userData.usuario,
                  contraseña: userData.contraseña,
                  perfil: userData.tipoUsuario,
                  codigoCliente: userData.codigoCliente || null,
                  habilitado: true,
                  bloqueado: false,
                }),
              })

              if (response.ok) {
                const updatedUser = await response.json()
                // Actualizar estado local
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === userData.id
                      ? {
                          id: updatedUser.id,
                          nombre: updatedUser.nombre,
                          apellido: updatedUser.apellido,
                          usuario: updatedUser.usuario,
                          perfil: updatedUser.perfil,
                          contraseña: updatedUser.contraseña,
                          codigoCliente: updatedUser.codigoCliente || undefined,
                          habilitado: updatedUser.habilitado,
                          bloqueado: updatedUser.bloqueado,
                        }
                      : u
                  )
                )
              } else {
                const error = await response.json()
                alert(`Error al actualizar usuario: ${error.message || 'Error desconocido'}`)
                return
              }
            } else {
              // Crear nuevo usuario en el backend
              const apiBaseUrl = getApiBaseUrl()
              const response = await fetch(`${apiBaseUrl}/usuarios`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  nombre: userData.nombre,
                  apellido: userData.apellido,
                  usuario: userData.usuario,
                  contraseña: userData.contraseña,
                  perfil: userData.tipoUsuario,
                  codigoCliente: userData.codigoCliente || null,
                  habilitado: true,
                  bloqueado: false,
                }),
              })

              if (response.ok) {
                const newUser = await response.json()
                // Agregar al estado local
                setUsers((prev) => [
                  ...prev,
                  {
                    id: newUser.id,
                    nombre: newUser.nombre,
                    apellido: newUser.apellido,
                    usuario: newUser.usuario,
                    perfil: newUser.perfil,
                    contraseña: newUser.contraseña,
                    codigoCliente: newUser.codigoCliente || undefined,
                    habilitado: newUser.habilitado,
                    bloqueado: newUser.bloqueado,
                  },
                ])
              } else {
                const error = await response.json()
                alert(`Error al crear usuario: ${error.message || 'Error desconocido'}`)
                return
              }
            }
            setIsNewUserModalOpen(false)
            setEditingUser(null)
          } catch (error: any) {
            console.error('Error al guardar usuario:', error)
            alert(`Error al guardar usuario: ${error.message || 'Error de conexión. Verifica que el backend esté corriendo.'}`)
          }
        }}
        editingUser={editingUser}
      />

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar al usuario{" "}
              <span className="font-semibold text-foreground">
                {userToDelete?.nombre} {userToDelete?.apellido}
              </span>
              ? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

