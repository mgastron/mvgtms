import type { Metadata } from "next"
import "./globals.css"
import { montserrat } from "@/lib/fonts"
import { RouteGuardClient } from "@/components/route-guard-client"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "Nexo",
  description: "Gestión de transporte y logística",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={montserrat.variable} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning>
        <RouteGuardClient>
          <div suppressHydrationWarning>{children}</div>
        </RouteGuardClient>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}

