"use client"

import { useState, useEffect } from "react"
import { X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Zona {
  id: string
  codigo: string
  nombre: string
  cps: string
  valor: string
  isDefault?: boolean // Indica si es una zona por defecto (cordones)
}

interface NewListaPrecioModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (listaPrecioData: any) => void
  listasPreciosConZonasPropias?: Array<{ id: number; codigo: string; nombre: string }>
  editingListaPrecio?: {
    id: number
    codigo: string
    nombre: string
    zonaPropia: boolean
    zonas?: Zona[]
    listaPrecioSeleccionada?: string
  } | null
}

// Zonas por defecto (cordones) - definidas fuera del componente para que estén disponibles
const zonasPorDefecto: Zona[] = [
  {
    id: "default-1",
    codigo: "001",
    nombre: "CABA",
    cps: "1000-1599",
    valor: "",
    isDefault: true,
  },
  {
    id: "default-2",
    codigo: "002",
    nombre: "PRIMER CORDON",
    cps: "1602, 1603, 1604, 1605, 1606, 1607, 1609, 1636, 1637, 1638, 1640, 1641, 1642, 1643, 1644, 1645, 1646, 1649, 1650, 1651, 1652, 1653, 1655, 1657, 1672, 1674, 1675, 1676, 1678, 1682, 1683, 1684, 1685, 1686, 1687, 1688, 1692, 1702, 1703, 1704, 1706, 1707, 1708, 1712, 1713, 1714, 1715, 1751, 1752, 1753, 1754, 1766, 1773, 1821, 1822, 1823, 1824, 1825, 1826, 1827, 1828, 1829, 1831, 1832, 1833, 1834, 1835, 1836, 1868, 1869, 1870, 1871, 1872, 1873, 1874, 1875",
    valor: "",
    isDefault: true,
  },
  {
    id: "default-3",
    codigo: "003",
    nombre: "SEGUNDO CORDÓN",
    cps: "1608, 1610, 1611, 1612, 1613, 1614, 1615, 1616, 1617, 1618, 1621, 1624, 1648, 1659, 1660, 1661, 1662, 1663, 1664, 1665, 1666, 1667, 1670, 1671, 1716, 1718, 1722, 1723, 1724, 1736, 1738, 1740, 1742, 1743, 1744, 1745, 1746, 1755, 1757, 1758, 1759, 1761, 1763, 1764, 1765, 1768, 1770, 1771, 1772, 1774, 1776, 1778, 1785, 1786, 1801, 1802, 1803, 1804, 1805, 1806, 1807, 1812, 1837, 1838, 1839, 1840, 1841, 1842, 1843, 1844, 1845, 1846, 1847, 1848, 1849, 1851, 1852, 1853, 1854, 1855, 1856, 1859, 1860, 1861, 1863, 1867, 1876, 1877, 1878, 1879, 1880, 1881, 1882, 1883, 1884, 1885, 1886, 1887, 1888, 1889, 1890, 1891, 1893",
    valor: "",
    isDefault: true,
  },
  {
    id: "default-4",
    codigo: "004",
    nombre: "TERCER CORDÓN",
    cps: "1601, 1619, 1620, 1622, 1623, 1625, 1626, 1627, 1628, 1629, 1630, 1631, 1632, 1633, 1634, 1635, 1639, 1647, 1669, 1727, 1748, 1749, 1808, 1814, 1815, 1816, 1858, 1862, 1864, 1865, 1894, 1895, 1896, 1897, 1898, 1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909, 1910, 1912, 1914, 1916, 1923, 1924, 1925, 1926, 1927, 1929, 1931, 1984, 2800, 2801, 2802, 2804, 2805, 2806, 2808, 2814, 2816, 6608, 6700, 6701, 6702, 6703, 6706, 6708, 6712",
    valor: "",
    isDefault: true,
  },
]

export function NewListaPrecioModal({
  isOpen,
  onClose,
  onSave,
  listasPreciosConZonasPropias = [],
  editingListaPrecio,
}: NewListaPrecioModalProps) {
  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    tipoZonas: "Zonas propias", // "Zonas propias" o "Usar zonas de"
    listaPrecioSeleccionada: "",
  })
  const [zonas, setZonas] = useState<Zona[]>([...zonasPorDefecto])

  const isEditing = !!editingListaPrecio

  // Cargar datos cuando se abre el modal para editar
  useEffect(() => {
    if (isOpen && editingListaPrecio) {
      setFormData({
        codigo: editingListaPrecio.codigo || "",
        nombre: editingListaPrecio.nombre || "",
        tipoZonas: editingListaPrecio.zonaPropia ? "Zonas propias" : "Usar zonas de",
        listaPrecioSeleccionada: editingListaPrecio.listaPrecioSeleccionada || "",
      })

      if (editingListaPrecio.zonaPropia && editingListaPrecio.zonas && editingListaPrecio.zonas.length > 0) {
        // Cargar las zonas guardadas, marcando las que son por defecto
        const zonasCargadas = editingListaPrecio.zonas.map((z) => ({
          ...z,
          isDefault: zonasPorDefecto.some((zd) => zd.codigo === z.codigo && zd.nombre === z.nombre),
        }))
        setZonas(zonasCargadas)
      } else {
        // Si no hay zonas guardadas, usar las por defecto
        setZonas([...zonasPorDefecto])
      }
    } else if (isOpen && !editingListaPrecio) {
      // Resetear cuando se abre para crear nuevo - usar zonas por defecto
      setFormData({
        codigo: "",
        nombre: "",
        tipoZonas: "Zonas propias",
        listaPrecioSeleccionada: "",
      })
      setZonas([...zonasPorDefecto])
    }
  }, [isOpen, editingListaPrecio])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value }
      
      // Si cambia el tipo de zonas a "Zonas propias" y no estamos editando, cargar zonas por defecto
      if (field === "tipoZonas" && value === "Zonas propias" && !isEditing) {
        setZonas([...zonasPorDefecto])
      } else if (field === "tipoZonas" && value === "Usar zonas de") {
        // Si cambia a "Usar zonas de", limpiar las zonas
        setZonas([])
      }
      
      return newData
    })
  }

  const handleZonaChange = (id: string, field: string, value: string) => {
    setZonas((prev) =>
      prev.map((zona) => (zona.id === id ? { ...zona, [field]: value } : zona))
    )
  }

  const getNextCodigo = (zonasActuales: Zona[]): string => {
    const codigosNumericos = zonasActuales
      .filter((z) => !z.isDefault && z.codigo.match(/^\d+$/))
      .map((z) => parseInt(z.codigo, 10))
      .filter((n) => !isNaN(n))
    
    if (codigosNumericos.length === 0) {
      return "005"
    }
    
    const maxCodigo = Math.max(...codigosNumericos)
    const nextCodigo = maxCodigo + 1
    return nextCodigo.toString().padStart(3, "0")
  }

  const handleAddZona = () => {
    const newId = Date.now().toString()
    const nextCodigo = getNextCodigo(zonas)
    setZonas((prev) => [
      ...prev,
      {
        id: newId,
        codigo: nextCodigo,
        nombre: "",
        cps: "",
        valor: "",
        isDefault: false,
      },
    ])
  }

  const handleRemoveZona = (id: string) => {
    // No permitir eliminar si solo queda una zona
    if (zonas.length > 1) {
      setZonas((prev) => prev.filter((zona) => zona.id !== id))
    }
  }

  const handleSave = () => {
    // Validar campos básicos
    if (!formData.codigo.trim() || !formData.nombre.trim()) {
      alert("Por favor completa todos los campos obligatorios")
      return
    }

    // Validar según el tipo de zonas
    if (formData.tipoZonas === "Zonas propias") {
      // Validar que todas las zonas estén completas
      const zonasIncompletas = zonas.some(
        (zona) => !zona.codigo.trim() || !zona.nombre.trim() || !zona.cps.trim() || !zona.valor.trim()
      )
      if (zonasIncompletas) {
        alert("Por favor completa todos los campos de las zonas")
        return
      }
    } else if (formData.tipoZonas === "Usar zonas de") {
      // Validar que se haya seleccionado una lista de precios
      if (!formData.listaPrecioSeleccionada) {
        alert("Por favor selecciona una lista de precios")
        return
      }
    }

    if (onSave) {
      onSave({
        id: editingListaPrecio?.id,
        codigo: formData.codigo,
        nombre: formData.nombre,
        tipoZonas: formData.tipoZonas,
        listaPrecioSeleccionada: formData.listaPrecioSeleccionada || null,
        zonas: formData.tipoZonas === "Zonas propias" ? zonas : null,
      })
    }
    handleClose()
  }

  const handleClose = () => {
    setFormData({
      codigo: "",
      nombre: "",
      tipoZonas: "Zonas propias",
      listaPrecioSeleccionada: "",
    })
    setZonas([...zonasPorDefecto])
    onClose()
  }

  if (!isOpen) return null

  const isZonasPropias = formData.tipoZonas === "Zonas propias"
  const isUsarZonasDe = formData.tipoZonas === "Usar zonas de"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-5xl max-h-[90vh] rounded-lg bg-white shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#6B46FF] to-[#8B5CF6]">
              <span className="text-xl font-bold text-white">$</span>
            </div>
            <h2 className="text-xl font-semibold text-[#6B46FF]">{isEditing ? "Editar precio" : "Precio nuevo"}</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Campos principales */}
            <div className="grid grid-cols-2 gap-6">
              {/* Columna izquierda */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Codigo. <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.codigo}
                    onChange={(e) => handleInputChange("codigo", e.target.value)}
                    placeholder="Código"
                    className="h-10 rounded-lg border-2 border-[#6B46FF] focus:ring-2 focus:ring-[#6B46FF]/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => handleInputChange("nombre", e.target.value)}
                    placeholder="Nombre"
                    className="h-10 rounded-lg border-gray-300 focus:border-[#6B46FF] focus:ring-2 focus:ring-[#6B46FF]/20"
                  />
                </div>
              </div>

              {/* Columna derecha */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Zonas <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.tipoZonas}
                    onValueChange={(value) => handleInputChange("tipoZonas", value)}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-2 border-[#6B46FF] bg-white text-gray-600 focus:ring-2 focus:ring-[#6B46FF]/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Zonas propias">Zonas propias</SelectItem>
                      <SelectItem value="Usar zonas de">Usar zonas de</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Botón AGREGAR ZONA solo si es "Zonas propias" */}
                {isZonasPropias && (
                  <Button
                    onClick={handleAddZona}
                    className="w-full bg-gradient-to-r from-[#6B46FF] to-[#8B5CF6] hover:from-[#5a3ad6] hover:to-[#7c4dd4]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    AGREGAR ZONA
                  </Button>
                )}

                {/* Dropdown de lista de precios solo si es "Usar zonas de" */}
                {isUsarZonasDe && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Zonas de <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.listaPrecioSeleccionada}
                      onValueChange={(value) => handleInputChange("listaPrecioSeleccionada", value)}
                    >
                      <SelectTrigger className="h-10 rounded-lg border-2 border-[#6B46FF] bg-white text-gray-600 focus:ring-2 focus:ring-[#6B46FF]/20">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {listasPreciosConZonasPropias.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-gray-500">No hay listas de precios disponibles</div>
                        ) : (
                          listasPreciosConZonasPropias.map((lista) => (
                            <SelectItem key={lista.id} value={lista.id.toString()}>
                              {lista.codigo} - {lista.nombre}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Tabla de zonas solo si es "Zonas propias" */}
            {isZonasPropias && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-12 gap-4 px-4 py-3">
                    <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-gray-700">Codigo</div>
                    <div className="col-span-3 text-xs font-semibold uppercase tracking-wider text-gray-700">Nombre</div>
                    <div className="col-span-3 text-xs font-semibold uppercase tracking-wider text-gray-700">CP's</div>
                    <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-gray-700">Valor $</div>
                    <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-gray-700 text-center">Acciones</div>
                  </div>
                </div>
                <div className="bg-white divide-y divide-gray-200">
                  {zonas.map((zona, index) => (
                    <div key={zona.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center">
                      <div className="col-span-2">
                        <Input
                          value={zona.codigo}
                          onChange={(e) => {
                            // Solo permitir números y máximo 3 dígitos
                            const value = e.target.value.replace(/\D/g, "").slice(0, 3)
                            if (!zona.isDefault) {
                              handleZonaChange(zona.id, "codigo", value.padStart(3, "0"))
                            }
                          }}
                          placeholder="Código"
                          disabled={zona.isDefault}
                          readOnly={zona.isDefault}
                          className={`h-9 rounded border-gray-300 focus:border-[#6B46FF] focus:ring-1 focus:ring-[#6B46FF]/20 ${
                            zona.isDefault ? "bg-gray-100 cursor-not-allowed" : ""
                          }`}
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          value={zona.nombre}
                          onChange={(e) => handleZonaChange(zona.id, "nombre", e.target.value)}
                          placeholder="Nombre"
                          className="h-9 rounded border-gray-300 focus:border-[#6B46FF] focus:ring-1 focus:ring-[#6B46FF]/20"
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          value={zona.cps}
                          onChange={(e) => handleZonaChange(zona.id, "cps", e.target.value)}
                          placeholder="CP's"
                          className="h-9 rounded border-gray-300 focus:border-[#6B46FF] focus:ring-1 focus:ring-[#6B46FF]/20"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          value={zona.valor}
                          onChange={(e) => handleZonaChange(zona.id, "valor", e.target.value)}
                          placeholder="Valor $"
                          type="number"
                          className="h-9 rounded border-gray-300 focus:border-[#6B46FF] focus:ring-1 focus:ring-[#6B46FF]/20"
                        />
                      </div>
                      <div className="col-span-2 flex justify-center">
                        {zonas.length === 1 ? (
                          <div className="h-9 w-9 flex items-center justify-center text-gray-400">
                            <X className="h-4 w-4" />
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveZona(zona.id)}
                            className="h-9 w-9 rounded text-[#6B46FF] hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-[#6B46FF] text-[#6B46FF] hover:bg-purple-50"
          >
            VOLVER
          </Button>
          <Button
            onClick={handleSave}
            className="bg-green-500 text-white hover:bg-green-600"
          >
            GUARDAR
          </Button>
        </div>
      </div>
    </div>
  )
}

