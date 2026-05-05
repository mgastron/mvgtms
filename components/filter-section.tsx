"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiBaseUrl } from "@/lib/api-config"
import { warnDev } from "@/lib/logger"

const fieldLabelClass = "block text-[14px] font-medium text-[#4d5571]"

const filterInputClass =
  "h-10 rounded-xl border border-[#e6eaf4] bg-white text-[14px] font-medium text-[#1f2433] shadow-sm placeholder:font-normal placeholder:text-[#8890a8] focus-visible:border-[#1570ef] focus-visible:ring-2 focus-visible:ring-[#1570ef]/20 focus-visible:ring-offset-0"

/** Valores del filtro de integración (solo “con integración configurada”; coinciden con `clients-table`) */
export type FiltroIntegracionCliente = "todos" | "flex" | "tiendanube" | "shopify" | "vtex"

interface GrupoOpt {
  id: number
  nombre: string
}

interface FilterSectionProps {
  filters: {
    nombreFantasia: string
    grupoId: string
    integraciones: string
  }
  onFilterChange: (field: string, value: string) => void
  onClearFilters?: () => void
}

export function FilterSection({ filters, onFilterChange, onClearFilters }: FilterSectionProps) {
  const integracion = (filters.integraciones || "todos") as FiltroIntegracionCliente
  const [grupos, setGrupos] = useState<GrupoOpt[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/grupos`)
        if (res.ok) {
          const data = await res.json()
          setGrupos(Array.isArray(data) ? data : [])
        }
      } catch (e) {
        warnDev("No se pudieron cargar grupos para el filtro:", e)
        setGrupos([])
      }
    }
    load()
  }, [])

  return (
    <div className="rounded-2xl border border-[#e6eaf4] bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-[18px] font-semibold text-[#4f46ce]">Filtros</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <label className={fieldLabelClass}>Nombre</label>
          <Input
            value={filters.nombreFantasia}
            onChange={(e) => onFilterChange("nombreFantasia", e.target.value)}
            placeholder="Buscar por nombre…"
            className={filterInputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className={fieldLabelClass}>Grupo</label>
          <Select value={filters.grupoId || "todos"} onValueChange={(v) => onFilterChange("grupoId", v === "todos" ? "" : v)}>
            <SelectTrigger className="h-10 w-full text-[14px] font-medium text-[#1f2433]">
              <SelectValue placeholder="Todos los grupos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los grupos</SelectItem>
              {grupos.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className={fieldLabelClass}>Integración</label>
          <Select value={integracion} onValueChange={(v) => onFilterChange("integraciones", v)}>
            <SelectTrigger className="h-10 w-full text-[14px] font-medium text-[#1f2433]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="flex">Flex</SelectItem>
              <SelectItem value="tiendanube">Tienda Nube</SelectItem>
              <SelectItem value="shopify">Shopify</SelectItem>
              <SelectItem value="vtex">VTEX</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {onClearFilters ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#e6eaf4] pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClearFilters}
            className="h-10 rounded-xl border-[#e6eaf4] px-5 text-[14px] font-semibold text-[#4d5571] hover:bg-[#f7f8fc]"
          >
            Limpiar filtros
          </Button>
        </div>
      ) : null}
    </div>
  )
}
