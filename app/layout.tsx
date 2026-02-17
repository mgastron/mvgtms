import type { Metadata } from "next"
import "./globals.css"
import { RouteGuardClient } from "@/components/route-guard-client"

export const metadata: Metadata = {
  title: "TMS Llegue - Sistema de Gestión de Transporte",
  description: "Sistema de gestión de transporte y logística",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning>
        <RouteGuardClient>
          <div suppressHydrationWarning>{children}</div>
        </RouteGuardClient>
      </body>
    </html>
  )
}

