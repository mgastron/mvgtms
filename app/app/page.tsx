"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Check, Copy, Download, Smartphone } from "lucide-react"
import { Montserrat } from "next/font/google"
import { BrandLockup } from "@/components/brand-lockup"
import {
  getDriverApkUrl,
  getDriverInstallUrl,
  getLocalTenantBranding,
  type TenantBranding,
} from "@/lib/tenant"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

export default function DriverAppInstallPage() {
  const [tenant, setTenant] = useState<TenantBranding>({
    slug: "nexo",
    nombre: "Nexo",
    logoUrl: "/logos/nexo-logo-white.png",
    colorPrimario: "#1459e9",
  })
  const [installUrl, setInstallUrl] = useState("")
  const [apkUrl, setApkUrl] = useState("")
  const [apkReady, setApkReady] = useState(false)
  const [qr, setQr] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const current = getLocalTenantBranding()
    setTenant(current)
    const pageUrl = getDriverInstallUrl()
    const relativeApk = getDriverApkUrl(current.slug)
    const absoluteApk = relativeApk.startsWith("http")
      ? relativeApk
      : `${window.location.origin}${relativeApk}`
    setInstallUrl(pageUrl)
    setApkUrl(absoluteApk)

    let cancelled = false
    const probe = async () => {
      const remoteApk = relativeApk.startsWith("http")
      if (remoteApk) {
        setApkReady(true)
        const dataUrl = await QRCode.toDataURL(absoluteApk, { width: 280, margin: 1 })
        if (!cancelled) setQr(dataUrl)
        return
      }
      try {
        const response = await fetch(absoluteApk, { method: "HEAD" })
        if (!cancelled && response.ok) {
          setApkReady(true)
          const dataUrl = await QRCode.toDataURL(absoluteApk, { width: 280, margin: 1 })
          setQr(dataUrl)
          return
        }
      } catch {
        // el APK todavía no está publicado
      }
      if (!cancelled) {
        const dataUrl = await QRCode.toDataURL(pageUrl, { width: 280, margin: 1 })
        setQr(dataUrl)
      }
    }
    void probe()
    return () => {
      cancelled = true
    }
  }, [])

  const copyLink = async () => {
    if (!installUrl) return
    try {
      await navigator.clipboard.writeText(installUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={`relative min-h-screen overflow-hidden bg-gradient-to-r from-[#1e86ff] via-[#2a67ff] to-[#2f46f5] ${montserrat.className}`}>
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        <img src="/logos/nexo-iso-white.png" alt="" className="absolute left-[10%] top-[24%] h-[42px] w-[42px] opacity-18" aria-hidden />
        <img src="/logos/nexo-iso-white.png" alt="" className="absolute right-[8%] top-[7%] h-[112px] w-[112px] opacity-14" aria-hidden />
        <img src="/logos/nexo-iso-white.png" alt="" className="absolute right-[17%] bottom-[17%] h-[118px] w-[118px] opacity-12" aria-hidden />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 md:px-10 md:py-12">
        <BrandLockup tenant={tenant} variant="login" />

        <div className="mt-10 grid items-start gap-8 md:mt-14 md:grid-cols-[1.1fr_0.9fr]">
          <div className="text-white">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
              App de repartidores
            </p>
            <h1 className="mt-2 max-w-xl text-[36px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[48px]">
              {tenant.slug === "mensajerialdp"
                ? "Instalá la app de Mensajería LDP"
                : `Instalá la app de ${tenant.nombre}`}
            </h1>
            <p className="mt-4 max-w-lg text-[17px] font-medium leading-relaxed text-[#dbe7ff]">
              Este enlace queda vinculado a {tenant.nombre}. Los choferes se loguean con el usuario que les creés en el TMS.
            </p>

            <ol className="mt-8 space-y-3 text-[15px] font-medium text-white/95">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-[13px]">1</span>
                <span>Abrí este link en el celular o escaneá el QR.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-[13px]">2</span>
                <span>Descargá e instalá la app de Android. Si Android avisa de orígenes desconocidos, permitilo solo para esta instalación.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-[13px]">3</span>
                <span>Ingresá con el usuario de repartidor creado en Configuración → Usuarios.</span>
              </li>
            </ol>
          </div>

          <div className="rounded-[16px] bg-white p-6 shadow-[0_16px_42px_rgba(14,29,120,0.34)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1459e9]/10 text-[#1459e9]">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-slate-900">Compartir con choferes</p>
                <p className="text-[13px] text-slate-500">{tenant.nombre}</p>
              </div>
            </div>

            <div className="mt-5 flex justify-center rounded-xl bg-slate-50 p-4">
              {qr ? (
                <img src={qr} alt="QR para instalar la app" className="h-[220px] w-[220px]" />
              ) : (
                <div className="h-[220px] w-[220px] animate-pulse rounded-lg bg-slate-200" />
              )}
            </div>

            <p className="mt-3 break-all text-center text-[12px] text-slate-500">{installUrl}</p>

            <div className="mt-5 grid gap-2">
              {apkReady ? (
                <a
                  href={apkUrl}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1459e9] px-4 text-[14px] font-semibold text-white hover:bg-[#1048c2]"
                >
                  <Download className="h-4 w-4" />
                  Descargar app Android
                </a>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-[13px] text-amber-900">
                  Este es el link de {tenant.nombre}. Cuando el APK esté publicado, acá aparece el botón de descarga. Mientras tanto, copiá y compartí el enlace.
                </div>
              )}
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-800 hover:bg-slate-50"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Enlace copiado" : "Copiar enlace"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
