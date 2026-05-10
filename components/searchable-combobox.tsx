"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type ComboboxOption = { value: string; label: string }

type SearchableComboboxProps = {
  value: string
  onValueChange: (next: string) => void
  options: ComboboxOption[]
  /** Texto de la opción que vacía el valor (ej. todos los grupos) */
  clearLabel: string
  placeholder?: string
  disabled?: boolean
  /**
   * true: el texto del input se envía al padre en cada cambio (filtro libre + lista).
   * false: solo al elegir una fila del menú (valor fijo de la lista).
   */
  freeText?: boolean
  className?: string
  id?: string
}

export function SearchableCombobox({
  value,
  onValueChange,
  options,
  clearLabel,
  placeholder,
  disabled,
  freeText = false,
  className,
  id,
}: SearchableComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])

  useEffect(() => {
    if (!open) {
      if (freeText) {
        setQuery(value)
      } else {
        setQuery(selected?.label ?? "")
      }
    }
  }, [open, value, selected?.label, freeText])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", onDoc)
    }
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const showList = open && !disabled

  const inputDisplay = open ? query : freeText ? value : selected?.label ?? ""

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="flex h-11 rounded-md border border-input bg-white shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <input
          id={id}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-3 text-[14px] text-[#525b76] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          value={inputDisplay}
          onChange={(e) => {
            const v = e.target.value
            setQuery(v)
            if (freeText) {
              onValueChange(v)
            }
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            if (!freeText) {
              setQuery(selected?.label ?? "")
            } else {
              setQuery(value)
            }
          }}
          onBlur={() => {
            if (freeText) {
              onValueChange(query)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false)
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          className="flex shrink-0 items-center border-l border-input px-2 text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
          aria-label="Abrir lista"
          onMouseDown={(e) => {
            e.preventDefault()
            setOpen((o) => !o)
            if (!open && !freeText) {
              setQuery(selected?.label ?? "")
            }
            if (!open && freeText) {
              setQuery(value)
            }
          }}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {showList && (
        <ul
          className="absolute z-[60] mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-white py-1 text-[14px] shadow-md"
          role="listbox"
        >
          <li
            role="option"
            className="cursor-pointer px-3 py-2 text-muted-foreground hover:bg-muted/60"
            onMouseDown={(e) => {
              e.preventDefault()
              onValueChange("")
              setOpen(false)
            }}
          >
            {clearLabel}
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">Sin coincidencias</li>
          ) : (
            filtered.map((o) => (
              <li
                key={o.value}
                role="option"
                className={cn(
                  "cursor-pointer px-3 py-2 hover:bg-muted/60",
                  o.value === value && "bg-[#eef4ff] font-medium text-[#1570ef]"
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onValueChange(o.value)
                  setQuery(o.label)
                  setOpen(false)
                }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
