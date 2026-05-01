"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
    <div className="min-h-screen bg-[#f3f4f6] p-4 md:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl shadow-2xl md:min-h-[680px] md:p-0">
        <div className="relative hidden w-[62%] flex-col justify-between bg-gradient-to-br from-[#1760ff] via-[#1f63ff] to-[#2e4dff] px-10 py-10 text-white md:flex">
          <div className="text-4xl font-semibold tracking-tight">nexo</div>

          <div className="max-w-md">
            <h1 className="text-5xl font-semibold leading-tight">
              Optimizá tus entregas de punta a punta
            </h1>
            <p className="mt-6 text-lg text-blue-100">
              Creá etiquetas, organizá entregas y seguí tus pedidos desde un solo lugar.
            </p>
          </div>

          <div className="pointer-events-none absolute inset-0 opacity-15">
            <div className="absolute left-16 top-24 text-6xl">×</div>
            <div className="absolute right-20 top-16 text-8xl">×</div>
            <div className="absolute right-32 bottom-24 text-7xl">×</div>
            <div className="absolute left-32 bottom-20 text-5xl">×</div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center bg-white px-6 py-8 md:w-[38%] md:px-10">
          <div className="w-full max-w-sm space-y-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-[#2f4ecb]">Registrate</h2>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="Ingresá tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 border-[#d8deee] text-[#1f2937] placeholder:text-[#9aa3b2] focus-visible:ring-[#2f4ecb]"
                required
              />

              <Input
                type="password"
                placeholder="Ingresá tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-[#d8deee] text-[#1f2937] placeholder:text-[#9aa3b2] focus-visible:ring-[#2f4ecb]"
                required
              />

              <Button
                type="submit"
                className="h-11 w-full rounded-lg bg-[#e6ebfb] text-[#2f4ecb] font-semibold hover:bg-[#dbe3fa]"
              >
                ingresar
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
