"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Montserrat } from "next/font/google"
import { cn } from "@/lib/utils"
import { ModernHeader } from "@/components/modern-header"

const montserrat = Montserrat({ subsets: ["latin"] })

type UtilidadItem = {
  title: string
  description: string
  path: string
}

const ITEMS: UtilidadItem[] = [
  {
    title: "Buscador de pedidos",
    description: "Buscar pedidos por tracking u otros datos.",
    path: "/utilidades/buscador",
  },
  {
    title: "Cotizá un viaje",
    description: "Tarifas y cotización según destino (lista de precios).",
    path: "/utilidades/lista-precios",
  },
]

export default function UtilidadesPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<string | null>(null)

  useEffect(() => {
    const profile = sessionStorage.getItem("userProfile")
    setUserProfile(profile)
  }, [])

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <ModernHeader />

      <main className={cn("px-4 pb-6 pt-3", montserrat.className)}>
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="mb-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">Cuenta</p>
            <h1 className="text-[32px] font-semibold tracking-tight text-[#1570ef]">Utilidades</h1>
            <p className="mt-1 text-[14px] text-[#5d6578]">
              Buscador de pedidos y cotización de viajes.
            </p>
          </div>

          {userProfile === "Chofer" ? (
            <div className="rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[#1f2433]">Sin acceso</p>
              <p className="mt-1 text-sm text-[#5d6578]">Estas utilidades no están disponibles para repartidores.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {ITEMS.map((it) => (
                <button
                  key={it.path}
                  type="button"
                  onClick={() => router.push(it.path)}
                  className="group rounded-2xl border border-[#e6eaf4] bg-white p-5 text-left shadow-sm transition hover:border-[#cfe0ff] hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[18px] font-semibold text-[#1f2433] group-hover:text-[#1459e9]">{it.title}</h2>
                      <p className="mt-1 text-[13px] text-[#5d6578]">{it.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#eff6ff] px-3 py-1 text-[12px] font-semibold text-[#1459e9]">
                      Abrir
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

