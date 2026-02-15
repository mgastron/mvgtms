"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getApiBaseUrl } from "@/lib/api-config"

export default function TiendaNubeCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const [status, setStatus] = useState<"processing" | "success" | "error">("processing")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (error) {
      setStatus("error")
      setMessage("Error en la autorización: " + error)
      return
    }

    if (!code || !state) {
      setStatus("error")
      setMessage("Faltan parámetros de autorización")
      return
    }

    // Intercambiar código por tokens
    const intercambiarTokens = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(`${apiBaseUrl}/clientes/tiendanube/callback?code=${code}&state=${state}`)
        
        if (response.ok) {
          const data = await response.json()
          setStatus("success")
          setMessage("¡Cuenta vinculada exitosamente!")
          
          // Redirigir a la página de clientes después de 2 segundos
          setTimeout(() => {
            router.push("/clientes")
          }, 2000)
        } else {
          const errorData = await response.json().catch(() => ({ message: "Error desconocido" }))
          setStatus("error")
          setMessage(errorData.message || "Error al vincular la cuenta")
        }
      } catch (error: any) {
        console.error("Error:", error)
        setStatus("error")
        setMessage("Error de conexión: " + error.message)
      }
    }

    intercambiarTokens()
  }, [code, state, error, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === "processing" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6B46FF] mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Procesando autorización...</h2>
            <p className="text-gray-600">Por favor, espera mientras vinculamos tu cuenta de Tienda Nube.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">¡Éxito!</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">Redirigiendo a la página de clientes...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <button
              onClick={() => router.push("/clientes")}
              className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Volver a Clientes
            </button>
          </>
        )}
      </div>
    </div>
  )
}

