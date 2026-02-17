"use client"

import { useEffect, useRef, useState } from "react"

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
    const raw = postalComponent.longText ?? postalComponent.long_name ?? postalComponent.shortText ?? postalComponent.short_name ?? ""
    codigoPostal = String(raw).replace(/\D/g, "")
  }

  return { localidad, codigoPostal }
}

let scriptLoading = false
let scriptLoaded = false

export function GooglePlacesAutocomplete({ value, onChange }: GooglePlacesAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const autocompleteRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [showWidget, setShowWidget] = useState(true)

  // Cargar script para la API nueva (PlaceAutocompleteElement) — sin libraries=places, con loading=async
  useEffect(() => {
    if (typeof window === "undefined") return

    if (window.google?.maps?.importLibrary) {
      setIsScriptLoaded(true)
      scriptLoaded = true
      return
    }

    if (scriptLoading) {
      const t = setInterval(() => {
        if (window.google?.maps?.importLibrary) {
          setIsScriptLoaded(true)
          scriptLoaded = true
          scriptLoading = false
          clearInterval(t)
        }
      }, 100)
      return () => clearInterval(t)
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existing) {
      scriptLoading = true
      existing.addEventListener("load", () => {
        if (window.google?.maps?.importLibrary) {
          setIsScriptLoaded(true)
          scriptLoaded = true
          scriptLoading = false
        }
      })
      if (window.google?.maps?.importLibrary) {
        setIsScriptLoaded(true)
        scriptLoaded = true
        scriptLoading = false
      }
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ""
    if (!apiKey || apiKey === "YOUR_API_KEY") {
      console.warn(
        "Google Places: configurá NEXT_PUBLIC_GOOGLE_PLACES_API_KEY para ver sugerencias de dirección (con localidad y CP)."
      )
      setIsScriptLoaded(true)
      return
    }

    scriptLoading = true
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`
    script.async = true
    script.defer = true
    script.id = "google-maps-places-script"
    script.onload = () => {
      setIsScriptLoaded(true)
      scriptLoaded = true
      scriptLoading = false
    }
    script.onerror = () => {
      scriptLoading = false
      console.error("Error al cargar Google Maps API")
    }
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!isScriptLoaded || !containerRef.current || !window.google?.maps?.importLibrary) return
    if (!showWidget || value) return

    let cancelled = false

    const init = async () => {
      try {
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places")

        if (cancelled || !containerRef.current) return

        if (containerRef.current.firstChild) containerRef.current.innerHTML = ""

        const placeAutocomplete = new PlaceAutocompleteElement()
        placeAutocomplete.includedRegionCodes = ["ar"]
        placeAutocomplete.includedPrimaryTypes = ["street_address"]

        placeAutocomplete.style.width = "100%"
        placeAutocomplete.style.height = "32px"
        placeAutocomplete.style.fontSize = "14px"
        placeAutocomplete.style.padding = "6px 12px"
        placeAutocomplete.style.border = "1px solid #d1d5db"
        placeAutocomplete.style.borderRadius = "8px"
        placeAutocomplete.style.outline = "none"

        placeAutocomplete.addEventListener("gmp-select", async (event: any) => {
          const placePrediction = event.placePrediction
          if (!placePrediction) return

          try {
            const place = await placePrediction.toPlace({ fields: ["formattedAddress", "addressComponents"] })
            if (!place) return

            await place.fetchFields({ fields: ["formattedAddress", "addressComponents"] })

            const formattedAddress = place.formattedAddress ?? ""
            const addressComponents = place.addressComponents ?? []

            const { localidad, codigoPostal } = extractLocalidadAndCP(addressComponents)
            setShowWidget(false)
            onChange(formattedAddress, localidad, codigoPostal)
          } catch (err) {
            console.error("Error al obtener datos del lugar:", err)
          }
        })

        containerRef.current.appendChild(placeAutocomplete)
        autocompleteRef.current = placeAutocomplete
      } catch (err) {
        console.error("Error al inicializar PlaceAutocompleteElement:", err)
      }
    }

    init()
    return () => {
      cancelled = true
      if (containerRef.current?.firstChild) containerRef.current.innerHTML = ""
      autocompleteRef.current = null
    }
  }, [isScriptLoaded, showWidget, value, onChange])

  const handleFocus = () => {
    setShowWidget(true)
    if (containerRef.current) containerRef.current.innerHTML = ""
    autocompleteRef.current = null
  }

  return (
    <div className="w-full">
      {(!isScriptLoaded || !showWidget || value) && (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          placeholder="Buscar dirección (ej. Demaria 4470, CABA)..."
          className="w-full h-8 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6B46FF] focus:border-transparent"
          autoComplete="off"
        />
      )}
      {isScriptLoaded && showWidget && !value && (
        <div ref={containerRef} className="w-full min-h-[32px]" />
      )}
    </div>
  )
}
