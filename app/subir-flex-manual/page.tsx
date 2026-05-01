"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getApiBaseUrl } from "@/lib/api-config"
import { Montserrat } from "next/font/google"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export default function SubirFlexManualPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    sellerId: "",
    shipmentId: "",
  })

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")

    if (!isAuthenticated) {
      router.push("/")
      return
    }

  }, [router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
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

      await response.json()
      setSuccess(true)
      setFormData({ sellerId: "", shipmentId: "" })

      setTimeout(() => {
        router.push("/envios")
      }, 2000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al subir el envío Flex"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setFormData({ sellerId: "", shipmentId: "" })
    setError(null)
    setSuccess(false)
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <ModernHeader />
      <main className={`px-4 pb-6 pt-4 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1700px]">
          <h1 className="mb-5 text-[34px] font-semibold tracking-tight text-[#1570ef]">Subir Flex Manual</h1>

          <div className="ml-2 max-w-[560px] rounded-2xl border border-[#e6eaf4] bg-white p-6 shadow-sm min-h-[500px]">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="sellerId" className="block text-[14px] font-medium text-[#4d5571]">
                  Vendedor ID
                </label>
                <Input
                  id="sellerId"
                  name="sellerId"
                  type="text"
                  value={formData.sellerId}
                  onChange={handleInputChange}
                  required
                  className="h-10 text-[14px] text-[#525b76]"
                  placeholder="Ingresá el ID del vendedor"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="shipmentId" className="block text-[14px] font-medium text-[#4d5571]">
                  Shipment ID
                </label>
                <Input
                  id="shipmentId"
                  name="shipmentId"
                  type="text"
                  value={formData.shipmentId}
                  onChange={handleInputChange}
                  required
                  className="h-10 text-[14px] text-[#525b76]"
                  placeholder="Ingresá el ID del shipment"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[14px] font-medium text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[14px] font-medium text-green-700">
                  Envío Flex subido correctamente. Redirigiendo…
                </div>
              )}

              <div className="space-y-2 pt-1">
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-full rounded-xl bg-[#eef4ff] text-[14px] font-semibold text-[#1570ef] hover:bg-[#e3edff] disabled:opacity-50"
                >
                  {loading ? "Subiendo…" : "Subir"}
                </Button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-full text-center text-[13px] font-medium text-[#626d91] underline-offset-2 hover:text-[#4f46ce] hover:underline"
                >
                  Limpiar campos
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
