"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { getApiBaseUrl } from "@/lib/api-config"
import { errorDev } from "@/lib/logger"

function TiendaNubeCallbackContent() {
  const searchParams = useSearchParams()
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

    const intercambiarTokens = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl()
        const response = await fetch(
          `${apiBaseUrl}/clientes/tiendanube/callback?code=${code}&state=${state}`
        )

        if (response.ok) {
          setStatus("success")
          setMessage("Integración vinculada correctamente.")
        } else {
          const errorData = await response.json().catch(() => ({ message: "Error desconocido" }))
          setStatus("error")
          setMessage(errorData.message || "No fue posible vincular la integración.")
        }
      } catch (err: any) {
        errorDev("Error:", err)
        setStatus("error")
        setMessage("Error de conexión. Reintente.")
      }
    }

    intercambiarTokens()
  }, [code, state, error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === "processing" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6B46FF] mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Procesando autorización…</h2>
            <p className="text-gray-600">Por favor, espere mientras vinculamos la integración de Tienda Nube.</p>
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
            <p className="text-gray-600 mb-2">{message}</p>
            <p className="text-sm text-gray-500">
              Ya podés cerrar esta ventana. El equipo de Nexo verá la tienda vinculada al reabrir el vendedor.
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">Cerrá esta ventana y pedí un link de vinculación nuevo.</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function TiendaNubeCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#6B46FF] border-t-transparent" />
        </div>
      }
    >
      <TiendaNubeCallbackContent />
    </Suspense>
  )
}
