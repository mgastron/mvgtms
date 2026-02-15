"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Smartphone } from "lucide-react"
import { ModernHeader } from "@/components/modern-header"

export default function ChoferPage() {
  const router = useRouter()

  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const userProfile = sessionStorage.getItem("userProfile")
    
    if (!isAuthenticated || userProfile !== "Chofer") {
      router.push("/")
    }
  }, [router])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <ModernHeader />
      <div className="flex-1 flex flex-col p-4">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#6B46FF] to-[#8B5CF6] shadow-lg shadow-purple-500/20">
                <Smartphone className="h-10 w-10 text-white" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">Se ha logueado como chofer</h1>
              <p className="text-gray-600">
                Por favor para usar el TMS abrirlo desde la aplicación
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

