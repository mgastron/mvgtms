"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

function isPathAllowedForCliente(pathname: string | null): boolean {
  if (!pathname) return true
  if (pathname === "/") return true
  if (pathname.startsWith("/envios")) return true
  if (pathname === "/subir-envio" || pathname === "/subir-individual" || pathname === "/reimprimir-noflex" || pathname === "/subir-flex-manual") return true
  return false
}

export function RouteGuardClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined") return

    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const userProfile = sessionStorage.getItem("userProfile")

    if (!isAuthenticated && pathname !== "/") {
      router.replace("/")
      return
    }

    if (userProfile === "Cliente" && !isPathAllowedForCliente(pathname)) {
      router.replace("/envios")
    }
  }, [pathname, router])

  return <>{children}</>
}
