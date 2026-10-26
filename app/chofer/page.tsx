"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import { Smartphone } from "lucide-react"
import { ModernHeader } from "@/components/modern-header"
import { getDriverInstallUrl, getLocalTenantBranding, type TenantBranding } from "@/lib/tenant"

export default function ChoferPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<TenantBranding>(getLocalTenantBranding())
  const [installUrl, setInstallUrl] = useState("")
  const [qr, setQr] = useState("")

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const userProfile = sessionStorage.getItem("userProfile")

    if (!isAuthenticated || userProfile !== "Chofer") {
      router.push("/")
      return
    }

    setTenant(getLocalTenantBranding())
    const url = getDriverInstallUrl()
    setInstallUrl(url)
    QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQr).catch(() => {})
  }, [router])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <ModernHeader />
      <div className="flex-1 flex flex-col p-4">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1459e9] shadow-lg shadow-blue-500/20">
                  <Smartphone className="h-10 w-10 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">Estás logueado como repartidor</h1>
                <p className="text-gray-600">
                  El TMS de {tenant.nombre} se usa desde la app del celular. Abrí o instalá la app con este enlace:
                </p>
              </div>

              {qr ? <img src={qr} alt="QR de la app" className="mx-auto h-44 w-44" /> : null}

              <a
                href="/app"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#1459e9] px-5 text-sm font-semibold text-white hover:bg-[#1048c2]"
              >
                Ir a la app de repartidores
              </a>
              {installUrl ? <p className="break-all text-xs text-slate-500">{installUrl}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
