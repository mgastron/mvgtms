"use client"

import { Truck, Wrench, Users, DollarSign, Route, Upload, Printer, FileUp, FileCheck, Search, Menu, X, Layers, FileBarChart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { UserProfile } from "@/components/user-profile"
import { Montserrat } from "next/font/google"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const allMenuItems = [
  {
    icon: Truck,
    label: "Envíos",
    hasSubmenu: true,
    submenu: [
      { icon: Truck, label: "Envíos", path: "/envios" },
      { icon: Upload, label: "Subir envíos", path: "/subir-envio" },
      { icon: DollarSign, label: "Lista de precios", path: "/envios/lista-precios" },
      { icon: Printer, label: "Reimprimir no flex", path: "/reimprimir-noflex" },
      { icon: FileUp, label: "Subir individual", path: "/subir-individual" },
      { icon: FileUp, label: "Subir Flex Manual", path: "/subir-flex-manual" },
      { icon: Search, label: "Buscador de pedidos", path: "/sistema/buscador-pedidos" },
    ],
  },
  {
    icon: Wrench,
    label: "Sistema",
    hasSubmenu: true,
    submenu: [
      { icon: Users, label: "Usuarios", path: "/usuarios" },
      { icon: Layers, label: "Grupos", path: "/sistema/grupos" },
      { icon: FileBarChart, label: "Informes", path: "/sistema/informes" },
      { icon: DollarSign, label: "Lista Precios", path: "/lista-precios" },
      { icon: FileCheck, label: "Estado Órdenes", path: "/sistema/estado-ordenes" },
    ],
  },
  {
    icon: Users,
    label: "Cuentas",
    hasSubmenu: false,
    path: "/clientes",
  },
  {
    icon: Route,
    label: "Ruteate",
    hasSubmenu: true,
    submenu: [
      { icon: Route, label: "Geochoferes", path: "/ruteate/geochoferes" },
      { icon: FileCheck, label: "Cierre", path: "/ruteate/cierre" },
    ],
  },
]

export function ModernHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<string | null>(null)

  useEffect(() => {
    const profile = sessionStorage.getItem("userProfile")
    setUserProfile(profile)
  }, [])

  const coordinadorOcultarSubmenuLabels = ["Lista de precios", "Lista Precios", "Estado Órdenes"]

  const getFilteredMenuItems = () => {
    if (userProfile === "Chofer") return allMenuItems.filter((item) => item.label !== "Ruteate")
    if (userProfile === "Coordinador") {
      return allMenuItems.map((item) => {
        if (!item.hasSubmenu || !item.submenu) return item
        return {
          ...item,
          submenu: item.submenu.filter((sub) => !coordinadorOcultarSubmenuLabels.includes(sub.label)),
        }
      })
    }
    return allMenuItems
  }

  const menuItems = getFilteredMenuItems()

  const getActiveItem = () => {
    if (pathname?.includes("/usuarios")) return "Usuarios"
    if (pathname?.includes("/sistema/grupos")) return "Grupos"
    if (pathname?.includes("/sistema/informes")) return "Informes"
    if (pathname?.includes("/lista-precios") && !pathname?.includes("/envios")) return "Lista Precios"
    if (pathname?.includes("/sistema/estado-ordenes")) return "Estado Órdenes"
    if (pathname?.includes("/sistema/buscador-pedidos")) return "Buscador de pedidos"
    if (pathname?.includes("/clientes")) return "Cuentas"
    if (pathname?.includes("/reimprimir-noflex")) return "Reimprimir no flex"
    if (pathname?.includes("/subir-individual")) return "Subir individual"
    if (pathname?.includes("/subir-envio")) return "Subir envíos"
    if (pathname?.includes("/subir-flex-manual")) return "Subir Flex Manual"
    if (pathname?.includes("/envios/lista-precios")) return "Lista de precios"
    if (pathname?.includes("/envios")) return "Envíos"
    if (pathname?.includes("/ruteate/geochoferes")) return "Geochoferes"
    if (pathname?.includes("/ruteate/cierre")) return "Cierre"
    return null
  }

  const getActiveMainItem = () => {
    if (pathname?.includes("/reimprimir-noflex") || pathname?.includes("/subir") || pathname?.includes("/envios") || pathname?.includes("/sistema/buscador-pedidos")) return "Envíos"
    if (pathname?.includes("/usuarios") || pathname?.includes("/sistema/grupos") || pathname?.includes("/sistema/informes") || (pathname?.includes("/lista-precios") && !pathname?.includes("/envios")) || pathname?.includes("/sistema/estado-ordenes")) return "Sistema"
    if (pathname?.includes("/clientes")) return "Cuentas"
    if (pathname?.includes("/ruteate")) return "Ruteate"
    return null
  }

  const activeItem = getActiveItem()
  const activeMainItem = getActiveMainItem()
  const activeMainMenu = menuItems.find((item) => item.label === activeMainItem)

  const handleMainNavClick = (item: typeof allMenuItems[0]) => {
    if (!item.hasSubmenu) {
      if (item.path) router.push(item.path)
      return
    }
    const firstPath = item.submenu?.[0]?.path
    if (firstPath) router.push(firstPath)
  }

  const handleSubmenuClick = (path: string) => {
    router.push(path)
    setMobileMenuOpen(false)
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#f7f8fc]">
        <div className={`mx-auto w-full max-w-[1700px] px-3 pt-3 ${montserrat.className}`}>
          <div className="flex h-[72px] items-center justify-between rounded-2xl bg-[#1459e9] px-6">
            <button onClick={() => router.push("/envios")} className="hover:opacity-90 transition-opacity">
              <img src="/logos/nexo-logo-white.png" alt="nexo" className="h-auto w-[102px]" />
            </button>

            {userProfile !== "Chofer" && (
              <nav className="hidden md:flex items-center gap-3">
                {menuItems.map((item) => {
                  const isActive = item.hasSubmenu ? activeMainItem === item.label : activeItem === item.label
                  return (
                    <button
                      key={item.label}
                      onClick={() => handleMainNavClick(item)}
                      className={cn(
                        "rounded-lg px-5 py-2 text-[17px] transition-colors",
                        isActive ? "font-semibold text-white" : "font-medium text-white/75 hover:text-white"
                      )}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </nav>
            )}

            <div className="flex items-center gap-4">
              <div className={cn(userProfile === "Chofer" ? "block" : "hidden md:block")}>
                <UserProfile variant="headerBlue" />
              </div>

              {userProfile !== "Chofer" && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              )}
            </div>
          </div>

          {userProfile !== "Chofer" && activeMainMenu?.hasSubmenu && (
            <div className="mt-3 rounded-full border border-[#e6eaf4] bg-white px-2 py-1.5 shadow-sm">
              <div className="flex w-full items-center justify-between gap-1 overflow-x-auto">
                {activeMainMenu.submenu?.map((subItem) => {
                  const isSubActive = activeItem === subItem.label
                  return (
                    <button
                      key={subItem.label}
                      onClick={() => handleSubmenuClick(subItem.path)}
                      className={cn(
                        "whitespace-nowrap rounded-full px-4 py-2 text-[15px] transition-colors text-center",
                        isSubActive
                          ? "bg-[#dbeafe] font-semibold text-[#1459e9]"
                          : "font-medium text-[#5d6578] hover:bg-[#eff6ff] hover:text-[#1459e9]"
                      )}
                      style={{ flex: "1 1 0" }}
                    >
                      {subItem.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white pt-20 px-4">
          <div className="space-y-2 max-h-[calc(100vh-6rem)] overflow-y-auto">
            {menuItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-200 p-3">
                <button
                  onClick={() => handleMainNavClick(item)}
                  className={cn("w-full text-left text-sm font-semibold", activeMainItem === item.label ? "text-[#1459e9]" : "text-gray-700")}
                >
                  {item.label}
                </button>
                {item.hasSubmenu && item.submenu && (
                  <div className="mt-2 space-y-1">
                    {item.submenu.map((sub) => (
                      <button
                        key={sub.label}
                        onClick={() => handleSubmenuClick(sub.path)}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-sm",
                          activeItem === sub.label ? "bg-[#dbeafe] font-semibold text-[#1459e9]" : "text-gray-600 hover:bg-[#eff6ff]"
                        )}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="pt-2 border-t border-gray-200">
              <UserProfile />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
