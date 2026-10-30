"use client"

import { useEffect, useRef, useState } from "react"
import { warnDev, errorDev } from "@/lib/logger"
import { getTenantDepot } from "@/lib/tenant"

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

let scriptLoading = false
let scriptLoaded = false

const GMP_NEXO_STYLE_ID = "gmp-place-autocomplete-nexo-overrides"

function ensureGmpStyles() {
  if (typeof document === "undefined" || document.getElementById(GMP_NEXO_STYLE_ID)) return
  const el = document.createElement("style")
  el.id = GMP_NEXO_STYLE_ID
  el.textContent = `
    gmp-place-autocomplete {
      display: block;
      width: 100%;
      color-scheme: light !important;
      color: #1f2433 !important;
      background-color: #ffffff;
      border: 1px solid #e6eaf4;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      font-family: inherit;
      box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
      --gmp-mat-color-on-surface: #1f2433;
      --gmp-mat-color-on-surface-variant: #525b76;
      --gmp-mat-color-surface: #ffffff;
    }
    gmp-place-autocomplete:focus-within {
      border-color: #1570ef;
      box-shadow: 0 0 0 2px rgba(21, 112, 239, 0.2);
    }
    gmp-place-autocomplete::part(prediction-list) {
      z-index: 9999;
      background: #ffffff;
      color: #1f2433;
      border: 1px solid #e6eaf4;
      border-radius: 12px;
      box-shadow: 0 10px 24px rgba(16, 24, 40, 0.12);
    }
    gmp-place-autocomplete::part(prediction-item),
    gmp-place-autocomplete::part(prediction-item-main-text),
    gmp-place-autocomplete::part(prediction-item-secondary-text) {
      color: #1f2433;
    }
  `
  document.head.appendChild(el)
}

function waitForImportLibrary(timeoutMs = 15000): Promise<void> {
  if (typeof window !== "undefined" && window.google?.maps?.importLibrary) {
    scriptLoaded = true
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const t = setInterval(() => {
      if (window.google?.maps?.importLibrary) {
        clearInterval(t)
        scriptLoaded = true
        resolve()
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(t)
        reject(new Error("timeout"))
      }
    }, 50)
  })
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.google?.maps?.importLibrary) {
    scriptLoaded = true
    return Promise.resolve()
  }
  const existing = document.querySelector('script[src*="maps.googleapis.com"]') as HTMLScriptElement | null
  if (existing) {
    return waitForImportLibrary()
  }
  if (!apiKey || apiKey === "YOUR_API_KEY") {
    return Promise.reject(new Error("missing-key"))
  }
  if (scriptLoading) {
    return waitForImportLibrary()
  }
  scriptLoading = true
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&v=weekly`
    script.async = true
    script.defer = true
    script.id = "google-maps-places-script"
    script.onload = () => {
      waitForImportLibrary()
        .then(() => {
          scriptLoading = false
          resolve()
        })
        .catch((err) => {
          scriptLoading = false
          reject(err)
        })
    }
    script.onerror = () => {
      scriptLoading = false
      reject(new Error("script"))
    }
    document.head.appendChild(script)
  })
}

export function GooglePlacesAutocomplete({ value, onChange }: GooglePlacesAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const autocompleteRef = useRef<any>(null)
  const onChangeRef = useRef(onChange)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  onChangeRef.current = onChange

  useEffect(() => {
    ensureGmpStyles()
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ""
    loadGoogleMaps(apiKey)
      .then(() => setReady(true))
      .catch((err) => {
        if (err?.message === "missing-key") {
          warnDev("Google Places: falta NEXT_PUBLIC_GOOGLE_PLACES_API_KEY.")
        } else {
          errorDev("Error al cargar Google Maps API")
        }
        setFailed(true)
      })
  }, [])

  useEffect(() => {
    if (!ready || !containerRef.current || !window.google?.maps?.importLibrary) return
    let cancelled = false
    const container = containerRef.current

    const init = async () => {
      try {
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places")
        if (cancelled || !container || !PlaceAutocompleteElement) return

        container.replaceChildren()
        const depot = getTenantDepot()
        const el = new PlaceAutocompleteElement({
          includedRegionCodes: ["ar"],
          requestedLanguage: "es",
          requestedRegion: "ar",
          placeholder: "Buscar dirección (ej. Demaria 4470, CABA)...",
          locationBias: { radius: 40000, center: { lat: depot.lat, lng: depot.lng } },
        })

        el.addEventListener("gmp-error", () => {
          errorDev("Google Places rechazó el pedido (API key o Places API New).")
        })

        el.addEventListener("input", () => {
          const typed = typeof el.value === "string" ? el.value : ""
          onChangeRef.current(typed)
        })

        el.addEventListener("gmp-select", async (event: any) => {
          const placePrediction = event.placePrediction
          if (!placePrediction) return
          try {
            const place = placePrediction.toPlace()
            await place.fetchFields({ fields: ["formattedAddress", "addressComponents"] })
            const formattedAddress = place.formattedAddress ?? el.value ?? ""
            const { localidad, codigoPostal } = extractLocalidadAndCP(place.addressComponents ?? [])
            if (formattedAddress) el.value = formattedAddress
            onChangeRef.current(formattedAddress, localidad, codigoPostal)
          } catch (err) {
            errorDev("Error al obtener datos del lugar:", err)
            onChangeRef.current(el.value || "")
          }
        })

        container.appendChild(el)
        autocompleteRef.current = el
        if (value) el.value = value
      } catch (err) {
        errorDev("Error al inicializar PlaceAutocompleteElement:", err)
        if (!cancelled) setFailed(true)
      }
    }

    void init()
    return () => {
      cancelled = true
      autocompleteRef.current = null
      container.replaceChildren()
    }
    // value is applied once after mount; clearing is handled in the next effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  useEffect(() => {
    const el = autocompleteRef.current
    if (!el) return
    if (!value && el.value) el.value = ""
  }, [value])

  if (failed) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar dirección (ej. Demaria 4470, CABA)..."
        className="h-10 w-full rounded-xl border border-[#e6eaf4] bg-white px-3 text-[14px] font-medium text-[#1f2433] shadow-sm outline-none placeholder:text-[#8890a8] focus:border-[#1570ef] focus:ring-2 focus:ring-[#1570ef]/20"
        autoComplete="off"
      />
    )
  }

  return <div ref={containerRef} className="min-h-10 w-full" />
}
