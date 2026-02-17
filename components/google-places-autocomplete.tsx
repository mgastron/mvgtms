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
  const getLong = (c: any) => c.long_name || c.longText || ""

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
    const raw = postalComponent.long_name || postalComponent.short_name || postalComponent.longText || postalComponent.shortText || ""
    codigoPostal = raw.replace(/\D/g, "")
  }

  return { localidad, codigoPostal }
}

let scriptLoading = false
let scriptLoaded = false

export function GooglePlacesAutocomplete({ value, onChange }: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const placesServiceRef = useRef<any>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)

  // Cargar script de Google Maps con la biblioteca Places
  useEffect(() => {
    if (typeof window === "undefined") return

    if (window.google?.maps?.places) {
      setIsScriptLoaded(true)
      scriptLoaded = true
      return
    }

    if (scriptLoading) {
      const t = setInterval(() => {
        if (window.google?.maps?.places) {
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
        if (window.google?.maps?.places) {
          setIsScriptLoaded(true)
          scriptLoaded = true
          scriptLoading = false
        }
      })
      if (window.google?.maps?.places) {
        setIsScriptLoaded(true)
        scriptLoaded = true
        scriptLoading = false
      }
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ""
    if (!apiKey || apiKey === "YOUR_API_KEY") {
      console.warn(
        "Google Places: NEXT_PUBLIC_GOOGLE_PLACES_API_KEY no está configurada. Podés escribir la dirección a mano; las sugerencias no aparecerán."
      )
      setIsScriptLoaded(true)
      return
    }

    scriptLoading = true
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
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
    if (!isScriptLoaded || !window.google?.maps?.places || !inputRef.current) return

    const input = inputRef.current
    if (autocompleteRef.current) return

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: "ar" },
        types: ["address"],
      })
      // Pedir explícitamente los campos para tener dirección completa, localidad y CP
      autocomplete.setFields(["formatted_address", "address_components", "place_id"])

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (!place) return

        const formattedAddress = place.formatted_address || (input?.value ?? "")
        let addressComponents: any[] = place.address_components || []

        // Si getPlace() no devolvió address_components (común en algunas configuraciones), pedir Place Details
        if (place.place_id && addressComponents.length === 0) {
          if (!placesServiceRef.current) {
            const div = document.createElement("div")
            placesServiceRef.current = new window.google.maps.places.PlacesService(div)
          }
          placesServiceRef.current.getDetails(
            {
              placeId: place.place_id,
              fields: ["formatted_address", "address_components"],
            },
            (detail: any, status: string) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && detail) {
                const addr = detail.formatted_address || formattedAddress
                const components = detail.address_components || []
                const { localidad, codigoPostal } = extractLocalidadAndCP(components)
                onChange(addr, localidad, codigoPostal)
              } else {
                onChange(formattedAddress, undefined, undefined)
              }
            }
          )
          return
        }

        const { localidad, codigoPostal } = extractLocalidadAndCP(addressComponents)
        onChange(formattedAddress, localidad, codigoPostal)
      })

      autocompleteRef.current = autocomplete
    } catch (err) {
      console.warn("Google Places Autocomplete no pudo inicializarse (podés escribir la dirección a mano):", err)
    }

    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
        } catch (_) {}
      }
      autocompleteRef.current = null
      placesServiceRef.current = null
    }
  }, [isScriptLoaded, onChange])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Escribí o buscá dirección (ej. Av. Corrientes 1234, CABA)"
      className="w-full h-8 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6B46FF] focus:border-transparent"
      autoComplete="off"
    />
  )
}
