"use client"

import { Truck, FileText, Package, Wrench, Users, DollarSign, Route, ChevronDown, ChevronRight, List, FileCheck, Upload, PackageSearch, Printer, FileUp, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { logDev } from "@/lib/logger"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

const allMenuItems = [
  { icon: Truck, label: "Envíos", active: false, hasSubmenu: true },
  { icon: Wrench, label: "Sistema", active: false, hasSubmenu: true },
  { icon: Users, label: "Clientes", active: true },
  { icon: Route, label: "Ruteate", active: false, hasSubmenu: true },
]

const enviosSubmenu = [
  { icon: Upload, label: "Subir envio" },
  { icon: Truck, label: "Envios" },
  { icon: DollarSign, label: "Lista de Precios" },
  { icon: Printer, label: "Reimprimir NoFlex" },
  { icon: FileUp, label: "Subir individual" },
  { icon: FileUp, label: "Subir Flex Manual" },
  { icon: Search, label: "Buscador de Pedidos" },
]

const sistemaSubmenu = [
  { icon: Users, label: "Usuarios" },
  { icon: DollarSign, label: "Lista Precios" },
  { icon: FileCheck, label: "Estado Órdenes" },
]

const ruteateSubmenu = [
  { icon: Route, label: "Geochoferes" },
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
  
  // Filtrar elementos del menú según el perfil del usuario
  const getFilteredMenuItems = () => {
    if (!userProfile) return allMenuItems
    
    // Usuarios tipo "Cliente" no pueden ver "Sistema" ni "Clientes"
    if (userProfile === "Cliente") {
      return allMenuItems.filter(
        (item) => item.label !== "Sistema" && item.label !== "Clientes"
      )
    }
    
    // Resto de usuarios pueden ver todo
    return allMenuItems
  }
  
  const menuItems = getFilteredMenuItems()
  
  // Determinar el item activo basado en la ruta actual
  const getActiveItem = () => {
    if (pathname?.includes("/usuarios")) return "Usuarios"
    if (pathname?.includes("/lista-precios") && !pathname?.includes("/envios")) return "Lista Precios"
    if (pathname?.includes("/sistema/estado-ordenes")) return "Estado Órdenes"
    if (pathname?.includes("/sistema/buscador-pedidos")) return "Buscador de Pedidos"
    if (pathname?.includes("/clientes")) return "Clientes"
    if (pathname?.includes("/reimprimir-noflex")) return "Reimprimir NoFlex"
    if (pathname?.includes("/subir-individual")) return "Subir individual"
    if (pathname?.includes("/subir-envio")) return "Subir envio"
    if (pathname?.includes("/subir-flex-manual")) return "Subir Flex Manual"
    if (pathname?.includes("/envios/lista-precios")) return "Lista de Precios"
    if (pathname?.includes("/envios")) return "Envios"
    if (pathname?.includes("/ruteate/geochoferes")) return "Geochoferes"
    if (pathname?.includes("/ruteate/cierre")) return "Cierre"
    return null
  }
  
  const activeItem = getActiveItem()
  
  // Abrir automáticamente los submenús si estamos en una página del submenú
  useEffect(() => {
    if (pathname?.includes("/usuarios") || pathname?.includes("/lista-precios") || pathname?.includes("/sistema/estado-ordenes")) {
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
        <div className="flex h-8 w-8 items-center justify-center rounded bg-sidebar-accent">
          <span className="text-sm font-black tracking-tight text-sidebar-accent-foreground">MVG</span>
        </div>
        <span className="text-lg font-semibold">MVG</span>
      </div>

      {/* Menu Items */}
      <nav className="py-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isSistema = item.label === "Sistema"
          const isEnvios = item.label === "Envíos"
          const isRuteate = item.label === "Ruteate"
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
                    if (item.label === "Clientes") {
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
                  {enviosSubmenu.map((subItem) => {
                    const SubIcon = subItem.icon
                    return (
                      <button
                        key={subItem.label}
                        onClick={() => {
                          if (subItem.label === "Subir individual") {
                            router.push("/subir-individual")
                          } else if (subItem.label === "Reimprimir NoFlex") {
                            router.push("/reimprimir-noflex")
                          } else if (subItem.label === "Subir envio") {
                            router.push("/subir-envio")
                          } else if (subItem.label === "Envios") {
                            router.push("/envios")
                          } else if (subItem.label === "Lista de Precios") {
                            router.push("/envios/lista-precios")
                          } else if (subItem.label === "Subir Flex Manual") {
                            router.push("/subir-flex-manual")
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
                  {sistemaSubmenu.map((subItem) => {
                    const SubIcon = subItem.icon
                    return (
                      <button
                        key={subItem.label}
                        onClick={() => {
                          if (subItem.label === "Usuarios") {
                            router.push("/usuarios")
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
              
              {/* Submenu de Ruteate */}
              {isRuteate && ruteateOpen && (
                <div className="bg-sidebar/80">
                  {ruteateSubmenu.map((subItem) => {
                    const SubIcon = subItem.icon
                    return (
                      <button
                        key={subItem.label}
                        onClick={() => {
                          if (subItem.label === "Geochoferes") {
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

