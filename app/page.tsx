"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { EyeOff } from "lucide-react"
import { Montserrat } from "next/font/google"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

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
      sessionStorage.removeItem("userGrupoId")
      sessionStorage.removeItem("vendedorActivoCodigo")
      router.push("/vendedores")
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
            if (user.grupoId != null && user.grupoId !== "") {
              sessionStorage.setItem("userGrupoId", String(user.grupoId))
            } else {
              sessionStorage.removeItem("userGrupoId")
            }
            sessionStorage.removeItem("vendedorActivoCodigo")

            // Redirigir según el perfil (Chofer va a ver solo sus envíos asignados)
            if (userProfile === "Chofer") {
              router.push("/repartidor")
            } else {
              router.push("/vendedores")
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
    <div className={`relative min-h-screen overflow-hidden bg-gradient-to-r from-[#1e86ff] via-[#2a67ff] to-[#2f46f5] ${montserrat.className}`}>
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/logos/nexo-iso-white.png"
          alt=""
          className="absolute left-[10%] top-[24%] h-[42px] w-[42px] opacity-18"
          aria-hidden
        />
        <img
          src="/logos/nexo-iso-white.png"
          alt=""
          className="absolute right-[8%] top-[7%] h-[112px] w-[112px] opacity-14"
          aria-hidden
        />
        <img
          src="/logos/nexo-iso-white.png"
          alt=""
          className="absolute right-[17%] bottom-[17%] h-[118px] w-[118px] opacity-12"
          aria-hidden
        />
        <img
          src="/logos/nexo-iso-white.png"
          alt=""
          className="absolute left-[2%] bottom-[4%] h-[98px] w-[98px] opacity-12"
          aria-hidden
        />
        <img
          src="/logos/nexo-iso-white.png"
          alt=""
          className="absolute right-[3%] bottom-[7%] h-[50px] w-[50px] opacity-14"
          aria-hidden
        />
      </div>

      <div className="relative min-h-screen w-full">
        <div className="absolute left-[5%] top-[7%]">
          <img
            src="/logos/nexo-logo-white.png"
            alt="nexo"
            className="h-auto w-[132px]"
          />
        </div>

        <div className="absolute left-[5%] top-1/2 w-full max-w-[660px] -translate-y-1/2 text-white">
          <h1 className="max-w-[680px] text-[58px] font-semibold leading-[1.08] tracking-[-0.03em]">
            Optimizá tus entregas
            <br />
            de punta a punta
          </h1>
          <p className="mt-7 max-w-[620px] text-[22px] font-medium leading-[1.35] text-[#dbe7ff]">
            Creá etiquetas, organizá entregas y
            <br />
            seguí tus pedidos desde un solo lugar.
          </p>
        </div>

        <div className="absolute right-[9%] top-1/2 w-full max-w-[338px] -translate-y-1/2 rounded-[12px] bg-white p-6 shadow-[0_16px_42px_rgba(14,29,120,0.34)]">
          <h2 className="mb-3 text-center text-[38px] font-semibold text-[#2f66cc]">Registrate</h2>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[15px] font-semibold text-[#596275]">Usuario</label>
              <Input
                type="text"
                placeholder="ingresá tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-[42px] rounded-[4px] border-[#e5e9f3] bg-[#eef2fa] px-3 text-[14px] text-[#2b3448] placeholder:text-[#b2bbcd] focus-visible:ring-[#2f66cc]"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[15px] font-semibold text-[#596275]">Contraseña</label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="ingresá tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-[42px] rounded-[4px] border-[#e5e9f3] bg-[#eef2fa] px-3 pr-10 text-[14px] text-[#2b3448] placeholder:text-[#b2bbcd] focus-visible:ring-[#2f66cc]"
                  required
                />
                <EyeOff className="pointer-events-none absolute right-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#b4bdd0]" />
              </div>
            </div>

            <Button
              type="submit"
              className="mt-3 h-[42px] w-full rounded-[6px] bg-[#e9eefb] text-[18px] font-semibold text-[#2f66cc] hover:bg-[#dfe8fb]"
            >
              Ingresar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
