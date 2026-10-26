import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "App de repartidores",
  description: "Descargá la app de choferes e ingresá con tu usuario.",
}

export default function DriverAppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
