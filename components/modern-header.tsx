"use client"

import { Truck, FileText, Package, Wrench, Users, DollarSign, Route, ChevronDown, Upload, Printer, FileUp, FileCheck, Search, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { UserProfile } from "@/components/user-profile"

const allMenuItems = [
  { 
    icon: Truck, 
    label: "Envíos", 
    hasSubmenu: true,
    submenu: [
      { icon: Upload, label: "Subir envio", path: "/subir-envio" },
      { icon: Truck, label: "Envios", path: "/envios" },
      { icon: DollarSign, label: "Lista de Precios", path: "/envios/lista-precios" },
      { icon: Printer, label: "Reimprimir NoFlex", path: "/reimprimir-noflex" },
      { icon: FileUp, label: "Subir individual", path: "/subir-individual" },
      { icon: FileUp, label: "Subir Flex Manual", path: "/subir-flex-manual" },
    ]
  },
  { 
    icon: Wrench, 
    label: "Sistema", 
    hasSubmenu: true,
    submenu: [
      { icon: Users, label: "Usuarios", path: "/usuarios" },
      { icon: DollarSign, label: "Lista Precios", path: "/lista-precios" },
      { icon: FileCheck, label: "Estado Órdenes", path: "/sistema/estado-ordenes" },
      { icon: Search, label: "Buscador de Pedidos", path: "/sistema/buscador-pedidos" },
    ]
  },
  { 
    icon: Users, 
    label: "Clientes", 
    hasSubmenu: false,
    path: "/clientes"
  },
  { 
    icon: Route, 
    label: "Ruteate", 
    hasSubmenu: true,
    submenu: [
      { icon: Route, label: "Geochoferes", path: "/ruteate/geochoferes" },
      { icon: FileCheck, label: "Cierre", path: "/ruteate/cierre" },
    ]
  },
]

export function ModernHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<string | null>(null)
  
  useEffect(() => {
    const profile = sessionStorage.getItem("userProfile")
    setUserProfile(profile)
  }, [])
  
  // Para perfil Cliente: solo ítems de Envíos, mostrados directos en la barra (sin desplegable)
  const enviosFlatItems = allMenuItems
    .find((i) => i.label === "Envíos")
    ?.submenu?.map((sub) => ({ icon: sub.icon, label: sub.label, path: sub.path, hasSubmenu: false as const })) ?? []

  // Filtrar elementos del menú según el perfil del usuario
  const getFilteredMenuItems = () => {
    if (userProfile === "Cliente") {
      return enviosFlatItems
    }

    // Chofer y Cliente no ven Ruteate; el resto (Administrativo, etc.) sí
    if (userProfile === "Chofer") {
      return allMenuItems.filter((item) => item.label !== "Ruteate")
    }

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
  
  // Determinar qué menú principal está activo
  const getActiveMainItem = () => {
    // Verificar rutas de Envíos primero (antes de Sistema) para evitar conflictos
    if (pathname?.includes("/reimprimir-noflex") || pathname?.includes("/subir") || pathname?.includes("/envios")) return "Envíos"
    // Verificar rutas de Sistema (excluyendo /envios/lista-precios que ya fue capturado arriba)
    if (pathname?.includes("/usuarios") || (pathname?.includes("/lista-precios") && !pathname?.includes("/envios")) || pathname?.includes("/sistema")) return "Sistema"
    if (pathname?.includes("/clientes")) return "Clientes"
    if (pathname?.includes("/ruteate")) return "Ruteate"
    return null
  }
  
  const activeMainItem = getActiveMainItem()
  
  const handleItemClick = (item: typeof allMenuItems[0]) => {
    if (item.hasSubmenu) {
      setOpenDropdown(openDropdown === item.label ? null : item.label)
    } else if (item.path) {
      router.push(item.path)
      setMobileMenuOpen(false)
    }
  }
  
  const handleSubmenuClick = (path: string) => {
    router.push(path)
    setOpenDropdown(null)
    setMobileMenuOpen(false)
  }
  
  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setOpenDropdown(null)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 shadow-sm shadow-gray-200/50" suppressHydrationWarning>
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo MVG */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/envios")}
                className="flex items-center gap-3 hover:opacity-90 transition-opacity"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/40">
                  <span className="text-lg font-black tracking-tight text-white">MVG</span>
                </div>
                <div className="hidden sm:block">
                  <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent tracking-tight">
                    MVG
                  </span>
                </div>
              </button>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = item.hasSubmenu ? activeMainItem === item.label : activeItem === item.label
                const isOpen = openDropdown === item.label
                
                return (
                  <div key={item.label} className="relative dropdown-container">
                    <button
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-gradient-to-r from-indigo-50 via-cyan-50 to-teal-50 text-indigo-700 shadow-sm border border-indigo-100"
                          : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {item.hasSubmenu && (
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          isOpen && "rotate-180"
                        )} />
                      )}
                    </button>
                    
                    {/* Dropdown Menu */}
                    {item.hasSubmenu && isOpen && (
                      <div className="absolute top-full left-0 mt-2 w-56 rounded-xl bg-white shadow-xl border border-gray-200 py-2 z-50 transition-all duration-200">
                        {item.submenu?.map((subItem) => {
                          const SubIcon = subItem.icon
                          const isSubActive = activeItem === subItem.label
                          
                          return (
                            <button
                              key={subItem.label}
                              onClick={() => handleSubmenuClick(subItem.path)}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                                isSubActive
                                  ? "bg-gradient-to-r from-indigo-50 via-cyan-50 to-teal-50 text-indigo-700 font-medium border-l-2 border-indigo-500"
                                  : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-cyan-50"
                              )}
                            >
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

            {/* User Profile & Mobile Menu Button */}
            <div className="flex items-center gap-4">
              <div className="hidden md:block">
                <UserProfile />
              </div>
              
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6 text-gray-700" />
                ) : (
                  <Menu className="h-6 w-6 text-gray-700" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white pt-16">
          <div className="border-b border-gray-200 px-4 py-4 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = item.hasSubmenu ? activeMainItem === item.label : activeItem === item.label
              const isOpen = openDropdown === item.label
              
              return (
                <div key={item.label}>
                  <button
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-gradient-to-r from-indigo-50 via-cyan-50 to-teal-50 text-indigo-700"
                        : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-cyan-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </div>
                    {item.hasSubmenu && (
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )} />
                    )}
                  </button>
                  
                  {/* Mobile Submenu */}
                  {item.hasSubmenu && isOpen && (
                    <div className="mt-1 ml-4 space-y-1 border-l-2 border-indigo-200 pl-4">
                      {item.submenu?.map((subItem) => {
                        const SubIcon = subItem.icon
                        const isSubActive = activeItem === subItem.label
                        
                        return (
                          <button
                            key={subItem.label}
                            onClick={() => handleSubmenuClick(subItem.path)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors",
                              isSubActive
                                ? "bg-gradient-to-r from-indigo-50 via-cyan-50 to-teal-50 text-indigo-700 font-medium border-l-2 border-indigo-500"
                                : "text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-cyan-50"
                            )}
                          >
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
            
            {/* Mobile User Profile */}
            <div className="pt-4 border-t border-gray-200 mt-4">
              <UserProfile />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

