"use client"

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface FilterSectionProps {
  filters: {
    codigo: string
    nombreFantasia: string
    integraciones: string
  }
  onFilterChange: (field: string, value: string) => void
}

export function FilterSection({ filters, onFilterChange }: FilterSectionProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6B46FF] to-[#8B5CF6]">
          <Search className="h-4 w-4 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Filtros de búsqueda</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Código */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Código</label>
          <div className="relative">
            <Input
              value={filters.codigo}
              onChange={(e) => onFilterChange("codigo", e.target.value)}
              placeholder="Buscar por código..."
              className="h-10 rounded-lg border-gray-300 bg-gray-50 pl-10 transition-all focus:border-[#6B46FF] focus:bg-white focus:ring-2 focus:ring-[#6B46FF]/20"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </div>
          </div>
        </div>

        {/* Nombre fantasía */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Nombre fantasía</label>
          <div className="relative">
            <Input
              value={filters.nombreFantasia}
              onChange={(e) => onFilterChange("nombreFantasia", e.target.value)}
              placeholder="Buscar por nombre..."
              className="h-10 rounded-lg border-gray-300 bg-gray-50 pl-10 transition-all focus:border-[#6B46FF] focus:bg-white focus:ring-2 focus:ring-[#6B46FF]/20"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Integraciones */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Integraciones</label>
          <div className="relative">
            <Input
              value={filters.integraciones}
              onChange={(e) => onFilterChange("integraciones", e.target.value)}
              placeholder="Buscar por integración..."
              className="h-10 rounded-lg border-gray-300 bg-gray-50 pl-10 transition-all focus:border-[#6B46FF] focus:bg-white focus:ring-2 focus:ring-[#6B46FF]/20"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

