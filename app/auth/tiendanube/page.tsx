"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getApiBaseUrl } from "@/lib/api-config"
import { errorDev } from "@/lib/logger"

function TiendaNubeAuthContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clienteId = searchParams.get("clienteId")
  const token = searchParams.get("token")

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clienteId || !token) {
      router.push("/clientes")
      return
    }
  }, [clienteId, token, router])

  const handleContinuar = async () => {
    if (!clienteId || !token) return
    setLoading(true)
    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/clientes/${clienteId}/tiendanube/auth-url?token=${token}`)
      if (response.ok) {
        const data = await response.json()
        window.location.href = data.authUrl
      } else {
        const errorData = await response.json().catch(() => ({ message: "Error desconocido" }))
        const errorMessage = errorData.message || "Error al generar la URL de autorización"
        if (errorMessage.includes("TIENDANUBE_CLIENT_ID") || errorMessage.includes("no configurado")) {
          alert("Las credenciales de Tienda Nube no están configuradas. Configure TIENDANUBE_CLIENT_ID y TIENDANUBE_CLIENT_SECRET en el backend.")
        } else {
          alert(`Error: ${errorMessage}`)
        }
        setLoading(false)
      }
    } catch (error: any) {
      errorDev("Error:", error)
      alert(`Error de conexión: ${error.message || "No se pudo conectar al servidor"}`)
      setLoading(false)
    }
  }

  if (!clienteId || !token) return null

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-8 pt-10 pb-6 text-center border-b border-slate-100">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#eef4ff] text-[#1459e9] mb-4">
            <span className="text-lg font-bold">Nexo</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-800">
            Vincular integración: Tienda Nube
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Autorice a Nexo para operar sus envíos desde Tienda Nube.
          </p>
        </div>

        <div className="px-8 py-6 space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            Al continuar, autoriza a <strong className="text-slate-700">Nexo</strong> a acceder a los datos necesarios para sincronizar pedidos y gestionar envíos. Podrá desvincular la integración en cualquier momento.
          </p>

          <button
            onClick={handleContinuar}
            disabled={loading}
            className="w-full bg-[#1459e9] hover:bg-[#114bce] text-white font-semibold py-3.5 px-4 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Cargando…
              </>
            ) : (
              "Continuar a Tienda Nube"
            )}
          </button>
        </div>

        <p className="px-8 pb-6 text-center text-xs text-slate-400">
          ¿Dudas? matiasgastron@gmail.com
        </p>
      </div>
    </div>
  )
}

export default function TiendaNubeAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-transparent" />
        </div>
      }
    >
      <TiendaNubeAuthContent />
    </Suspense>
  )
}
