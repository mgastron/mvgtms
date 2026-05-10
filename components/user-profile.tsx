"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { User, LogOut, ChevronDown, Search, MapPinned } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"

interface UserInfo {
  username: string
  nombre?: string
  apellido?: string
  perfil?: string
}

interface UserProfileProps {
  variant?: "default" | "headerBlue"
}

export function UserProfile({ variant = "default" }: UserProfileProps) {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<UserInfo>({ username: "" })
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Obtener el username del sessionStorage
    const storedUsername = sessionStorage.getItem("username")
    const storedProfile = sessionStorage.getItem("userProfile")
    
    if (storedUsername) {
      // Buscar información completa del usuario
      const loadUserInfo = async () => {
        let userData: UserInfo = {
          username: storedUsername,
          perfil: storedProfile || undefined,
        }

        // Intentar cargar del backend
        try {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
          if (response.ok) {
            const data = await response.json()
            if (data.content && data.content.length > 0) {
              const user = data.content.find((u: any) => u.usuario === storedUsername)
              if (user) {
                userData = {
                  username: user.usuario || storedUsername,
                  nombre: user.nombre,
                  apellido: user.apellido,
                  perfil: user.perfil || user.tipoUsuario || storedProfile || undefined,
                }
                setUserInfo(userData)
                return
              }
            }
          }
        } catch (error) {
          warnDev("No se pudo cargar información del usuario del backend:", error)
        }

        // Si es admin, usar valores por defecto
        if (storedUsername === "admin") {
          userData = {
            username: "admin",
            nombre: "Administrador",
            apellido: "",
            perfil: storedProfile || "Administrativo",
          }
        }

        setUserInfo(userData)
      }

      loadUserInfo()
    }
  }, [])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const handleLogout = () => {
    sessionStorage.removeItem("isAuthenticated")
    sessionStorage.removeItem("username")
    sessionStorage.removeItem("userProfile")
    router.push("/")
  }

  if (!userInfo.username) return null

  const fullName = userInfo.nombre && userInfo.apellido 
    ? `${userInfo.nombre} ${userInfo.apellido}`.trim()
    : userInfo.nombre || userInfo.username

  return (
    <div className="relative" ref={dropdownRef} suppressHydrationWarning>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={
          variant === "headerBlue"
            ? "flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-white hover:bg-white/15 transition-all duration-200"
            : "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200 border border-gray-200"
        }
      >
        <div className={variant === "headerBlue" ? "flex h-7 w-7 items-center justify-center rounded-full bg-white" : "flex h-7 w-7 items-center justify-center rounded-full bg-gray-300"}>
          <User className={variant === "headerBlue" ? "h-4 w-4 text-[#1459e9]" : "h-4 w-4 text-gray-600"} />
        </div>
        <span className={variant === "headerBlue" ? "font-medium text-sm hidden sm:inline text-white" : "font-medium text-sm hidden sm:inline"}>{userInfo.username}</span>
        <ChevronDown className={`${variant === "headerBlue" ? "text-white/90" : "text-gray-600"} h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
          <div className="px-4 py-3 border-b border-gray-200 space-y-1">
            <p className="text-xs text-gray-500">Usuario</p>
            <p className="text-sm font-semibold text-gray-900">{userInfo.username}</p>
            {fullName !== userInfo.username && (
              <>
                <p className="text-xs text-gray-500 mt-2">Nombre</p>
                <p className="text-sm text-gray-900">{fullName}</p>
              </>
            )}
            {userInfo.perfil && (
              <>
                <p className="text-xs text-gray-500 mt-2">Rol</p>
                <p className="text-sm text-gray-900">{userInfo.perfil}</p>
              </>
            )}
          </div>
          <div className="px-2 py-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                router.push("/utilidades/buscador")
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Search className="h-4 w-4 text-gray-500 shrink-0" />
              Buscador de pedidos
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                router.push("/utilidades/lista-precios")
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <MapPinned className="h-4 w-4 text-gray-500 shrink-0" />
              Cotizá un viaje
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

