"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"
import { Montserrat } from "next/font/google"

interface Cliente {
  id: number
  codigo: string
  nombreFantasia: string
  listaPreciosId?: number
}

interface Zona {
  id: string
  codigo: string
  nombre: string
  cps: string
  valor: string
}

interface ListaPrecio {
  id: number
  codigo: string
  nombre: string
  zonaPropia: boolean
  zonas?: Zona[]
  listaPrecioSeleccionada?: string
}

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export default function ListaPreciosEnvioPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<string | null>(null)
  const [userCodigoCliente, setUserCodigoCliente] = useState<string | null>(null)
  const [userGrupoId, setUserGrupoId] = useState<number | null>(null)
  const [clienteNombre, setClienteNombre] = useState<string>("")
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [listaPrecio, setListaPrecio] = useState<ListaPrecio | null>(null)
  const [zonas, setZonas] = useState<Zona[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [resultadoCalculo, setResultadoCalculo] = useState<{ precio: string; zona: string } | null>(null)
  const [errorCP, setErrorCP] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    cliente: "",
    cp: "",
  })

  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = sessionStorage.getItem("isAuthenticated")
    const profile = sessionStorage.getItem("userProfile")
    
    if (!isAuthenticated) {
      router.push("/")
      return
    }

    if (profile === "Chofer") {
      router.push("/repartidor")
      return
    }

    // Coordinador no puede acceder a Envios/Lista de Precios
    if (profile === "Coordinador") {
      router.push("/pedidos")
      return
    }

    setUserProfile(profile)

    if (profile === "Cliente") {
      const loadUserInfo = async () => {
        const username = sessionStorage.getItem("username")
        if (!username) return

        try {
          const apiBaseUrl = getApiBaseUrl()
          const userResponse = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
          if (!userResponse.ok) return
          const userData = await userResponse.json()
          const content = userData.content || []
          const user = content.find((u: any) => u.usuario === username)
          if (!user) return

          const gid = user.grupoId != null && user.grupoId !== "" ? Number(user.grupoId) : null
          if (gid != null && !Number.isNaN(gid)) {
            setUserGrupoId(gid)
            setUserCodigoCliente(null)
            const cr = await fetch(`${apiBaseUrl}/clientes?grupoId=${gid}&size=1000`)
            if (!cr.ok) return
            const cd = await cr.json()
            const rows = Array.isArray(cd) ? cd : cd.content || []
            const clientesData: Cliente[] = rows.map((c: any) => ({
              id: c.id,
              codigo: c.codigo,
              nombreFantasia: c.nombreFantasia,
              listaPreciosId: c.listaPreciosId,
            }))
            setClientes(clientesData)
            const saved = sessionStorage.getItem("vendedorActivoCodigo")
            const codigoElegido =
              saved && clientesData.some((c) => c.codigo === saved)
                ? saved
                : clientesData[0]?.codigo || ""
            setFormData((prev) => ({ ...prev, cliente: codigoElegido }))
            const sel = clientesData.find((c) => c.codigo === codigoElegido)
            setClienteNombre(sel?.nombreFantasia || "")
          } else if (user.codigoCliente) {
            setUserGrupoId(null)
            setUserCodigoCliente(user.codigoCliente)
            setFormData((prev) => ({ ...prev, cliente: user.codigoCliente }))
            try {
              const clienteResponse = await fetch(
                `${apiBaseUrl}/clientes?codigo=${encodeURIComponent(user.codigoCliente)}&size=1`
              )
              if (clienteResponse.ok) {
                const clienteData = await clienteResponse.json()
                if (clienteData.content && clienteData.content.length > 0) {
                  const cliente = clienteData.content[0]
                  if (cliente.nombreFantasia) setClienteNombre(cliente.nombreFantasia)
                }
              }
            } catch (error) {
              warnDev("Error al cargar cliente del backend:", error)
            }
          }
        } catch (error) {
          warnDev("Error al cargar usuario del backend:", error)
        }
      }

      loadUserInfo()
    } else {
      // Si no es Cliente, cargar todos los clientes
      const loadClientes = async () => {
        try {
          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/clientes?size=1000`)
          if (response.ok) {
            const data = await response.json()
            if (data.content && data.content.length > 0) {
              const clientesData = data.content.map((c: any) => ({
                id: c.id,
                codigo: c.codigo,
                nombreFantasia: c.nombreFantasia,
                listaPreciosId: c.listaPreciosId,
              }))
              setClientes(clientesData)
            }
          }
        } catch (error) {
          warnDev("Error al cargar clientes del backend:", error)
        }
      }

      loadClientes()
    }
  }, [router])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    
    // Limpiar errores y resultados al cambiar el CP
    if (field === "cp") {
      setErrorCP(null)
      setResultadoCalculo(null)
    }
    
    // Si se cambia el cliente, cargar su lista de precios
    if (field === "cliente") {
      const cliente = clientes.find((c) => c.codigo === value)
      if (cliente) {
        setClienteNombre(cliente.nombreFantasia || "")
        if (userProfile === "Cliente" && userGrupoId != null) {
          sessionStorage.setItem("vendedorActivoCodigo", value)
        }
        setClienteSeleccionado(cliente)
        loadListaPrecios(cliente.listaPreciosId)
      }
      setErrorCP(null)
      setResultadoCalculo(null)
    }
  }

  const loadListaPrecios = async (listaPreciosId?: number) => {
    if (!listaPreciosId) {
      setListaPrecio(null)
      setZonas([])
      return
    }

    const cargarZonasDeLista = async (lista: any): Promise<Zona[]> => {
      // Si tiene zonas propias, retornar sus zonas
      if (lista.zonaPropia && lista.zonas && lista.zonas.length > 0) {
        return lista.zonas
      }
      
      // Si no tiene zonas propias, cargar las zonas de la lista referenciada
      if (!lista.zonaPropia && lista.listaPrecioSeleccionada) {
        const listaReferenciadaId = typeof lista.listaPrecioSeleccionada === 'string' 
          ? parseInt(lista.listaPrecioSeleccionada) 
          : lista.listaPrecioSeleccionada
        
        if (listaReferenciadaId) {
          try {
            // Intentar cargar del backend
            const apiBaseUrl = getApiBaseUrl()
            const response = await fetch(`${apiBaseUrl}/lista-precios/${listaReferenciadaId}`)
            if (response.ok) {
              const listaReferenciada = await response.json()
              if (listaReferenciada.zonaPropia && listaReferenciada.zonas && listaReferenciada.zonas.length > 0) {
                return listaReferenciada.zonas
              }
            }
          } catch (error) {
            warnDev("Error al cargar lista de precios referenciada del backend:", error)
          }
        }
      }

      return []
    }

    try {
      // Intentar cargar del backend
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/lista-precios/${listaPreciosId}`)
      if (response.ok) {
        const data = await response.json()
        setListaPrecio(data)
        
        // Cargar zonas (propias o de la lista referenciada)
        const zonasCargadas = await cargarZonasDeLista(data)
        setZonas(zonasCargadas)
        return
      }
    } catch (error) {
      warnDev("Error al cargar lista de precios del backend:", error)
    }
  }

  useEffect(() => {
    const tieneCliente =
      (userProfile === "Cliente" && userGrupoId != null && !!formData.cliente) ||
      (userProfile === "Cliente" && userGrupoId == null && !!userCodigoCliente) ||
      (userProfile !== "Cliente" && !!formData.cliente)

    if (tieneCliente) {
      const buscarCliente = async () => {
        let cliente: Cliente | null = null

        if (userProfile === "Cliente" && userGrupoId != null) {
          cliente = clientes.find((c) => c.codigo === formData.cliente) || null
          if (!cliente) {
            try {
              const apiBaseUrl = getApiBaseUrl()
              const response = await fetch(
                `${apiBaseUrl}/clientes?codigo=${encodeURIComponent(formData.cliente)}&size=1`
              )
              if (response.ok) {
                const data = await response.json()
                if (data.content && data.content.length > 0) {
                  const row = data.content[0]
                  cliente = {
                    id: row.id,
                    codigo: row.codigo,
                    nombreFantasia: row.nombreFantasia,
                    listaPreciosId: row.listaPreciosId,
                  }
                }
              }
            } catch (error) {
              warnDev("Error al cargar cliente del backend:", error)
            }
          }
        } else if (userProfile === "Cliente" && userCodigoCliente) {
          try {
            const apiBaseUrl = getApiBaseUrl()
            const response = await fetch(`${apiBaseUrl}/clientes?codigo=${encodeURIComponent(userCodigoCliente)}&size=1`)
            if (response.ok) {
              const data = await response.json()
              if (data.content && data.content.length > 0) {
                cliente = data.content[0]
              }
            }
          } catch (error) {
            warnDev("Error al cargar cliente del backend:", error)
          }
        } else {
          cliente = clientes.find((c) => c.codigo === formData.cliente) || null
        }

        if (cliente && cliente.listaPreciosId) {
          setClienteSeleccionado(cliente)
          loadListaPrecios(cliente.listaPreciosId)
        } else {
          setListaPrecio(null)
          setZonas([])
        }
      }

      buscarCliente()
    } else {
      setListaPrecio(null)
      setZonas([])
    }
  }, [formData.cliente, userProfile, userCodigoCliente, userGrupoId, clientes])

  const handleCalcular = () => {
    if (!formData.cp || !formData.cp.trim()) {
      alert("Por favor, ingrese un código postal")
      return
    }

    if (!zonas || zonas.length === 0) {
      alert("No hay zonas disponibles para calcular el precio")
      return
    }

    // Limpiar el CP (solo números)
    const cpLimpio = formData.cp.replace(/\D/g, "")
    const cpNumero = parseInt(cpLimpio)

    if (!cpNumero || isNaN(cpNumero)) {
      alert("Por favor, ingrese un código postal válido")
      return
    }

    // Buscar en qué zona está el CP
    let zonaEncontrada: Zona | null = null

    for (const zona of zonas) {
      const cps = zona.cps || ""
      
      // Verificar si es un rango (ej: "1000-1599")
      const rangoMatch = cps.match(/(\d+)-(\d+)/)
      if (rangoMatch) {
        const inicio = parseInt(rangoMatch[1])
        const fin = parseInt(rangoMatch[2])
        if (cpNumero >= inicio && cpNumero <= fin) {
          zonaEncontrada = zona
          break
        }
      }
      
      // Verificar si está en la lista de CPs separados por comas
      const cpsLista = cps.split(",").map(cp => cp.trim()).filter(cp => cp)
      if (cpsLista.includes(cpLimpio) || cpsLista.includes(cpNumero.toString())) {
        zonaEncontrada = zona
        break
      }
    }

    if (zonaEncontrada && zonaEncontrada.valor) {
      const precio = parseFloat(zonaEncontrada.valor).toLocaleString("es-AR")
      setResultadoCalculo({
        precio: `$${precio}`,
        zona: zonaEncontrada.nombre
      })
      setErrorCP(null)
    } else {
      setResultadoCalculo(null)
      setErrorCP("No se encontró una zona para el código postal ingresado")
    }
  }

  return (
    <div className={`min-h-screen bg-[#f7f8fc] ${montserrat.className}`}>
      <ModernHeader />
      <main className="px-4 pb-6 pt-4">
        <div className="mx-auto w-full max-w-[1700px]">
          <h1 className="mb-5 text-[34px] font-semibold tracking-tight text-[#1570ef]">Cotiza un viaje...</h1>

          <div className="flex w-full flex-col items-stretch gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="ml-2 w-full max-w-[560px] shrink-0 rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[14px] font-medium text-[#4d5571]">Cuenta</label>
                {userProfile === "Cliente" && userGrupoId == null ? (
                  <Input
                    value={clienteNombre || ""}
                    disabled
                    className="h-10 text-[14px] text-[#525b76]"
                    placeholder={clienteNombre ? "" : "Cargando..."}
                  />
                ) : (
                  <Select
                    value={formData.cliente}
                    onValueChange={(value) => handleInputChange("cliente", value)}
                  >
                    <SelectTrigger className="h-10 text-[14px] text-[#525b76]">
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.codigo}>
                          {cliente.nombreFantasia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-[14px] font-medium text-[#4d5571]">Código Postal</label>
                <Input
                  type="text"
                  value={formData.cp}
                  onChange={(e) => handleInputChange("cp", e.target.value)}
                  className="h-10 text-[14px] text-[#525b76]"
                  placeholder="Ingresá el código postal"
                />
              </div>

              <div className="pt-1">
                <Button
                  onClick={handleCalcular}
                  className="h-10 w-full rounded-xl bg-[#eef4ff] text-[14px] font-semibold text-[#1570ef] hover:bg-[#e3edff]"
                >
                  Calcular
                </Button>
              </div>

              {/* Resultado del cálculo */}
              {resultadoCalculo && (
                <div className="mt-2 border-t border-[#edf0f7] pt-5">
                  <div className="rounded-lg p-3 text-center">
                    <p className="text-[18px] font-semibold text-[#4f46ce]">
                      Precio: <span className="font-bold">{resultadoCalculo.precio}</span> - Zona:{" "}
                      <span className="font-bold">{resultadoCalculo.zona}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Error si el CP no está en la lista */}
              {errorCP && (
                <div className="mt-2 border-t border-[#edf0f7] pt-5">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-[14px] font-semibold text-red-700 text-center">
                      {errorCP}
                    </p>
                  </div>
                </div>
              )}
              {!listaPrecio && (formData.cliente || userProfile === "Cliente") && (
                <div className="mt-2 border-t border-[#edf0f7] pt-5">
                  <p className="text-[14px] text-gray-500 text-center py-2">
                    El cliente seleccionado no tiene una lista de precios asignada.
                  </p>
                </div>
              )}

              {listaPrecio && !listaPrecio.zonaPropia && (!zonas || zonas.length === 0) && (
                <div className="mt-2 border-t border-[#edf0f7] pt-5">
                  <p className="text-[14px] text-gray-500 text-center py-2">
                    Esta lista de precios no tiene zonas propias configuradas.
                  </p>
                </div>
              )}
              </div>
            </div>

            <div className="w-full max-w-[760px] shrink-0 lg:mr-2 lg:w-[760px]">
              <h2 className="mb-3 text-[28px] font-semibold tracking-tight text-[#4f46ce]">Precio por zona</h2>
              <div className="overflow-hidden rounded-2xl border border-[#e6eaf4] bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[#edf0f7] bg-white">
                        <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#4d5571]">Código de zona</th>
                        <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#4d5571]">Nombre de zona</th>
                        <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#4d5571]">Precio costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zonas.length > 0 ? (
                        zonas.map((zona, index) => (
                          <tr key={zona.id || index} className="border-b border-[#f0f3f9] last:border-0">
                            <td className="px-4 py-2.5 text-[13px] text-[#525b76]">{zona.codigo}</td>
                            <td className="px-4 py-2.5 text-[13px] text-[#525b76]">{zona.nombre}</td>
                            <td className="px-4 py-2.5 text-[13px] font-medium text-[#525b76]">
                              {zona.valor ? `$${parseFloat(zona.valor).toLocaleString("es-AR")}` : "-"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-[14px] text-[#8b93ad]">
                            Seleccioná un cliente para ver precios por zona.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

