"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Package, AlertCircle } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"
import { errorDev } from "@/lib/logger"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function BuscadorPedidosPage() {
  const router = useRouter()
  const [tracking, setTracking] = useState("")
  const [loading, setLoading] = useState(false)
  const [showNotFound, setShowNotFound] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!tracking.trim()) {
      return
    }

    setLoading(true)
    setShowNotFound(false)

    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/envios/buscar-por-tracking/${encodeURIComponent(tracking.trim())}`)
      
      if (response.ok) {
        const data = await response.json()
        const trackingToken = data.trackingToken
        
        if (trackingToken) {
          // Abrir el link público de tracking en una nueva pestaña
          const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
          window.open(`${baseUrl}/tracking/${trackingToken}`, "_blank")
          // Limpiar el campo de búsqueda después de abrir
          setTracking("")
        } else {
          setShowNotFound(true)
        }
      } else if (response.status === 404) {
        setShowNotFound(true)
      } else {
        setShowNotFound(true)
      }
    } catch (error) {
      errorDev("Error al buscar envío:", error)
      setShowNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50" suppressHydrationWarning>
      <ModernHeader />
      <main className="p-8">
        
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 mb-6 shadow-lg">
              <Package className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Buscador de Pedidos
            </h1>
            <p className="text-lg text-gray-600">
              Ingresá el número de tracking para ver el estado de tu envío
            </p>
          </div>

          {/* Search Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <Input
                  type="text"
                  placeholder="Ingresá el número de tracking..."
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  className="pl-12 h-14 text-lg border-2 border-gray-200 focus:border-purple-500 rounded-xl"
                  disabled={loading}
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading || !tracking.trim()}
                className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Buscando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    <span>Buscar Envío</span>
                  </div>
                )}
              </Button>
            </form>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Rastreo en Tiempo Real</h3>
              <p className="text-sm text-gray-600">
                Seguí tu envío en tiempo real con actualizaciones instantáneas
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Búsqueda Rápida</h3>
              <p className="text-sm text-gray-600">
                Encontrá tu envío con solo ingresar el número de tracking
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Notificaciones</h3>
              <p className="text-sm text-gray-600">
                Recibí actualizaciones automáticas sobre el estado de tu envío
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Not Found Dialog */}
      <AlertDialog open={showNotFound} onOpenChange={setShowNotFound}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-2xl">
              Envío no encontrado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center text-gray-600 mt-4">
                <p>
                  No se encontró ningún envío con el número de tracking{" "}
                  <span className="font-semibold text-gray-900">{tracking}</span>
                </p>
                <p className="mt-4">
                  Por favor, verificá que el número de tracking sea correcto e intentá nuevamente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction
              onClick={() => {
                setShowNotFound(false)
                setTracking("")
              }}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

