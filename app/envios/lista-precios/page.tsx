"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ModernHeader } from "@/components/modern-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DollarSign } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"

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

export default function ListaPreciosEnvioPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<string | null>(null)
  const [userCodigoCliente, setUserCodigoCliente] = useState<string | null>(null)
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
      router.push("/chofer")
      return
    }

    // Coordinador no puede acceder a Envios/Lista de Precios
    if (profile === "Coordinador") {
      router.push("/envios")
      return
    }

    setUserProfile(profile)

    // Si el usuario es Cliente, obtener su código de cliente y nombre desde el backend
    if (profile === "Cliente") {
      const loadUserInfo = async () => {
        const username = sessionStorage.getItem("username")
        if (!username) return

        try {
          const apiBaseUrl = getApiBaseUrl()
          const userResponse = await fetch(`${apiBaseUrl}/usuarios?size=1000`)
          if (userResponse.ok) {
            const userData = await userResponse.json()
            const content = userData.content || []
            const user = content.find((u: any) => u.usuario === username)
            if (user && user.codigoCliente) {
              setUserCodigoCliente(user.codigoCliente)
              setFormData((prev) => ({ ...prev, cliente: user.codigoCliente }))

              try {
                const clienteResponse = await fetch(`${apiBaseUrl}/clientes?codigo=${encodeURIComponent(user.codigoCliente)}&size=1`)
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
        setClienteSeleccionado(cliente)
        loadListaPrecios(cliente.listaPreciosId)
      }
      // Limpiar errores y resultados al cambiar el cliente
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

  // Cargar lista de precios cuando se selecciona un cliente o cuando es usuario Cliente
  useEffect(() => {
    const clienteId = userProfile === "Cliente" ? userCodigoCliente : formData.cliente
    
    if (clienteId) {
      // Buscar el cliente para obtener su listaPreciosId
      const buscarCliente = async () => {
        let cliente: Cliente | null = null

        // Si es usuario Cliente, ya tenemos el código
        if (userProfile === "Cliente" && userCodigoCliente) {
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
          // Si no es usuario Cliente, buscar en la lista de clientes cargados
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
  }, [formData.cliente, userProfile, userCodigoCliente, clientes])

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

  const handleClose = () => {
    router.push("/envios")
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <ModernHeader />
      <main className="flex-1 overflow-auto">
        {/* Main Content */}
        <div className="p-6 flex justify-center">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-2xl w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-[#6B46FF]">LISTA DE PRECIOS</h1>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">Cliente</label>
                {userProfile === "Cliente" ? (
                  <Input
                    value={clienteNombre || ""}
                    disabled
                    className="h-9 text-sm border-gray-300 bg-gray-50"
                    placeholder={clienteNombre ? "" : "Cargando..."}
                  />
                ) : (
                  <Select
                    value={formData.cliente}
                    onValueChange={(value) => handleInputChange("cliente", value)}
                  >
                    <SelectTrigger className="h-9 text-sm border-gray-300 bg-white">
                      <SelectValue placeholder="Seleccionar" />
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

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">CP</label>
                <Input
                  type="text"
                  value={formData.cp}
                  onChange={(e) => handleInputChange("cp", e.target.value)}
                  className="h-9 text-sm border-gray-300 bg-white"
                  placeholder="Código Postal"
                />
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleCalcular}
                  className="bg-[#6B46FF] hover:bg-[#5a3ae6] text-white h-10 text-sm font-semibold shadow-md hover:shadow-lg transition-all w-full"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  CALCULAR
                </Button>
              </div>

              {/* Resultado del cálculo */}
              {resultadoCalculo && (
                <div className="mt-4 pt-4 border-t border-green-300">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-lg font-semibold text-green-700 text-center">
                      Precio: <span className="font-bold text-green-600">{resultadoCalculo.precio}</span> - Zona: <span className="font-bold text-green-600">{resultadoCalculo.zona}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Error si el CP no está en la lista */}
              {errorCP && (
                <div className="mt-4 pt-4 border-t border-red-300">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-lg font-semibold text-red-700 text-center">
                      {errorCP}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Tabla de Precios */}
            {listaPrecio && zonas.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Precios por Zona</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#6B46FF] to-purple-600 text-white">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider border border-gray-300">
                          Codigo de zona
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider border border-gray-300">
                          Nombre zona
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider border border-gray-300">
                          Precio costo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {zonas.map((zona, index) => (
                        <tr
                          key={zona.id || index}
                          className={`hover:bg-purple-50 transition-colors ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900 border border-gray-200 font-medium">
                            {zona.codigo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 border border-gray-200">
                            {zona.nombre}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 border border-gray-200 font-semibold">
                            {zona.valor ? `$ ${parseFloat(zona.valor).toLocaleString("es-AR")}` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {listaPrecio && !listaPrecio.zonaPropia && (!zonas || zonas.length === 0) && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-500 text-center py-4">
                  Esta lista de precios no tiene zonas propias configuradas.
                </p>
              </div>
            )}

            {!listaPrecio && (formData.cliente || userProfile === "Cliente") && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-500 text-center py-4">
                  El cliente seleccionado no tiene una lista de precios asignada.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

