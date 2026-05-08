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
    label: "Pedidos",
    hasSubmenu: true,
    submenu: [
      { icon: Truck, label: "Pedidos", path: "/pedidos" },
      { icon: Upload, label: "Cargar pedidos", path: "/pedidos/cargar" },
      { icon: Printer, label: "Reimpresión de etiquetas", path: "/pedidos/reimpresion-etiquetas" },
    ],
  },
  {
    icon: Wrench,
    label: "Sistema",
    hasSubmenu: true,
    submenu: [
      { icon: Users, label: "Usuarios", path: "/sistema/usuarios" },
      { icon: Layers, label: "Grupos", path: "/sistema/grupos" },
      { icon: FileBarChart, label: "Informes", path: "/sistema/informes" },
      { icon: DollarSign, label: "Tarifas", path: "/sistema/tarifas" },
      { icon: FileCheck, label: "Estado Órdenes", path: "/sistema/estado-ordenes" },
    ],
  },
  {
    icon: Users,
    label: "Vendedores",
    hasSubmenu: false,
    path: "/vendedores",
  },
  {
    icon: Route,
    label: "Repartidores",
    hasSubmenu: true,
    submenu: [
      { icon: Route, label: "Ubicación", path: "/repartidores/ubicacion" },
      { icon: FileCheck, label: "Cierre", path: "/repartidores/cierre" },
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

  const coordinadorOcultarSubmenuLabels = ["Lista de precios", "Tarifas", "Estado Órdenes"]

  const getFilteredMenuItems = () => {
    if (userProfile === "Chofer") return allMenuItems.filter((item) => item.label !== "Repartidores")
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
    if (pathname?.includes("/sistema/usuarios")) return "Usuarios"
    if (pathname?.includes("/sistema/grupos")) return "Grupos"
    if (pathname?.includes("/sistema/informes")) return "Informes"
    if (pathname?.includes("/sistema/tarifas")) return "Tarifas"
    if (pathname?.includes("/sistema/estado-ordenes")) return "Estado Órdenes"
    if (pathname?.includes("/vendedores")) return "Vendedores"
    if (pathname?.includes("/pedidos/reimpresion-etiquetas")) return "Reimpresión de etiquetas"
    if (pathname?.includes("/pedidos/cargar") || pathname?.includes("/subir-individual") || pathname?.includes("/subir-envio") || pathname?.includes("/subir-flex-manual")) {
      return "Cargar pedidos"
    }
    if (pathname?.includes("/pedidos")) return "Pedidos"
    if (pathname?.includes("/repartidores/ubicacion")) return "Ubicación"
    if (pathname?.includes("/repartidores/cierre")) return "Cierre"
    return null
  }

  const getActiveMainItem = () => {
    if (pathname?.startsWith("/utilidades")) return null
    if (pathname?.includes("/pedidos") || pathname?.includes("/reimprimir-noflex") || pathname?.includes("/subir")) return "Pedidos"
    if (pathname?.includes("/sistema/usuarios") || pathname?.includes("/sistema/grupos") || pathname?.includes("/sistema/informes") || pathname?.includes("/sistema/tarifas") || pathname?.includes("/sistema/estado-ordenes")) return "Sistema"
    if (pathname?.includes("/vendedores")) return "Vendedores"
    if (pathname?.includes("/repartidores")) return "Repartidores"
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
            <button onClick={() => router.push("/pedidos")} className="hover:opacity-90 transition-opacity">
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
