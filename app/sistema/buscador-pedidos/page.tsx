"use client"

import { useState } from "react"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, AlertCircle } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"
import { errorDev } from "@/lib/logger"
import { Montserrat } from "next/font/google"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

export default function BuscadorPedidosPage() {
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
    <div className="min-h-screen bg-[#f7f8fc]" suppressHydrationWarning>
      <ModernHeader />
      <main className={`px-4 pb-6 pt-3 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px]">
          <h1 className="mb-4 text-[34px] font-semibold tracking-tight text-[#1570ef]">Buscador de pedidos</h1>

          <div className="ml-2 w-full max-w-[560px] rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="buscador-tracking" className="block text-[14px] font-medium text-[#4d5571]">
                  ID_MVG o tracking
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8890a8]" aria-hidden />
                  <Input
                    id="buscador-tracking"
                    type="text"
                    placeholder="Ingresá ID_MVG o tracking…"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    disabled={loading}
                    className="h-10 rounded-xl border border-[#e6eaf4] bg-white pl-10 pr-3 text-[14px] font-medium text-[#1f2433] shadow-sm placeholder:font-normal placeholder:text-[#8890a8] focus-visible:border-[#1570ef] focus-visible:ring-2 focus-visible:ring-[#1570ef]/20 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="submit"
                  disabled={loading || !tracking.trim()}
                  className="h-10 w-full rounded-xl bg-[#1459e9] px-6 text-[14px] font-semibold text-white shadow-sm hover:bg-[#114bce] disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border-2 border-white border-t-transparent animate-spin"
                        aria-hidden
                      />
                      Buscando…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Search className="h-4 w-4" aria-hidden />
                      Buscar
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>

      <AlertDialog open={showNotFound} onOpenChange={setShowNotFound}>
        <AlertDialogContent className={`max-w-md ${montserrat.className}`}>
          <AlertDialogHeader>
            <div className="mb-3 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-7 w-7 text-red-600" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-xl font-semibold text-[#1f2433]">
              Envío no encontrado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-1 text-center text-[14px] leading-relaxed text-[#5d6578]">
                <p>
                  No se encontró ningún envío con{" "}
                  <span className="font-semibold text-[#1f2433]">{tracking || "ese dato"}</span>.
                </p>
                <p>Verificá el ID_MVG o el tracking e intentá de nuevo.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction
              onClick={() => {
                setShowNotFound(false)
                setTracking("")
              }}
              className="rounded-xl bg-[#1459e9] px-6 text-[14px] font-semibold text-white hover:bg-[#114bce]"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

