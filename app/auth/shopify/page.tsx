"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Package, Shield, Lock, Phone, Mail } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"
import { errorDev } from "@/lib/logger"

function ShopifyAuthContent() {
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
      // Obtener la URL de autorización del backend
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/clientes/${clienteId}/shopify/auth-url?token=${token}`)
      if (response.ok) {
        const data = await response.json()
        // Redirigir a Shopify
        window.location.href = data.authUrl
      } else {
        const errorData = await response.json().catch(() => ({ message: "Error desconocido" }))
        const errorMessage = errorData.message || "Error al generar la URL de autorización"
        
        // Mensaje más específico si es por credenciales no configuradas
        if (errorMessage.includes("SHOPIFY_CLIENT_ID") || errorMessage.includes("no configurado")) {
          alert("Las credenciales de Shopify no están configuradas.\n\nPor favor, configure las siguientes variables de entorno en el backend:\n- SHOPIFY_CLIENT_ID\n- SHOPIFY_CLIENT_SECRET\n\nO configúrelas en application.properties")
        } else {
          alert(`Error al generar la URL de autorización: ${errorMessage}`)
        }
        setLoading(false)
      }
    } catch (error: any) {
      errorDev("Error:", error)
      alert(`Error de conexión: ${error.message || "No se pudo conectar al servidor"}`)
      setLoading(false)
    }
  }

  if (!clienteId || !token) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#95BF47] to-[#5E8E3E] px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                <path d="M18.36 5.64c-1.95-1.95-5.12-1.95-7.07 0L9.88 7.12 8.46 5.7 13.76.4a5.5 5.5 0 0 1 7.78 0l.7.7-1.42 1.42zm-12 12c-1.95-1.95-5.12-1.95-7.07 0a5.024 5.024 0 0 0 0 7.07l.7.7 1.42-1.42-.7-.7a3.024 3.024 0 0 1 0-4.24l1.42-1.42 4.24 4.24 1.42-1.42-4.24-4.24zm3.18-3.18L12.7 16.7l1.42-1.42-3.18-3.18-1.42 1.42z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Vinculación con Shopify</h1>
              <p className="text-white/80 text-sm mt-1">Autoriza el acceso a tu tienda</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Información de acceso */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">¿Qué datos accederemos?</h3>
                <p className="text-blue-800 text-sm mb-4">
                  Al autorizar esta aplicación, podremos acceder a los siguientes datos de tu tienda:
                </p>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Información de pedidos y envíos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Datos de clientes (solo para envíos)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Información de métodos de envío</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Información de cumplimiento de pedidos</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Seguridad */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Lock className="w-6 h-6 text-gray-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Seguridad y privacidad</h3>
                <p className="text-gray-700 text-sm">
                  Tus datos están protegidos. Esta aplicación fue desarrollada por <strong>MVG TMS</strong> y 
                  cumple con los estándares de seguridad de Shopify. Solo accederemos a la información 
                  necesaria para gestionar tus envíos.
                </p>
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Phone className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-purple-900 mb-2">¿Necesitas ayuda?</h3>
                <p className="text-purple-800 text-sm mb-2">
                  Si tienes dudas o necesitas asistencia, contáctanos:
                </p>
                <div className="space-y-1 text-sm text-purple-800">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>+34 671 611 975</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>soporte@zetallegue.com</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botón de continuar */}
          <div className="pt-4">
            <button
              onClick={handleContinuar}
              disabled={loading}
              className="w-full bg-[#95BF47] hover:bg-[#7FA63A] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>CONTINUAR A SHOPIFY</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ShopifyAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#95BF47] border-t-transparent" />
        </div>
      }
    >
      <ShopifyAuthContent />
    </Suspense>
  )
}
