"use client"

import { Montserrat } from "next/font/google"
import { ModernHeader } from "@/components/modern-header"
import { FileUp, Upload, ArrowRight } from "lucide-react"
import Link from "next/link"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const cardClass =
  "rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm transition-colors hover:bg-[#f7faff]"

export default function SubidaDePedidosPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <ModernHeader />
      <main className={`px-4 pb-6 pt-3 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1100px] space-y-5">
          <div>
            <h1 className="text-[34px] font-semibold tracking-tight text-[#1570ef]">Subida de pedidos</h1>
            <p className="mt-1 text-[14px] text-[#5d6578]">
              Seleccione el método de carga. La funcionalidad es la misma; cambia el flujo de ingreso.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Link href="/subir-individual" className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#1459e9]">
                  <FileUp className="h-5 w-5" aria-hidden />
                </div>
                <ArrowRight className="h-5 w-5 text-[#b0b6c4]" aria-hidden />
              </div>
              <h2 className="mt-4 text-[16px] font-semibold text-[#1f2433]">Carga manual</h2>
              <p className="mt-1 text-[13px] text-[#5d6578]">
                Ingresar un pedido/envío individual con sus datos y generar etiqueta.
              </p>
            </Link>

            <Link href="/subir-envio" className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#1459e9]">
                  <Upload className="h-5 w-5" aria-hidden />
                </div>
                <ArrowRight className="h-5 w-5 text-[#b0b6c4]" aria-hidden />
              </div>
              <h2 className="mt-4 text-[16px] font-semibold text-[#1f2433]">Carga por modelo</h2>
              <p className="mt-1 text-[13px] text-[#5d6578]">
                Subir una planilla con el modelo de Nexo para cargar múltiples envíos.
              </p>
            </Link>

            <Link href="/subir-flex-manual" className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#1459e9]">
                  <Upload className="h-5 w-5" aria-hidden />
                </div>
                <ArrowRight className="h-5 w-5 text-[#b0b6c4]" aria-hidden />
              </div>
              <h2 className="mt-4 text-[16px] font-semibold text-[#1f2433]">Flex manual</h2>
              <p className="mt-1 text-[13px] text-[#5d6578]">
                Cargar envíos Flex de forma manual para casos puntuales.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

