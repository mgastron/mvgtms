"use client"

import { Truck, FileText, Package, Wrench, Users, DollarSign, Route, ChevronDown, ChevronRight, List, FileCheck, Upload, PackageSearch, Printer, FileUp, Search, Layers, FileBarChart } from "lucide-react"
import { cn } from "@/lib/utils"
import { logDev } from "@/lib/logger"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

const allMenuItems = [
  { icon: Truck, label: "Envíos", active: false, hasSubmenu: true },
  { icon: Wrench, label: "Sistema", active: false, hasSubmenu: true },
  { icon: Users, label: "Cuentas", active: true },
  { icon: Route, label: "Choferes", active: false, hasSubmenu: true },
]

const enviosSubmenu = [
  { icon: Upload, label: "Cargar envíos" },
  { icon: Truck, label: "Envios" },
  { icon: DollarSign, label: "Lista de Precios" },
  { icon: Printer, label: "Etiquetas NoFlex" },
  { icon: Search, label: "Buscador de Pedidos" },
]

const sistemaSubmenu = [
  { icon: Users, label: "Usuarios" },
  { icon: Layers, label: "Grupos" },
  { icon: FileBarChart, label: "Informes" },
  { icon: DollarSign, label: "Lista Precios" },
  { icon: FileCheck, label: "Estado Órdenes" },
]

const ruteateSubmenu = [
  { icon: Route, label: "Ubicación" },
  { icon: FileCheck, label: "Cierre" },
]

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [sistemaOpen, setSistemaOpen] = useState(false)
  const [enviosOpen, setEnviosOpen] = useState(false)
  const [ruteateOpen, setRuteateOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<string | null>(null)
  
  useEffect(() => {
    // Obtener el perfil del usuario del sessionStorage
    const profile = sessionStorage.getItem("userProfile")
    setUserProfile(profile)
  }, [])
  
  // Coordinador no ve: Envíos > Lista de Precios; Sistema > Lista Precios, Estado Órdenes
  const enviosSubmenuFiltered =
    userProfile === "Coordinador"
      ? enviosSubmenu.filter((s) => s.label !== "Lista de Precios")
      : enviosSubmenu
  const sistemaSubmenuFiltered =
    userProfile === "Coordinador"
      ? sistemaSubmenu.filter((s) => s.label !== "Lista Precios" && s.label !== "Estado Órdenes")
      : sistemaSubmenu

  // Filtrar elementos del menú según el perfil del usuario
  const getFilteredMenuItems = () => {
    if (!userProfile) return allMenuItems
    
    // Usuarios tipo "Cliente" no pueden ver "Sistema" ni "Clientes"
    if (userProfile === "Cliente") {
      return allMenuItems.filter(
        (item) => item.label !== "Sistema" && item.label !== "Cuentas"
      )
    }
    
    // Resto de usuarios pueden ver todo
    return allMenuItems
  }
  
  const menuItems = getFilteredMenuItems()
  
  // Determinar el item activo basado en la ruta actual
  const getActiveItem = () => {
    if (pathname?.includes("/usuarios")) return "Usuarios"
    if (pathname?.includes("/sistema/grupos")) return "Grupos"
    if (pathname?.includes("/sistema/informes")) return "Informes"
    if (pathname?.includes("/lista-precios") && !pathname?.includes("/envios")) return "Lista Precios"
    if (pathname?.includes("/sistema/estado-ordenes")) return "Estado Órdenes"
    if (pathname?.includes("/sistema/buscador-pedidos")) return "Buscador de Pedidos"
    if (pathname?.includes("/clientes")) return "Cuentas"
    if (pathname?.includes("/reimprimir-noflex")) return "Etiquetas NoFlex"
    if (pathname?.includes("/envios/subida") || pathname?.includes("/subir-individual") || pathname?.includes("/subir-envio") || pathname?.includes("/subir-flex-manual")) return "Cargar envíos"
    if (pathname?.includes("/envios/lista-precios")) return "Lista de Precios"
    if (pathname?.includes("/envios")) return "Envios"
    if (pathname?.includes("/ruteate/geochoferes")) return "Ubicación"
    if (pathname?.includes("/ruteate/cierre")) return "Cierre"
    return null
  }
  
  const activeItem = getActiveItem()
  
  // Abrir automáticamente los submenús si estamos en una página del submenú
  useEffect(() => {
    if (pathname?.includes("/usuarios") || pathname?.includes("/lista-precios") || pathname?.includes("/sistema/estado-ordenes") || pathname?.includes("/sistema/grupos") || pathname?.includes("/sistema/informes")) {
      setSistemaOpen(true)
    }
    if (pathname?.includes("/reimprimir-noflex") || pathname?.includes("/subir-individual") || pathname?.includes("/subir-envio") || pathname?.includes("/subir-flex-manual") || pathname?.includes("/envios") || pathname?.includes("/sistema/buscador-pedidos")) {
      setEnviosOpen(true)
    }
    if (pathname?.includes("/ruteate")) {
      setRuteateOpen(true)
    }
  }, [pathname])

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground" suppressHydrationWarning>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4" suppressHydrationWarning>
        <img src="/logos/nexo-iso-white.png" alt="Nexo" className="h-8 w-8" />
        <span className="text-lg font-semibold">Nexo</span>
      </div>

      {/* Menu Items */}
      <nav className="py-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isSistema = item.label === "Sistema"
          const isEnvios = item.label === "Envíos"
          const isRuteate = item.label === "Choferes"
          const hasSubmenu = item.hasSubmenu || false
          
          return (
            <div key={item.label}>
              <button
                onClick={() => {
                  if (isSistema) {
                    setSistemaOpen(!sistemaOpen)
                    setEnviosOpen(false)
                    setRuteateOpen(false)
                  } else if (isEnvios) {
                    setEnviosOpen(!enviosOpen)
                    setSistemaOpen(false)
                    setRuteateOpen(false)
                  } else if (isRuteate) {
                    setRuteateOpen(!ruteateOpen)
                    setSistemaOpen(false)
                    setEnviosOpen(false)
                  } else {
                    setSistemaOpen(false)
                    setEnviosOpen(false)
                    setRuteateOpen(false)
                    if (item.label === "Cuentas") {
                      router.push("/clientes")
                    }
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-sidebar-accent",
                  activeItem === item.label && "bg-sidebar-accent",
                  (isSistema && sistemaOpen) && "bg-sidebar-accent",
                  (isEnvios && enviosOpen) && "bg-sidebar-accent",
                  (isRuteate && ruteateOpen) && "bg-sidebar-accent",
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </div>
                {hasSubmenu ? (
                  (isSistema && sistemaOpen) || (isEnvios && enviosOpen) || (isRuteate && ruteateOpen) ? (
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
              
              {/* Submenu de Envíos */}
              {isEnvios && enviosOpen && (
                <div className="bg-sidebar/80">
                  {enviosSubmenuFiltered.map((subItem) => {
                    const SubIcon = subItem.icon
                    return (
                      <button
                        key={subItem.label}
                        onClick={() => {
                          if (subItem.label === "Cargar envíos") {
                            router.push("/envios/subida")
                          } else if (subItem.label === "Etiquetas NoFlex") {
                            router.push("/reimprimir-noflex")
                          } else if (subItem.label === "Envios") {
                            router.push("/envios")
                          } else if (subItem.label === "Lista de Precios") {
                            router.push("/envios/lista-precios")
                          } else if (subItem.label === "Buscador de Pedidos") {
                            router.push("/sistema/buscador-pedidos")
                          } else {
                            logDev(`Navegar a: ${subItem.label}`)
                          }
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 pl-12 text-sm transition-colors hover:bg-sidebar-accent whitespace-nowrap",
                          activeItem === subItem.label && "bg-sidebar-accent",
                        )}
                      >
                        <div className="flex h-4 w-4 items-center justify-center flex-shrink-0">
                          <div className="h-0.5 w-2 bg-sidebar-foreground/40" />
                        </div>
                        <SubIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              
              {/* Submenu de Sistema */}
              {isSistema && sistemaOpen && (
                <div className="bg-sidebar/80">
                  {sistemaSubmenuFiltered.map((subItem) => {
                    const SubIcon = subItem.icon
                    return (
                      <button
                        key={subItem.label}
                        onClick={() => {
                          if (subItem.label === "Usuarios") {
                            router.push("/usuarios")
                          } else if (subItem.label === "Grupos") {
                            router.push("/sistema/grupos")
                          } else if (subItem.label === "Informes") {
                            router.push("/sistema/informes")
                          } else if (subItem.label === "Lista Precios") {
                            router.push("/lista-precios")
                          } else if (subItem.label === "Estado Órdenes") {
                            router.push("/sistema/estado-ordenes")
                          }
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 pl-12 text-sm transition-colors hover:bg-sidebar-accent",
                          activeItem === subItem.label && "bg-sidebar-accent",
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
              
              {/* Submenu de Choferes */}
              {isRuteate && ruteateOpen && (
                <div className="bg-sidebar/80">
                  {ruteateSubmenu.map((subItem) => {
                    const SubIcon = subItem.icon
                    return (
                      <button
                        key={subItem.label}
                        onClick={() => {
                          if (subItem.label === "Ubicación") {
                            router.push("/ruteate/geochoferes")
                          } else if (subItem.label === "Cierre") {
                            router.push("/ruteate/cierre")
                          }
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 pl-12 text-sm transition-colors hover:bg-sidebar-accent",
                          activeItem === subItem.label && "bg-sidebar-accent",
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

