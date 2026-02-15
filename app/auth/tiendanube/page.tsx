"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Package, Shield, Lock, Phone, Mail } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"

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
      // Obtener la URL de autorización del backend
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/clientes/${clienteId}/tiendanube/auth-url?token=${token}`)
      if (response.ok) {
        const data = await response.json()
        // Redirigir a Tienda Nube
        window.location.href = data.authUrl
      } else {
        const errorData = await response.json().catch(() => ({ message: "Error desconocido" }))
        const errorMessage = errorData.message || "Error al generar la URL de autorización"
        
        // Mensaje más específico si es por credenciales no configuradas
        if (errorMessage.includes("TIENDANUBE_CLIENT_ID") || errorMessage.includes("no configurado")) {
          alert("Las credenciales de Tienda Nube no están configuradas.\n\nPor favor, configure las siguientes variables de entorno en el backend:\n- TIENDANUBE_CLIENT_ID\n- TIENDANUBE_CLIENT_SECRET\n\nO configúrelas en application.properties")
        } else {
          alert(`Error al generar la URL de autorización: ${errorMessage}`)
        }
        setLoading(false)
      }
    } catch (error: any) {
      console.error("Error:", error)
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
        <div className="bg-gradient-to-r from-[#5B5B5B] to-[#6B6B6B] px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg viewBox="0 0 60 60" className="w-10 h-10 text-white">
                <circle cx="20" cy="30" r="8" fill="currentColor" />
                <circle cx="40" cy="30" r="8" fill="currentColor" />
                <path d="M20 22 Q30 10 40 22" stroke="currentColor" strokeWidth="3" fill="none" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Vinculación con Tienda Nube</h1>
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
                    <span>Información de productos (solo para envíos)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Actualización de estados de envío</span>
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
                  cumple con los estándares de seguridad de Tienda Nube. Solo accederemos a la información 
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
              className="w-full bg-[#6B46FF] hover:bg-[#5a3ae6] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>CONTINUAR A TIENDA NUBE</span>
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

export default function TiendaNubeAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#6B46FF] border-t-transparent" />
        </div>
      }
    >
      <TiendaNubeAuthContent />
    </Suspense>
  )
}
