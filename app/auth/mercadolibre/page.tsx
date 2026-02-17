"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, Package, Shield, Lock, Phone, Mail } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"

function MercadoLibreAuthContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clienteId = searchParams.get("clienteId")
  const token = searchParams.get("token")

  const [loading, setLoading] = useState(false)
  const [fulfillmentChecked, setFulfillmentChecked] = useState(false)

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
      const response = await fetch(`${apiBaseUrl}/clientes/${clienteId}/flex/auth-url?token=${token}&fulfillment=${fulfillmentChecked}`)
      if (response.ok) {
        const data = await response.json()
        // Redirigir a MercadoLibre
        window.location.href = data.authUrl
      } else {
        alert("Error al generar la URL de autorización")
        setLoading(false)
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Error al generar la URL de autorización")
      setLoading(false)
    }
  }

  if (!clienteId || !token) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-[#6B46FF] to-[#5a3ae6] px-8 py-8">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-[#6B46FF] to-[#5a3ae6] bg-clip-text text-transparent">MVG</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">MVG</h1>
              <p className="text-white/90 text-sm mt-1">Sistema de Gestión de Envíos</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          {/* Introducción */}
          <div className="mb-8">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="h-6 w-6 text-[#6B46FF] mt-1 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Autorización de vinculación con MercadoLibre
                </h2>
                <p className="text-gray-600 text-base leading-relaxed">
                  Está por autorizar la vinculación de su cuenta de MercadoLibre con <strong className="text-[#6B46FF]">MVG</strong>.
                  Solo accederemos a los datos necesarios para una correcta gestión según el acuerdo estipulado.
                </p>
              </div>
            </div>
          </div>

          {/* Datos de paquetería */}
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 rounded-r-lg p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Datos de paquetería</h3>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700 ml-13">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                Nombre del destinatario
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                Dirección de destino
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                Valor declarado del paquete
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                Peso declarado del paquete
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                Observaciones de destino
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                Costo de envío
              </li>
            </ul>
          </div>

          {/* FulFillment (WMS) */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="fulfillment"
                checked={fulfillmentChecked}
                onChange={(e) => setFulfillmentChecked(e.target.checked)}
                className="w-5 h-5 text-[#6B46FF] border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#6B46FF] cursor-pointer transition-all"
              />
              <label htmlFor="fulfillment" className="text-lg font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                <Package className="h-5 w-5 text-[#6B46FF]" />
                FulFillment (WMS)
              </label>
            </div>
            <div className="ml-8">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  Título de la publicación
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  Código de artículo
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  Variaciones (talle, color, ...)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  Descripción
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  Imagen principal
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  Cantidad
                </li>
              </ul>
            </div>
          </div>

          {/* Información de seguridad */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 mb-6 border border-gray-200">
            <div className="flex items-start gap-3 mb-4">
              <Lock className="h-6 w-6 text-[#6B46FF] mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Seguridad y privacidad</h3>
                <div className="space-y-3 text-gray-700">
                  <p>
                    Por supuesto que podrá generar la desvinculación o modificar la misma cuando guste.
                  </p>
                  <p>
                    Para su tranquilidad <strong className="text-gray-900">MVG</strong> ha contratado los servicios de <strong className="text-gray-900">MVG TMS</strong>, empresa de sistemas que ya se encuentra certificada dentro de MercadoLibre.
                  </p>
                  <p>
                    <strong className="text-gray-900">MVG TMS</strong> tiene basta experiencia en el manejo de datos sensibles y una orientación muy fuerte hacia la seguridad. Pero cualquier duda o comentario estamos a entera disposición.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Contacto */}
            <div className="mt-5 pt-5 border-t border-gray-300">
              <div className="flex flex-col sm:flex-row gap-4 text-sm">
                <a 
                  href="tel:+34671611975" 
                  className="flex items-center gap-2 text-[#6B46FF] hover:text-[#5a3ae6] transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  +34 671 611 975
                </a>
                <a 
                  href="mailto:soporte@zetallegue.com" 
                  className="flex items-center gap-2 text-[#6B46FF] hover:text-[#5a3ae6] transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  soporte@zetallegue.com
                </a>
              </div>
            </div>
          </div>

          {/* Botón de continuar */}
          <div className="flex justify-center pt-4">
            <button
              onClick={handleContinuar}
              disabled={loading}
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold py-4 px-12 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Cargando...
                </span>
              ) : (
                "CONTINUAR A MERCADOLIBRE"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MercadoLibreAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#6B46FF] border-t-transparent" />
        </div>
      }
    >
      <MercadoLibreAuthContent />
    </Suspense>
  )
}

