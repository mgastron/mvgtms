"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { EyeOff } from "lucide-react"
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-r from-[#1b86ff] via-[#2567ff] to-[#2f4bff]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[11%] text-[58px] font-light text-white/22">×</div>
        <div className="absolute right-[11%] top-[5%] text-[120px] font-light text-white/18">×</div>
        <div className="absolute right-[18%] bottom-[17%] text-[128px] font-light text-white/16">×</div>
        <div className="absolute left-[6%] bottom-[8%] text-[110px] font-light text-white/16">×</div>
        <div className="absolute right-[6%] bottom-[8%] text-[56px] font-light text-white/18">×</div>
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1280px] items-center px-8 py-10 md:px-14 lg:px-16">
        <div className="w-full max-w-[620px] text-white">
          <div className="text-[48px] font-medium leading-none tracking-[-0.04em] md:text-[52px]">
            nexo
          </div>
          <h1 className="mt-24 max-w-[620px] text-[58px] font-semibold leading-[1.08] tracking-[-0.03em] md:text-[62px]">
            Optimizá tus entregas de punta a punta
          </h1>
          <p className="mt-7 max-w-[560px] text-[38px] font-medium leading-[1.2] text-[#dbe7ff] md:text-[40px]">
            Creá etiquetas, organizá entregas y seguí tus pedidos desde un solo lugar.
          </p>
        </div>

        <div className="absolute right-8 top-1/2 w-full max-w-[360px] -translate-y-1/2 rounded-[12px] bg-white p-8 shadow-[0_14px_40px_rgba(14,29,120,0.28)] md:right-14 lg:right-16">
          <h2 className="mb-5 text-center text-[34px] font-semibold text-[#2f66cc]">Registrate</h2>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-[17px] font-semibold text-[#596275]">Usuario</label>
              <Input
                type="text"
                placeholder="ingresá tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 rounded-[4px] border-[#e5e9f3] bg-white px-3 text-[15px] text-[#2b3448] placeholder:text-[#b2bbcd] focus-visible:ring-[#2f66cc]"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[17px] font-semibold text-[#596275]">Contraseña</label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="ingresá tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-[4px] border-[#e5e9f3] bg-white px-3 pr-10 text-[15px] text-[#2b3448] placeholder:text-[#b2bbcd] focus-visible:ring-[#2f66cc]"
                  required
                />
                <EyeOff className="pointer-events-none absolute right-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#b4bdd0]" />
              </div>
            </div>

            <Button
              type="submit"
              className="mt-3 h-11 w-full rounded-[6px] bg-[#e9eefb] text-[18px] font-semibold text-[#2f66cc] hover:bg-[#dfe8fb]"
            >
              ingresar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
