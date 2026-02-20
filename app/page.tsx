"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, Lock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validación 1: admin / 1234 (usuario por defecto)
    if (username === "admin" && password === "1234") {
      sessionStorage.setItem("isAuthenticated", "true")
      sessionStorage.setItem("username", username)
      sessionStorage.setItem("userProfile", "Administrativo")
      router.push("/clientes")
      return
    }

    // Validación 2: Intentar cargar usuarios del backend
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
      if (response.ok) {
        const data = await response.json()
        if (data.content && data.content.length > 0) {
          const user = data.content.find(
            (u: any) => u.usuario === username && (u.contraseña === password || u.password === password)
          )
          if (user) {
            const userProfile = user.perfil || user.tipoUsuario || "Administrativo"
            sessionStorage.setItem("isAuthenticated", "true")
            sessionStorage.setItem("username", username)
            sessionStorage.setItem("userProfile", userProfile)
            
            // Redirigir según el perfil (Chofer va a ver solo sus envíos asignados)
            if (userProfile === "Chofer") {
              router.push("/envios")
            } else {
              router.push("/clientes")
            }
            return
          }
        }
      }
    } catch (error) {
      warnDev("No se pudo verificar usuarios del backend:", error)
    }

    // Si no se encontró ningún usuario válido
    setError("Usuario o contraseña incorrectos")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Logo MVG */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 via-cyan-500 to-teal-500 shadow-xl shadow-cyan-500/30">
              <span className="text-3xl font-black tracking-tighter text-white drop-shadow-sm">MVG</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-gray-800 text-center">Ingreso al sistema</h1>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div className="space-y-2">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <User className="h-5 w-5" />
                </div>
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-11 h-12 border-0 border-b-2 border-gray-200 focus:border-[#6B46FF] rounded-none focus:ring-0 bg-transparent"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Lock className="h-5 w-5" />
                </div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 border-0 border-b-2 border-gray-200 focus:border-[#6B46FF] rounded-none focus:ring-0 bg-transparent"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-[#6B46FF] to-[#FF6B35] hover:from-[#5a3ad6] hover:to-[#e55a2b] text-white font-semibold rounded-lg shadow-lg shadow-purple-500/30 transition-all duration-200 uppercase tracking-wide"
            >
              INGRESAR
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
