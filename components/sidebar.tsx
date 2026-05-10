"use client"

import {
  Truck,
  Users,
  DollarSign,
  Route,
  ChevronDown,
  ChevronRight,
  FileCheck,
  Upload,
  Printer,
  Layers,
  FileBarChart,
  Settings,
  Briefcase,
  Store,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { logDev } from "@/lib/logger"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

const allMenuItems = [
  { icon: Truck, label: "Pedidos", active: false, hasSubmenu: true },
  { icon: Settings, label: "Configuración", active: false, hasSubmenu: true },
  { icon: Briefcase, label: "Administración", active: false, hasSubmenu: true },
  { icon: Route, label: "Repartidores", active: false, hasSubmenu: true },
]

const enviosSubmenu = [
  { icon: Upload, label: "Cargar pedidos" },
  { icon: Truck, label: "Pedidos" },
  { icon: Printer, label: "Reimpresión de etiquetas" },
]

const configuracionSubmenu = [
  { icon: Users, label: "Usuarios" },
  { icon: Layers, label: "Grupos" },
  { icon: Store, label: "Vendedores" },
]

const administracionSubmenu = [
  { icon: FileBarChart, label: "Informes" },
  { icon: DollarSign, label: "Tarifa" },
]

const ruteateSubmenu = [
  { icon: Route, label: "Ubicación" },
  { icon: FileCheck, label: "Cierre" },
]

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [configuracionOpen, setConfiguracionOpen] = useState(false)
  const [administracionOpen, setAdministracionOpen] = useState(false)
  const [enviosOpen, setEnviosOpen] = useState(false)
  const [ruteateOpen, setRuteateOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<string | null>(null)

  useEffect(() => {
    const profile = sessionStorage.getItem("userProfile")
    setUserProfile(profile)
  }, [])

  const enviosSubmenuFiltered =
    userProfile === "Coordinador" ? enviosSubmenu : enviosSubmenu
  const administracionSubmenuFiltered =
    userProfile === "Coordinador"
      ? administracionSubmenu.filter((s) => s.label !== "Tarifa")
      : administracionSubmenu

  const getFilteredMenuItems = () => {
    if (!userProfile) return allMenuItems

    if (userProfile === "Cliente") {
      return allMenuItems.filter(
        (item) => item.label !== "Configuración" && item.label !== "Administración"
      )
    }

    return allMenuItems
  }

  const menuItems = getFilteredMenuItems()

  const getActiveItem = () => {
    if (pathname?.includes("/configuracion/usuarios")) return "Usuarios"
    if (pathname?.includes("/configuracion/grupos")) return "Grupos"
    if (pathname?.includes("/administracion/informes")) return "Informes"
    if (pathname?.includes("/administracion/tarifa")) return "Tarifa"
    if (pathname?.includes("/configuracion/vendedores")) return "Vendedores"
    if (pathname?.includes("/pedidos/reimpresion-etiquetas")) return "Reimpresión de etiquetas"
    if (
      pathname?.includes("/pedidos/cargar") ||
      pathname?.includes("/subir-individual") ||
      pathname?.includes("/subir-envio") ||
      pathname?.includes("/subir-flex-manual")
    ) {
      return "Cargar pedidos"
    }
    if (pathname?.includes("/pedidos")) return "Pedidos"
    if (pathname?.includes("/repartidores/ubicacion")) return "Ubicación"
    if (pathname?.includes("/repartidores/cierre")) return "Cierre"
    return null
  }

  const activeItem = getActiveItem()

  useEffect(() => {
    if (
      pathname?.includes("/configuracion/usuarios") ||
      pathname?.includes("/configuracion/grupos") ||
      pathname?.includes("/configuracion/vendedores")
    ) {
      setConfiguracionOpen(true)
    }
    if (
      pathname?.includes("/administracion/informes") ||
      pathname?.includes("/administracion/tarifa") ||
      pathname?.includes("/administracion/estado-ordenes")
    ) {
      setAdministracionOpen(true)
    }
    if (
      pathname?.includes("/pedidos") ||
      pathname?.includes("/reimprimir-noflex") ||
      pathname?.includes("/subir-individual") ||
      pathname?.includes("/subir-envio") ||
      pathname?.includes("/subir-flex-manual")
    ) {
      setEnviosOpen(true)
    }
    if (pathname?.includes("/repartidores")) {
      setRuteateOpen(true)
    }
  }, [pathname])

  const closeAllExcept = (key: "envios" | "config" | "admin" | "ruteate") => {
    setEnviosOpen(key === "envios")
    setConfiguracionOpen(key === "config")
    setAdministracionOpen(key === "admin")
    setRuteateOpen(key === "ruteate")
  }

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground" suppressHydrationWarning>
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4" suppressHydrationWarning>
        <img src="/logos/nexo-iso-white.png" alt="Nexo" className="h-8 w-8" />
        <span className="text-lg font-semibold">Nexo</span>
      </div>

      <nav className="py-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isConfiguracion = item.label === "Configuración"
          const isAdministracion = item.label === "Administración"
          const isEnvios = item.label === "Pedidos"
          const isRuteate = item.label === "Repartidores"
          const hasSubmenu = item.hasSubmenu || false

          return (
            <div key={item.label}>
              <button
                onClick={() => {
                  if (isConfiguracion) {
                    setConfiguracionOpen(!configuracionOpen)
                    setAdministracionOpen(false)
                    setEnviosOpen(false)
                    setRuteateOpen(false)
                  } else if (isAdministracion) {
                    setAdministracionOpen(!administracionOpen)
                    setConfiguracionOpen(false)
                    setEnviosOpen(false)
                    setRuteateOpen(false)
                  } else if (isEnvios) {
                    setEnviosOpen(!enviosOpen)
                    setConfiguracionOpen(false)
                    setAdministracionOpen(false)
                    setRuteateOpen(false)
                  } else if (isRuteate) {
                    setRuteateOpen(!ruteateOpen)
                    setConfiguracionOpen(false)
                    setAdministracionOpen(false)
                    setEnviosOpen(false)
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-sidebar-accent",
                  activeItem === item.label && "bg-sidebar-accent",
                  (isConfiguracion && configuracionOpen) && "bg-sidebar-accent",
                  (isAdministracion && administracionOpen) && "bg-sidebar-accent",
                  (isEnvios && enviosOpen) && "bg-sidebar-accent",
                  (isRuteate && ruteateOpen) && "bg-sidebar-accent"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </div>
                {hasSubmenu ? (
                  (isConfiguracion && configuracionOpen) ||
                  (isAdministracion && administracionOpen) ||
                  (isEnvios && enviosOpen) ||
                  (isRuteate && ruteateOpen) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>

              {isEnvios && enviosOpen && (
                <div className="bg-sidebar/80">
                  {enviosSubmenuFiltered.map((subItem) => {
                    const SubIcon = subItem.icon
                    return (
                      <button
                        key={subItem.label}
                        onClick={() => {
                          if (subItem.label === "Cargar pedidos") {
                            router.push("/pedidos/cargar")
                          } else if (subItem.label === "Reimpresión de etiquetas") {
                            router.push("/pedidos/reimpresion-etiquetas")
                          } else if (subItem.label === "Pedidos") {
                            router.push("/pedidos")
                          } else {
                            logDev(`Navegar a: ${subItem.label}`)
                          }
                          closeAllExcept("envios")
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 pl-12 text-sm transition-colors hover:bg-sidebar-accent whitespace-nowrap",
                          activeItem === subItem.label && "bg-sidebar-accent"
                        )}
                      >
                        <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                          <div className="h-0.5 w-2 bg-sidebar-foreground/40" />
                        </div>
                        <SubIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {isConfiguracion && configuracionOpen && (
                <div className="bg-sidebar/80">
                  {configuracionSubmenu.map((subItem) => {
                    const SubIcon = subItem.icon
                    return (
                      <button
                        key={subItem.label}
                        onClick={() => {
                          if (subItem.label === "Usuarios") {
                            router.push("/configuracion/usuarios")
                          } else if (subItem.label === "Grupos") {
                            router.push("/configuracion/grupos")
                          } else if (subItem.label === "Vendedores") {
                            router.push("/configuracion/vendedores")
                          }
                          closeAllExcept("config")
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 pl-12 text-sm transition-colors hover:bg-sidebar-accent",
                          activeItem === subItem.label && "bg-sidebar-accent"
                        )}
                      >
                        <div className="flex h-4 w-4 items-center justify-center">
                          <div className="h-0.5 w-2 bg-sidebar-foreground/40" />
                        </div>
                        <SubIcon className="h-4 w-4" />
                        <span>{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {isAdministracion && administracionOpen && (
                <div className="bg-sidebar/80">
                  {administracionSubmenuFiltered.map((subItem) => {
                    const SubIcon = subItem.icon
                    return (
                      <button
                        key={subItem.label}
                        onClick={() => {
                          if (subItem.label === "Informes") {
                            router.push("/administracion/informes")
                          } else if (subItem.label === "Tarifa") {
                            router.push("/administracion/tarifa")
                          }
                          closeAllExcept("admin")
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 pl-12 text-sm transition-colors hover:bg-sidebar-accent",
                          activeItem === subItem.label && "bg-sidebar-accent"
                        )}
                      >
                        <div className="flex h-4 w-4 items-center justify-center">
                          <div className="h-0.5 w-2 bg-sidebar-foreground/40" />
                        </div>
                        <SubIcon className="h-4 w-4" />
                        <span>{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {isRuteate && ruteateOpen && (
                <div className="bg-sidebar/80">
                  {ruteateSubmenu.map((subItem) => {
                    const SubIcon = subItem.icon
                    return (
                      <button
                        key={subItem.label}
                        onClick={() => {
                          if (subItem.label === "Ubicación") {
                            router.push("/repartidores/ubicacion")
                          } else if (subItem.label === "Cierre") {
                            router.push("/repartidores/cierre")
                          }
                          closeAllExcept("ruteate")
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 pl-12 text-sm transition-colors hover:bg-sidebar-accent",
                          activeItem === subItem.label && "bg-sidebar-accent"
                        )}
                      >
                        <div className="flex h-4 w-4 items-center justify-center">
                          <div className="h-0.5 w-2 bg-sidebar-foreground/40" />
                        </div>
                        <SubIcon className="h-4 w-4" />
                        <span>{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
