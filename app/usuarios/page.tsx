"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Pencil, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NewUserModal } from "@/components/new-user-modal"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev, errorDev } from "@/lib/logger"
import { Montserrat } from "next/font/google"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})
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
  // Cargar usuarios solo desde el backend (limpiar localStorage legacy para no mostrar datos viejos)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("tms_usuarios")
        }
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
        if (response.ok) {
          const data = await response.json()
          const content = data.content || []
          const backendUsers: User[] = content.map((u: any) => ({
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
        } else {
          setUsers([])
        }
      } catch (error: any) {
        warnDev("No se pudo cargar usuarios del backend:", error)
        setUsers([])
      }
    }
    loadUsers()
  }, [])

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
        errorDev('Error al eliminar usuario:', error)
        alert(`Error al eliminar usuario: ${error.message || 'Error de conexión. Verifica que el backend esté corriendo.'}`)
      }
    }
  }

  const filterInputClass =
    "h-10 rounded-xl border border-[#e6eaf4] bg-white text-[14px] font-medium text-[#1f2433] shadow-sm placeholder:font-normal placeholder:text-[#8890a8] focus-visible:border-[#1570ef] focus-visible:ring-2 focus-visible:ring-[#1570ef]/20 focus-visible:ring-offset-0"

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <ModernHeader />
      <main className={`px-4 pb-6 pt-3 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px] space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-[34px] font-semibold tracking-tight text-[#1570ef]">Usuarios</h1>
            <Button
              className="h-10 gap-2 rounded-xl bg-[#1459e9] px-5 text-[14px] font-semibold text-white shadow-sm hover:bg-[#114bce]"
              onClick={() => {
                setEditingUser(null)
                setIsNewUserModalOpen(true)
              }}
            >
              <UserPlus className="h-4 w-4" />
              Nuevo
            </Button>
          </div>

          <div className="rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-[18px] font-semibold text-[#4f46ce]">Filtros</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="block text-[14px] font-medium text-[#4d5571]">Nombre</label>
                <Input
                  value={filters.nombre}
                  onChange={(e) => handleFilterChange("nombre", e.target.value)}
                  placeholder="Buscar por nombre…"
                  className={filterInputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[14px] font-medium text-[#4d5571]">Apellido</label>
                <Input
                  value={filters.apellido}
                  onChange={(e) => handleFilterChange("apellido", e.target.value)}
                  placeholder="Buscar por apellido…"
                  className={filterInputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[14px] font-medium text-[#4d5571]">Usuario</label>
                <Input
                  value={filters.usuario}
                  onChange={(e) => handleFilterChange("usuario", e.target.value)}
                  placeholder="Buscar por usuario…"
                  className={filterInputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[14px] font-medium text-[#4d5571]">Perfil</label>
                <Select value={filters.perfil} onValueChange={(value) => handleFilterChange("perfil", value)}>
                  <SelectTrigger className="h-10 text-[14px] font-medium text-[#1f2433]">
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

          <div className="overflow-hidden rounded-2xl border border-[#e6eaf4] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6eaf4] bg-[#fafbff] px-4 py-3 sm:px-5">
              <h3 className="text-[16px] font-semibold text-[#1f2433]">Listado</h3>
              <div className="flex items-center gap-2 rounded-full border border-[#e6eaf4] bg-white px-3 py-1 text-[13px] font-medium text-[#5d6578]">
                <span className="text-[#1570ef]">{totalRecords}</span>
                <span>usuarios</span>
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
                      Apellido
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Usuario
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Perfil
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Contraseña
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#5d6578] sm:px-5">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f8]">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-14 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff]">
                            <svg className="h-6 w-6 text-[#1570ef]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                              />
                            </svg>
                          </div>
                          <p className="text-[14px] font-semibold text-[#1f2433]">No se encontraron usuarios</p>
                          <p className="mt-1 text-[13px] text-[#8890a8]">Probá cambiar los filtros</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user, index) => (
                      <tr
                        key={user.id}
                        className={`transition-colors hover:bg-[#f7faff] ${index % 2 === 0 ? "bg-white" : "bg-[#fafbff]"}`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] text-[#1f2433] sm:px-5">{user.nombre}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] text-[#1f2433] sm:px-5">{user.apellido}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] text-[#1f2433] sm:px-5">{user.usuario}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[14px] text-[#5d6578]">{user.perfil}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-[#525b76] sm:px-5">{user.contraseña}</td>
                        <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-lg text-[#5d6578] hover:bg-[#eef4ff] hover:text-[#1570ef]"
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
                              className="h-9 w-9 rounded-lg text-[#5d6578] hover:bg-red-50 hover:text-red-600"
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
                  <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
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
            errorDev('Error al guardar usuario:', error)
            alert(`Error al guardar usuario: ${error.message || 'Error de conexión. Verifica que el backend esté corriendo.'}`)
          }
        }}
        editingUser={editingUser}
      />

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className={montserrat.className}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-[#1f2433]">¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] leading-relaxed text-[#5d6578]">
              ¿Estás seguro de que deseas eliminar al usuario{" "}
              <span className="font-semibold text-[#1f2433]">
                {userToDelete?.nombre} {userToDelete?.apellido}
              </span>
              ? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              onClick={() => setUserToDelete(null)}
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
    </div>
  )
}

