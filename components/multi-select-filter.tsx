"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export type MultiSelectOption = { value: string; label: string }

type MultiSelectFilterProps = {
  values: string[]
  onValuesChange: (next: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
  /** Texto cuando no hay nada elegido (= todos) */
  emptyLabel?: string
  searchable?: boolean
  className?: string
  disabled?: boolean
}

export function MultiSelectFilter({
  values,
  onValuesChange,
  options,
  placeholder = "Seleccionar…",
  emptyLabel = "Todos",
  searchable = false,
  className,
  disabled,
}: MultiSelectFilterProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]))
    return values.map((v) => map.get(v) ?? v)
  }, [options, values])

  const toggle = (value: string) => {
    if (values.includes(value)) {
      onValuesChange(values.filter((v) => v !== value))
    } else {
      onValuesChange([...values, value])
    }
  }

  const summary =
    values.length === 0
      ? emptyLabel
      : values.length === 1
        ? selectedLabels[0]
        : `${values.length} seleccionados`

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-white px-3 text-left text-[14px] text-[#525b76] shadow-sm outline-none hover:bg-muted/20 focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          values.length > 0 && "font-medium text-[#1f2433]"
        )}
      >
        <span className="min-w-0 truncate">{summary || placeholder}</span>
        <span className="flex shrink-0 items-center gap-1">
          {values.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Limpiar selección"
              onClick={(e) => {
                e.stopPropagation()
                onValuesChange([])
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  e.stopPropagation()
                  onValuesChange([])
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-[60] mt-1 w-full overflow-hidden rounded-md border border-input bg-white shadow-md">
          {searchable && (
            <div className="border-b border-input p-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                className="h-9 w-full rounded-md border border-input bg-white px-2 text-[13px] outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>
          )}
          <ul className="max-h-56 overflow-y-auto py-1 text-[14px]" role="listbox" aria-multiselectable>
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-muted-foreground hover:bg-muted/60"
                onClick={() => {
                  onValuesChange([])
                  setOpen(false)
                }}
              >
                {emptyLabel}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">Sin coincidencias</li>
            ) : (
              filtered.map((o) => {
                const checked = values.includes(o.value)
                return (
                  <li key={o.value}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-muted/60",
                        checked && "bg-[#eef4ff]"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(o.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className={cn("min-w-0 flex-1 truncate", checked && "font-medium text-[#1570ef]")}>
                        {o.label}
                      </span>
                    </label>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
