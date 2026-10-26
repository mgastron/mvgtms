"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { getApiBaseUrl } from "@/lib/api-config"
import { errorDev } from "@/lib/logger"

function ShopifyCallbackContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const shop = searchParams.get("shop")
    const hmac = searchParams.get("hmac")

    if (!code || !state || !shop || !hmac) {
      setStatus("error")
      setMessage("No fue posible completar la autorización. Faltan parámetros.")
      return
    }

    const procesarCallback = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(
          `${apiBaseUrl}/clientes/shopify/callback?code=${code}&state=${state}&shop=${shop}&hmac=${hmac}`
        )

        if (response.ok) {
          setStatus("success")
          setMessage("Integración de Shopify vinculada correctamente.")
        } else {
          const errorData = await response.json().catch(() => ({ message: "Error desconocido" }))
          setStatus("error")
          setMessage(errorData.message || "No fue posible vincular la integración de Shopify.")
        }
      } catch (err: any) {
        errorDev("Error al procesar callback:", err)
        setStatus("error")
        setMessage("Error de conexión. Reintente.")
      }
    }

    procesarCallback()
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        {status === "processing" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#95BF47] mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Procesando autorización…</h2>
            <p className="text-gray-600 text-sm">Por favor, espere mientras vinculamos la integración de Shopify.</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Éxito!</h2>
            <p className="text-gray-600 mb-2">{message}</p>
            <p className="text-sm text-gray-500">
              Ya podés cerrar esta ventana. El equipo de Nexo verá Shopify vinculado al reabrir el vendedor.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-2">{message}</p>
            <p className="text-sm text-gray-500">Cerrá esta ventana y pedí un link de vinculación nuevo.</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function ShopifyCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#95BF47] border-t-transparent" />
        </div>
      }
    >
      <ShopifyCallbackContent />
    </Suspense>
  )
}
