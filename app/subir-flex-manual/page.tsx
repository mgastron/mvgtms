"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"

export default function SubirFlexManualPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    sellerId: "",
    shipmentId: "",
  })

  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const profile = sessionStorage.getItem("userProfile")
    
    if (!isAuthenticated) {
      router.push("/")
      return
    }

    setUserProfile(profile)
  }, [router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Limpiar errores al escribir
    if (error) setError(null)
    if (success) setSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const username = sessionStorage.getItem("username") || "Usuario"
      const apiBaseUrl = getApiBaseUrl()
      
      const response = await fetch(`${apiBaseUrl}/envios/subir-flex-manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sellerId: formData.sellerId.trim(),
          shipmentId: formData.shipmentId.trim(),
          usuarioNombre: username,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al subir el envío Flex")
      }

      const data = await response.json()
      setSuccess(true)
      setFormData({ sellerId: "", shipmentId: "" })
      
      // Redirigir a la página de envíos después de 2 segundos
      setTimeout(() => {
        router.push("/envios")
      }, 2000)
    } catch (err: any) {
      setError(err.message || "Error al subir el envío Flex")
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setFormData({ sellerId: "", shipmentId: "" })
    setError(null)
    setSuccess(false)
  }

  if (!userProfile) {
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ModernHeader />
      <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">SUBIDA FLEX INDIVIDUAL</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Ingrese el Vendedor ID y Shipment ID para cargar un envío Flex manualmente
                  </p>
                </div>
                <button
                  onClick={() => router.push("/envios")}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Vendedor ID */}
                <div>
                  <label htmlFor="sellerId" className="block text-sm font-medium text-gray-700 mb-2">
                    VENDEDOR ID
                  </label>
                  <Input
                    id="sellerId"
                    name="sellerId"
                    type="text"
                    value={formData.sellerId}
                    onChange={handleInputChange}
                    required
                    className="w-full border-2 border-purple-500 focus:border-purple-600 focus:ring-purple-500"
                    placeholder="Ingrese el ID del vendedor"
                  />
                </div>

                {/* Shipment ID */}
                <div>
                  <label htmlFor="shipmentId" className="block text-sm font-medium text-gray-700 mb-2">
                    Shipment ID
                  </label>
                  <Input
                    id="shipmentId"
                    name="shipmentId"
                    type="text"
                    value={formData.shipmentId}
                    onChange={handleInputChange}
                    required
                    className="w-full border-2 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Ingrese el ID del shipment"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                    ✓ Envío Flex subido exitosamente. Redirigiendo...
                  </div>
                )}

                {/* Buttons */}
                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    onClick={handleClear}
                    variant="outline"
                    className="bg-orange-500 text-white hover:bg-orange-600 border-orange-500"
                  >
                    LIMPIAR
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-green-500 text-white hover:bg-green-600"
                  >
                    {loading ? "SUBIRENDO..." : "SUBIR"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </main>
    </div>
  )
}

