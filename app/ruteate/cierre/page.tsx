"use client"

import { useState, useEffect } from "react"
import { ModernHeader } from "@/components/modern-header"
import { Package, Truck, Clock } from "lucide-react"
import { getApiBaseUrl } from "@/lib/api-config"

interface ChoferCierre {
  id: number
  nombreCompleto: string
  cantidadEnvios: number
}

export default function CierrePage() {
  const [soloFlex, setSoloFlex] = useState<boolean>(false)
  const [choferes, setChoferes] = useState<ChoferCierre[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [tiempoRestante, setTiempoRestante] = useState<string>("")
  const [cierreCerrado, setCierreCerrado] = useState<boolean>(false)

  useEffect(() => {
    loadChoferes()
  }, [soloFlex])

  // Calcular tiempo restante hasta las 23:00
  useEffect(() => {
    const calcularTiempoRestante = () => {
      const ahora = new Date()
      const horaActual = ahora.getHours()
      const minutoActual = ahora.getMinutes()
      const segundoActual = ahora.getSeconds()

      // Si es después de las 23:00, mostrar que ya cerró
      if (horaActual >= 23) {
        setCierreCerrado(true)
        setTiempoRestante("")
        return
      }

      setCierreCerrado(false)
      
      // Calcular tiempo hasta las 23:00:00
      const horaCierre = 23
      const minutoCierre = 0
      const segundoCierre = 0

      // Calcular diferencia en milisegundos
      const ahoraMs = ahora.getTime()
      const cierreHoy = new Date(ahora)
      cierreHoy.setHours(horaCierre, minutoCierre, segundoCierre, 0)
      const cierreMs = cierreHoy.getTime()

      const diferenciaMs = cierreMs - ahoraMs

      if (diferenciaMs <= 0) {
        setCierreCerrado(true)
        setTiempoRestante("")
        return
      }

      // Convertir a horas, minutos y segundos
      const horasRestantes = Math.floor(diferenciaMs / (1000 * 60 * 60))
      const minutosRestantes = Math.floor((diferenciaMs % (1000 * 60 * 60)) / (1000 * 60))
      const segundosRestantes = Math.floor((diferenciaMs % (1000 * 60)) / 1000)

      const horas = horasRestantes.toString().padStart(2, '0')
      const minutos = minutosRestantes.toString().padStart(2, '0')
      const segundos = segundosRestantes.toString().padStart(2, '0')

      setTiempoRestante(`${horas}:${minutos}:${segundos}`)
    }

    // Calcular inmediatamente
    calcularTiempoRestante()

    // Actualizar cada segundo
    const interval = setInterval(calcularTiempoRestante, 1000)

    return () => clearInterval(interval)
  }, [])

  const loadChoferes = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/ruteate/cierre?soloFlex=${soloFlex}`
      )
      if (response.ok) {
        const data = await response.json()
        // Filtrar choferes con 0 envíos y ordenar por cantidad descendente
        const choferesFiltrados = data
          .filter((chofer: ChoferCierre) => chofer.cantidadEnvios > 0)
          .sort((a: ChoferCierre, b: ChoferCierre) => b.cantidadEnvios - a.cantidadEnvios)
        setChoferes(choferesFiltrados)
      } else {
        setChoferes([])
      }
    } catch (error) {
      console.error("Error cargando choferes:", error)
      setChoferes([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <ModernHeader />
      <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#6B46FF] to-[#5a3ae6] rounded-lg shadow-lg">
                  <Package className="h-6 w-6 text-white" />
                </div>
                Cierre
              </h1>
              <p className="text-sm text-gray-500">Resumen de envíos pendientes por chofer - Día de hoy</p>
            </div>

            {/* Contador de cierre */}
            {cierreCerrado ? (
              <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-lg border-2 border-red-400 p-5 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">Cierre de Flex finalizado</p>
                    <p className="text-white/90 text-sm">El período de cierre ha concluido</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-xl shadow-xl border-2 border-orange-400 p-5 mb-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-lg">
                    <Clock className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-xl">Faltan <span className="font-mono text-2xl font-black tracking-wider bg-white/20 px-3 py-1 rounded-lg inline-block">{tiempoRestante}</span> para el cierre de Flex</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Filtros */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-50 border border-purple-200">
                  <Truck className="h-5 w-5 text-[#6B46FF]" />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="soloFlex"
                    checked={soloFlex}
                    onChange={(e) => setSoloFlex(e.target.checked)}
                    className="w-5 h-5 text-[#6B46FF] border-2 border-gray-300 rounded focus:ring-2 focus:ring-[#6B46FF] focus:ring-offset-2 cursor-pointer transition-all"
                  />
                  <label 
                    htmlFor="soloFlex" 
                    className="text-sm font-semibold text-gray-700 cursor-pointer select-none"
                  >
                    Flex
                  </label>
                </div>
              </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100 border-b border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Choferes
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Cantidad de envios restantes
                      </th>
                    </tr>
                  </thead>
                </table>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={2} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6B46FF]"></div>
                            <p className="text-sm text-gray-500">Cargando...</p>
                          </div>
                        </td>
                      </tr>
                    ) : choferes.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-4 bg-gray-100 rounded-full">
                              <Package className="h-8 w-8 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-500">
                              No hay choferes con envíos pendientes para el día de hoy
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      choferes.map((chofer, index) => (
                        <tr 
                          key={chofer.id} 
                          className={`border-b border-gray-100 transition-all duration-200 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          } hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-transparent hover:shadow-sm`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6B46FF] to-[#5a3ae6] flex items-center justify-center text-white font-bold text-sm shadow-md">
                                {chofer.nombreCompleto.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                {chofer.nombreCompleto}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="px-3 py-1.5 bg-gradient-to-r from-[#6B46FF] to-[#5a3ae6] text-white rounded-lg font-bold text-sm shadow-md min-w-[3rem] text-center">
                                {chofer.cantidadEnvios}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
      </div>
    </div>
  )
}

