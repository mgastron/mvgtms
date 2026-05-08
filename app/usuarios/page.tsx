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

function perfilEtiqueta(perfil: string): string {
  if (perfil === "Cliente") return "Vendedor"
  if (perfil === "Chofer") return "Repartidor"
  return perfil
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
      router.push("/repartidor")
      return
    }
    
    // Clientes no pueden acceder a Sistema
    if (userProfile === "Cliente") {
      router.push("/vendedores")
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
    "h-9 rounded-lg border border-slate-200 bg-slate-50/80 text-[13px] font-medium text-slate-800 shadow-none placeholder:font-normal placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-offset-0"

  return (
    <div className="min-h-screen bg-slate-100/80">
      <ModernHeader />
      <main className={`px-4 pb-8 pt-4 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Sistema</p>
              <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight text-slate-900">Cuentas de acceso</h1>
              <p className="mt-1 max-w-xl text-[13px] text-slate-600">Altas, roles y accesos del equipo operativo.</p>
            </div>
            <Button
              className="h-10 shrink-0 gap-2 rounded-lg border border-slate-800 bg-slate-900 px-5 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800"
              onClick={() => {
                setEditingUser(null)
                setIsNewUserModalOpen(true)
              }}
            >
              <UserPlus className="h-4 w-4" />
              Alta de usuario
            </Button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_1fr] lg:items-start">
            <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Refinar listado</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600">Nombre</label>
                  <Input
                    value={filters.nombre}
                    onChange={(e) => handleFilterChange("nombre", e.target.value)}
                    placeholder="Nombre…"
                    className={filterInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600">Apellido</label>
                  <Input
                    value={filters.apellido}
                    onChange={(e) => handleFilterChange("apellido", e.target.value)}
                    placeholder="Apellido…"
                    className={filterInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600">Usuario</label>
                  <Input
                    value={filters.usuario}
                    onChange={(e) => handleFilterChange("usuario", e.target.value)}
                    placeholder="Usuario…"
                    className={filterInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600">Rol</label>
                  <Select value={filters.perfil} onValueChange={(value) => handleFilterChange("perfil", value)}>
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/80 text-[13px] font-medium text-slate-800 shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos</SelectItem>
                      <SelectItem value="Administrativo">Administrativo</SelectItem>
                      <SelectItem value="Cliente">Vendedor</SelectItem>
                      <SelectItem value="Chofer">Repartidor</SelectItem>
                      <SelectItem value="Coordinador">Coordinador</SelectItem>
                      <SelectItem value="Logística Externa">Logística externa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </aside>

            <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                <h2 className="text-[15px] font-semibold text-slate-900">Usuarios</h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-medium tabular-nums text-slate-600">
                  {totalRecords} registro{totalRecords !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90">
                      <th className="px-4 py-2.5 font-semibold text-slate-600 sm:px-5">Nombre</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 sm:px-5">Apellido</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 sm:px-5">Usuario</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 sm:px-5">Rol</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600 sm:px-5">Contraseña</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-slate-600 sm:px-5">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                              <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                              </svg>
                            </div>
                            <p className="text-[14px] font-semibold text-slate-800">Sin coincidencias</p>
                            <p className="mt-1 text-[13px] text-slate-500">Ajustá los criterios de la columna izquierda</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map((user) => (
                        <tr key={user.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 sm:px-5">{user.nombre}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-800 sm:px-5">{user.apellido}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-slate-700 sm:px-5">{user.usuario}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 sm:px-5">{perfilEtiqueta(user.perfil)}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-slate-500 sm:px-5">{user.contraseña}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 sm:px-5">
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
                                className="h-8 w-8 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600"
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

            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
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

                <div className="flex w-full items-center justify-center gap-0.5 rounded-xl border border-[#e6eaf4] bg-white p-0.5 sm:w-auto">
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

                <div className="flex justify-start sm:justify-end">
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

