"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getApiBaseUrl } from "@/lib/api-config"
import { errorDev } from "@/lib/logger"

function ShopifyCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const shop = searchParams.get("shop")
    const hmac = searchParams.get("hmac")

    if (!code || !state || !shop || !hmac) {
      errorDev("Faltan parámetros en el callback de Shopify")
      alert("Error: Faltan parámetros en el callback de Shopify")
      router.push("/clientes")
      return
    }

    // Extraer clienteId del state (formato: clienteId_token)
    const clienteId = state.split("_")[0]

    // Enviar el código al backend para procesarlo
    const procesarCallback = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(`${apiBaseUrl}/clientes/shopify/callback?code=${code}&state=${state}&shop=${shop}&hmac=${hmac}`)
        
        if (response.ok) {
          const data = await response.json()
          // Redirigir a la página de clientes con mensaje de éxito
          router.push("/clientes?shopifyLinked=true")
        } else {
          const errorData = await response.json().catch(() => ({ message: "Error desconocido" }))
          const errorMessage = errorData.message || "Error al procesar el callback de Shopify"
          alert(`Error al vincular cuenta de Shopify: ${errorMessage}`)
          router.push("/clientes")
        }
      } catch (error: any) {
        errorDev("Error al procesar callback:", error)
        alert(`Error de conexión: ${error.message || "No se pudo conectar al servidor"}`)
        router.push("/clientes")
      }
    }

    procesarCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#95BF47] mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Procesando autorización...</h2>
        <p className="text-gray-600 text-sm">Por favor, espera mientras vinculamos tu cuenta de Shopify.</p>
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
