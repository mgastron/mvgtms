"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

function isPathAllowedForCliente(pathname: string | null): boolean {
  if (!pathname) return true
  if (pathname === "/") return true
  if (pathname.startsWith("/pedidos")) return true
  if (pathname.startsWith("/utilidades")) return true
  if (pathname.startsWith("/tracking/")) return true
  if (pathname === "/subir-envio" || pathname === "/subir-individual" || pathname === "/reimprimir-noflex" || pathname === "/subir-flex-manual") return true
  if (pathname.startsWith("/utilidades/buscador")) return true
  return false
}

export function RouteGuardClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined") return

    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const userProfile = sessionStorage.getItem("userProfile")

    // Rutas públicas: vinculación, tracking de envíos y buscador de pedidos (no requieren login)
    const isPublicPath =
      (pathname?.startsWith("/auth/") ?? false) ||
      (pathname?.startsWith("/tracking/") ?? false) ||
      (pathname?.startsWith("/utilidades/buscador") ?? false)

    if (!isAuthenticated && pathname !== "/" && !isPublicPath) {
      router.replace("/")
      return
    }

    if (userProfile === "Cliente" && !isPathAllowedForCliente(pathname) && !isPublicPath) {
      router.replace("/pedidos")
    }
  }, [pathname, router])

  return <>{children}</>
}
