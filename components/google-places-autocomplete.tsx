"use client"

import { useEffect, useRef, useState } from "react"
import { warnDev, errorDev } from "@/lib/logger"

interface GooglePlacesAutocompleteProps {
  value: string
  onChange: (value: string, localidad?: string, codigoPostal?: string) => void
}

declare global {
  interface Window {
    google: any
  }
}

function extractLocalidadAndCP(addressComponents: any[]): { localidad: string; codigoPostal: string } {
  let localidad = ""
  let codigoPostal = ""

  if (!addressComponents?.length) return { localidad, codigoPostal }

  const ignoreTypes = ["route", "street_number", "street_address", "subpremise", "premise", "postal_code"]
  const getLong = (c: any) => c.longText ?? c.long_name ?? ""

  const provinceComponent = addressComponents.find(
    (c: any) =>
      c.types?.includes("administrative_area_level_1") &&
      !c.types?.some((t: string) => ignoreTypes.includes(t))
  )
  const provinceName = provinceComponent ? getLong(provinceComponent).toLowerCase() : ""
  const isCABA =
    provinceName.includes("ciudad autónoma") ||
    provinceName.includes("autonomous city") ||
    (provinceName.includes("buenos aires") && !provinceName.includes("provincia"))

  if (isCABA) {
    localidad = "CABA"
  } else {
    const localityComponent = addressComponents.find(
      (c: any) =>
        c.types?.includes("locality") &&
        !c.types?.some((t: string) => ignoreTypes.includes(t))
    )
    if (localityComponent) {
      localidad = getLong(localityComponent)
    } else {
      const level2 = addressComponents.find(
        (c: any) =>
          c.types?.includes("administrative_area_level_2") &&
          !c.types?.some((t: string) => ignoreTypes.includes(t))
      )
      if (level2) localidad = getLong(level2)
      else if (provinceComponent) localidad = getLong(provinceComponent)
    }
  }

  if (!localidad) {
    const anyLoc = addressComponents.find((c: any) => {
      const hasLoc =
        c.types?.some(
          (t: string) =>
            t.includes("locality") ||
            t.includes("administrative_area") ||
            t.includes("sublocality")
        ) ?? false
      const notStreet = !c.types?.some((t: string) => ignoreTypes.includes(t))
      return hasLoc && notStreet
    })
    if (anyLoc) localidad = getLong(anyLoc)
  }

  const postalComponent = addressComponents.find((c: any) => c.types?.includes("postal_code"))
  if (postalComponent) {
    const raw =
      postalComponent.longText ??
      postalComponent.long_name ??
      postalComponent.shortText ??
      postalComponent.short_name ??
      ""
    codigoPostal = String(raw).replace(/\D/g, "")
  }

  return { localidad, codigoPostal }
}

type Suggestion = { id: string; label: string; raw: any }

let scriptLoading = false
let scriptLoaded = false

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.google?.maps?.importLibrary || window.google?.maps?.places) {
    scriptLoaded = true
    return Promise.resolve()
  }
  const existing = document.querySelector('script[src*="maps.googleapis.com"]') as HTMLScriptElement | null
  if (existing) {
    return new Promise((resolve) => {
      if (window.google?.maps) {
        scriptLoaded = true
        resolve()
        return
      }
      existing.addEventListener("load", () => {
        scriptLoaded = true
        resolve()
      })
    })
  }
  if (!apiKey || apiKey === "YOUR_API_KEY") {
    return Promise.reject(new Error("missing-key"))
  }
  if (scriptLoading) {
    return new Promise((resolve) => {
      const t = setInterval(() => {
        if (scriptLoaded || window.google?.maps) {
          clearInterval(t)
          resolve()
        }
      }, 80)
    })
  }
  scriptLoading = true
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.id = "google-maps-places-script"
    script.onload = () => {
      scriptLoaded = true
      scriptLoading = false
      resolve()
    }
    script.onerror = () => {
      scriptLoading = false
      reject(new Error("script"))
    }
    document.head.appendChild(script)
  })
}

export function GooglePlacesAutocomplete({ value, onChange }: GooglePlacesAutocompleteProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [highlight, setHighlight] = useState(0)
  onChangeRef.current = onChange

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ""
    loadGoogleMaps(apiKey)
      .then(() => setReady(true))
      .catch((err) => {
        if (err?.message === "missing-key") {
          warnDev("Google Places: falta NEXT_PUBLIC_GOOGLE_PLACES_API_KEY. Se puede escribir la dirección a mano.")
        } else {
          errorDev("Error al cargar Google Maps API")
        }
        setReady(false)
      })
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  useEffect(() => {
    const q = value.trim()
    if (!ready || q.length < 3) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const items = await fetchSuggestions(q)
      if (!cancelled) {
        setSuggestions(items)
        setHighlight(0)
        setOpen(items.length > 0)
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [value, ready])

  const pick = async (item: Suggestion) => {
    setOpen(false)
    setSuggestions([])
    try {
      const details = await placeDetails(item.raw)
      const formatted = details.formattedAddress || item.label
      onChangeRef.current(formatted, details.localidad, details.codigoPostal)
    } catch (err) {
      errorDev("Error al obtener datos del lugar:", err)
      onChangeRef.current(item.label)
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          if (suggestions.length) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === "Enter") {
            e.preventDefault()
            void pick(suggestions[highlight])
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
        placeholder="Buscar dirección (ej. Demaria 4470, CABA)..."
        className="h-10 w-full rounded-xl border border-[#e6eaf4] bg-white px-3 text-[14px] font-medium text-[#1f2433] shadow-sm outline-none placeholder:text-[#8890a8] focus:border-[#1570ef] focus:ring-2 focus:ring-[#1570ef]/20"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && suggestions.length > 0 ? (
        <ul
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[#e6eaf4] bg-white py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={`block w-full px-3 py-2 text-left text-[13px] ${
                  i === highlight ? "bg-[#eef4ff] text-[#0a2a8f]" : "text-[#1f2433] hover:bg-[#f4f6fb]"
                }`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(s)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  try {
    if (window.google?.maps?.importLibrary) {
      const places = await window.google.maps.importLibrary("places")
      if (places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          includedRegionCodes: ["ar"],
        })
        return (suggestions || [])
          .map((s: any, i: number) => {
            const pred = s.placePrediction
            const label = pred?.text?.toString?.() || pred?.text?.text || pred?.mainText?.text || ""
            if (!label) return null
            return { id: pred?.placeId || `n-${i}`, label, raw: { kind: "new", pred } }
          })
          .filter(Boolean) as Suggestion[]
      }
    }
  } catch (err) {
    warnDev("Places AutocompleteSuggestion no disponible, pruebo API clásica", err)
  }

  try {
    const svc = window.google?.maps?.places?.AutocompleteService
    if (!svc) return []
    const service = new svc()
    const preds: any[] = await new Promise((resolve) => {
      service.getPlacePredictions(
        { input: query, componentRestrictions: { country: "ar" } },
        (results: any[], status: string) => {
          if (status === "OK" && Array.isArray(results)) resolve(results)
          else resolve([])
        }
      )
    })
    return preds.map((p) => ({
      id: p.place_id,
      label: p.description,
      raw: { kind: "legacy", placeId: p.place_id, description: p.description },
    }))
  } catch (err) {
    errorDev("Error buscando sugerencias de dirección:", err)
    return []
  }
}

async function placeDetails(raw: any): Promise<{
  formattedAddress: string
  localidad?: string
  codigoPostal?: string
}> {
  if (raw?.kind === "new" && raw.pred) {
    const place = await raw.pred.toPlace()
    await place.fetchFields({ fields: ["formattedAddress", "addressComponents"] })
    const { localidad, codigoPostal } = extractLocalidadAndCP(place.addressComponents ?? [])
    return { formattedAddress: place.formattedAddress ?? "", localidad, codigoPostal }
  }

  const placeId = raw?.placeId
  if (!placeId || !window.google?.maps?.places) {
    return { formattedAddress: raw?.description || "" }
  }
  const service = new window.google.maps.places.PlacesService(document.createElement("div"))
  const result: any = await new Promise((resolve, reject) => {
    service.getDetails(
      { placeId, fields: ["formatted_address", "address_components"] },
      (place: any, status: string) => {
        if (status === "OK" && place) resolve(place)
        else reject(new Error(status))
      }
    )
  })
  const { localidad, codigoPostal } = extractLocalidadAndCP(result.address_components ?? [])
  return { formattedAddress: result.formatted_address ?? raw?.description ?? "", localidad, codigoPostal }
}
