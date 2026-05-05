"use client"

import { useState } from "react"
import { Montserrat } from "next/font/google"
import { ModernHeader } from "@/components/modern-header"
import { FileUp, Upload, ArrowRight, X } from "lucide-react"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const cardClass =
  "rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm transition-colors hover:bg-[#f7faff]"

export default function CargarEnviosHubPage() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string>("")
  const [embedTitle, setEmbedTitle] = useState("")

  const openEmbed = (path: string, title: string) => {
    setEmbedTitle(title)
    setUrl(`${path}?embed=1`)
    setOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <ModernHeader />
      <main className={`px-4 pb-6 pt-3 ${montserrat.className}`}>
        <div className="mx-auto w-full max-w-[1100px] space-y-5">
          <div>
            <h1 className="text-[34px] font-semibold tracking-tight text-[#1570ef]">Cargar pedidos</h1>
            <p className="mt-1 text-[14px] text-[#5d6578]">
              Elija cómo desea ingresar los datos. El resultado es el mismo; solo varía el modo de carga.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <button type="button" onClick={() => openEmbed("/subir-individual", "Carga manual")} className={`${cardClass} text-left`}>
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
            </button>

            <button type="button" onClick={() => openEmbed("/subir-envio", "Carga por modelo")} className={`${cardClass} text-left`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#1459e9]">
                  <Upload className="h-5 w-5" aria-hidden />
                </div>
                <ArrowRight className="h-5 w-5 text-[#b0b6c4]" aria-hidden />
              </div>
              <h2 className="mt-4 text-[16px] font-semibold text-[#1f2433]">Carga por modelo</h2>
              <p className="mt-1 text-[13px] text-[#5d6578]">
                Importar una planilla con el modelo de Nexo para registrar varios envíos.
              </p>
            </button>

            <button type="button" onClick={() => openEmbed("/subir-flex-manual", "Carga Flex manual")} className={`${cardClass} text-left`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#1459e9]">
                  <Upload className="h-5 w-5" aria-hidden />
                </div>
                <ArrowRight className="h-5 w-5 text-[#b0b6c4]" aria-hidden />
              </div>
              <h2 className="mt-4 text-[16px] font-semibold text-[#1f2433]">Flex manual</h2>
              <p className="mt-1 text-[13px] text-[#5d6578]">
                Cargar pedidos Flex de forma manual para casos puntuales.
              </p>
            </button>
          </div>
        </div>
      </main>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="h-[92vh] w-[96vw] max-w-[1400px] overflow-hidden rounded-2xl border border-[#e6eaf4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#eef1f8] bg-[#fafbff] px-4 py-2.5">
              <p className="text-[15px] font-semibold tracking-tight text-[#1f2433]">{embedTitle}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-[#5d6578] hover:bg-white hover:text-[#1f2433]"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <iframe title={embedTitle || "Formulario"} src={url} className="h-full w-full" />
          </div>
        </div>
      )}
    </div>
  )
}

