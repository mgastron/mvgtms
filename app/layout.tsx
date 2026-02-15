import type { Metadata } from "next"
import "./globals.css"

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
        <div suppressHydrationWarning>{children}</div>
      </body>
    </html>
  )
}

