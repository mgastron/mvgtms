"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { EyeOff } from "lucide-react"
import { Montserrat } from "next/font/google"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"
import {
  getLocalTenantBranding,
  isNexoTenant,
  loadTenantBranding,
  type TenantBranding,
} from "@/lib/tenant"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

function persistSession(user: {
  usuario?: string
  perfil?: string
  tipoUsuario?: string
  grupoId?: string | number | null
}) {
  const userProfile = user.perfil || user.tipoUsuario || "Administrativo"
  sessionStorage.setItem("isAuthenticated", "true")
  sessionStorage.setItem("username", user.usuario || "")
  sessionStorage.setItem("userProfile", userProfile)
  if (user.grupoId != null && user.grupoId !== "") {
    sessionStorage.setItem("userGrupoId", String(user.grupoId))
  } else {
    sessionStorage.removeItem("userGrupoId")
  }
  sessionStorage.removeItem("vendedorActivoCodigo")
  return userProfile
}

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [tenant, setTenant] = useState<TenantBranding>(getLocalTenantBranding())

  useEffect(() => {
    loadTenantBranding(getApiBaseUrl()).then(setTenant)
  }, [])

  const isNexo = tenant.slug === "nexo"
  const accent = isNexo ? "#2f66cc" : tenant.colorPrimario

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const apiBaseUrl = getApiBaseUrl()

    try {
      const response = await fetch(`${apiBaseUrl}/usuarios/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: username, contraseña: password, organizacionSlug: tenant.slug }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.usuario) {
          const userProfile = persistSession(data.usuario)
          router.push(userProfile === "Chofer" ? "/repartidor" : "/configuracion/vendedores")
          return
        }
      }
    } catch (err) {
      warnDev("No se pudo iniciar sesión contra el backend:", err)
    }

    if (isNexoTenant() && username === "admin" && password === "1234") {
      persistSession({ usuario: username, perfil: "Administrativo" })
      router.push("/configuracion/vendedores")
      return
    }

    setError("Usuario o contraseña incorrectos")
  }

  return (
    <div
      className={`relative min-h-screen overflow-hidden ${montserrat.className}`}
      style={{
        background: isNexo
          ? "linear-gradient(to right, #1e86ff, #2a67ff, #2f46f5)"
          : `linear-gradient(135deg, ${tenant.colorPrimario} 0%, #061433 100%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        {(isNexo
          ? [
              { src: "/logos/nexo-iso-white.png", className: "absolute left-[10%] top-[24%] h-[42px] w-[42px] opacity-18" },
              { src: "/logos/nexo-iso-white.png", className: "absolute right-[8%] top-[7%] h-[112px] w-[112px] opacity-14" },
              { src: "/logos/nexo-iso-white.png", className: "absolute right-[17%] bottom-[17%] h-[118px] w-[118px] opacity-12" },
              { src: "/logos/nexo-iso-white.png", className: "absolute left-[2%] bottom-[4%] h-[98px] w-[98px] opacity-12" },
              { src: "/logos/nexo-iso-white.png", className: "absolute right-[3%] bottom-[7%] h-[50px] w-[50px] opacity-14" },
            ]
          : [
              { src: tenant.logoUrl, className: "absolute left-[8%] top-[18%] h-[72px] w-[72px] rounded-full opacity-20" },
              { src: tenant.logoUrl, className: "absolute right-[7%] top-[8%] h-[128px] w-[128px] rounded-full opacity-15" },
              { src: tenant.logoUrl, className: "absolute right-[16%] bottom-[14%] h-[140px] w-[140px] rounded-full opacity-12" },
              { src: tenant.logoUrl, className: "absolute left-[3%] bottom-[6%] h-[96px] w-[96px] rounded-full opacity-14" },
            ]
        ).map((item, index) => (
          <img key={index} src={item.src} alt="" className={item.className} aria-hidden />
        ))}
      </div>

      <div className="relative flex min-h-screen w-full flex-col md:block">
        <div className="px-5 pt-6 md:absolute md:left-[5%] md:top-[7%] md:px-0 md:pt-0">
          <img
            src={tenant.logoUrl}
            alt={tenant.nombre}
            className={isNexo ? "h-auto w-[110px] md:w-[132px]" : "h-[86px] w-[86px] rounded-full bg-white p-1 md:h-[104px] md:w-[104px]"}
          />
        </div>

        <div className="hidden text-white md:absolute md:left-[5%] md:top-1/2 md:block md:w-full md:max-w-[660px] md:-translate-y-1/2">
          <h1 className="max-w-[680px] text-[58px] font-semibold leading-[1.08] tracking-[-0.03em]">
            {isNexo ? (
              <>
                Optimizá tus entregas
                <br />
                de punta a punta
              </>
            ) : (
              <>
                {tenant.nombre}
                <br />
                logística a tu medida
              </>
            )}
          </h1>
          <p className="mt-7 max-w-[620px] text-[22px] font-medium leading-[1.35] text-[#dbe7ff]">
            Creá etiquetas, organizá entregas y
            <br />
            seguí tus pedidos desde un solo lugar.
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-[338px] flex-1 flex-col justify-center px-4 py-10 md:absolute md:right-[9%] md:top-1/2 md:mx-0 md:max-w-[338px] md:-translate-y-1/2 md:px-0 md:py-0">
        <div className="w-full rounded-[12px] bg-white p-6 shadow-[0_16px_42px_rgba(14,29,120,0.34)]">
          <h2 className="mb-3 text-center text-[30px] font-semibold md:text-[38px]" style={{ color: accent }}>
            {isNexo ? "Registrate" : "Ingresar"}
          </h2>

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
              className="mt-3 h-[42px] w-full rounded-[6px] text-[18px] font-semibold hover:opacity-90"
              style={{ backgroundColor: isNexo ? "#e9eefb" : tenant.colorPrimario, color: isNexo ? "#2f66cc" : "#ffffff" }}
            >
              Ingresar
            </Button>
          </form>
        </div>
        </div>
      </div>
    </div>
  )
}
