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

let scriptLoading = false
let scriptLoaded = false

export function GooglePlacesAutocomplete({ value, onChange }: GooglePlacesAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const autocompleteRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [showAutocomplete, setShowAutocomplete] = useState(true)

  useEffect(() => {
    // Verificar si el script ya está cargado
    if (window.google && window.google.maps) {
      setIsScriptLoaded(true)
      scriptLoaded = true
      return
    }

    // Verificar si ya hay un script cargándose
    if (scriptLoading) {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          setIsScriptLoaded(true)
          scriptLoaded = true
          scriptLoading = false
          clearInterval(checkInterval)
        }
      }, 100)
      return () => clearInterval(checkInterval)
    }

    // Verificar si el script ya existe en el DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      scriptLoading = true
      existingScript.addEventListener("load", () => {
        setIsScriptLoaded(true)
        scriptLoaded = true
        scriptLoading = false
      })
      if (window.google && window.google.maps) {
        setIsScriptLoaded(true)
        scriptLoaded = true
        scriptLoading = false
      }
      return
    }

    // Cargar el script solo si no existe
    scriptLoading = true
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || "YOUR_API_KEY"}`
    script.async = true
    script.defer = true
    script.id = "google-maps-script"
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
    if (!isScriptLoaded || !containerRef.current || !window.google) return

    const initializeAutocomplete = async () => {
      try {
        // Importar la biblioteca de lugares
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places")

        // Limpiar el contenedor si ya hay un elemento
        if (containerRef.current && containerRef.current.firstChild) {
          containerRef.current.innerHTML = ""
        }

        // Crear el elemento de autocompletado
        const placeAutocomplete = new PlaceAutocompleteElement()
        
        // Configurar propiedades del elemento (nueva API)
        placeAutocomplete.includedRegionCodes = ["ar"] // Restringir a Argentina
        placeAutocomplete.includedPrimaryTypes = ["street_address"] // Solo direcciones

        // Agregar estilos para que se vea como el Input
        placeAutocomplete.style.width = "100%"
        placeAutocomplete.style.height = "32px"
        placeAutocomplete.style.fontSize = "14px"
        placeAutocomplete.style.padding = "6px 12px"
        placeAutocomplete.style.border = "1px solid #d1d5db"
        placeAutocomplete.style.borderRadius = "8px"
        placeAutocomplete.style.outline = "none"

        // Agregar el elemento al contenedor solo si showAutocomplete es true
        if (showAutocomplete && containerRef.current) {
          containerRef.current.appendChild(placeAutocomplete)
          autocompleteRef.current = placeAutocomplete
          
          // Establecer el valor inicial si existe
          if (value) {
            placeAutocomplete.value = value
          }
        }

        // Escuchar el evento de selección de lugar (nuevo evento: gmp-select)
        placeAutocomplete.addEventListener("gmp-select", async (event: any) => {
          console.log("Event received:", event)
          const placePrediction = event.placePrediction
          console.log("Place prediction:", placePrediction)
          
          if (placePrediction) {
            try {
              // Convertir la predicción a un Place completo
              const place = await placePrediction.toPlace({
                fields: ["formattedAddress", "addressComponents"],
              })
              
              console.log("Place object:", place)
              
              if (place) {
                // Debug: ver qué tiene el place antes de fetchFields
                console.log("=== GOOGLE PLACES DEBUG ===")
                console.log("Place object (before fetchFields):", place)
                console.log("Place keys:", Object.keys(place))
                
                // Obtener los detalles completos del lugar
                await place.fetchFields({
                  fields: ["formattedAddress", "addressComponents"],
                })

                console.log("Place object (after fetchFields):", place)
                console.log("Place keys (after fetchFields):", Object.keys(place))
                
                // Intentar diferentes formas de acceder a los datos
                const formattedAddress = place.formattedAddress || place.formatted_address || ""
                const addressComponents = place.addressComponents || place.address_components
                
                console.log("Formatted address:", formattedAddress)
                console.log("All address_components:", addressComponents)
                
                if (addressComponents) {
                  addressComponents.forEach((component: any) => {
                    const name = component.longText || component.long_name || component.longText
                    const types = component.types || []
                    console.log(`- ${name} (${types.join(", ")})`)
                  })
                }
                
                // Extraer localidad de los componentes de la dirección
                let localidad = ""
                if (addressComponents) {
                  const ignoreTypes = ["route", "street_number", "street_address", "subpremise", "premise", "postal_code"]
                  
                  // Buscar primero administrative_area_level_1 para determinar si es CABA
                  const provinceComponent = addressComponents.find(
                    (component: any) => 
                      component.types.includes("administrative_area_level_1") &&
                      !component.types.some((type: string) => ignoreTypes.includes(type))
                  )
                  
                  let provinceName = ""
                  let isCABA = false
                  if (provinceComponent) {
                    provinceName = (provinceComponent.longText || provinceComponent.long_name).toLowerCase()
                    console.log("Province found:", provinceComponent.longText || provinceComponent.long_name, "Types:", provinceComponent.types)
                    
                    // Verificar si es CABA
                    isCABA = provinceName.includes("ciudad autónoma") || 
                             provinceName.includes("autonomous city") ||
                             (provinceName.includes("buenos aires") && !provinceName.includes("provincia"))
                  }
                  
                  // Si es CABA, usar "CABA" directamente
                  if (isCABA) {
                    localidad = "CABA"
                  } 
                  // Para TODAS las demás provincias, priorizar locality sobre la provincia
                  else {
                    // Buscar locality primero (para todas las provincias excepto CABA)
                    const localityComponent = addressComponents.find(
                      (component: any) => 
                        component.types.includes("locality") &&
                        !component.types.some((type: string) => ignoreTypes.includes(type))
                    )
                    if (localityComponent) {
                      const localityName = localityComponent.longText || localityComponent.long_name
                      console.log("Locality found:", localityName, "Types:", localityComponent.types)
                      localidad = localityName
                    } else {
                      // Si no hay locality, usar administrative_area_level_2
                      const level2Component = addressComponents.find(
                        (component: any) => 
                          component.types.includes("administrative_area_level_2") &&
                          !component.types.some((type: string) => ignoreTypes.includes(type))
                      )
                      if (level2Component) {
                        const level2Name = level2Component.longText || level2Component.long_name
                        console.log("Level 2 found:", level2Name, "Types:", level2Component.types)
                        localidad = level2Name
                      } else if (provinceComponent) {
                        // Como último recurso, usar la provincia
                        localidad = provinceComponent.longText || provinceComponent.long_name
                      }
                    }
                  }
              
              if (!localidad) {
                const level2Component = addressComponents.find(
                  (component: any) => 
                    component.types.includes("administrative_area_level_2") &&
                    !component.types.some((type: string) => ignoreTypes.includes(type))
                )
                if (level2Component) {
                  const level2Name = level2Component.longText || level2Component.long_name
                  console.log("Level 2 found:", level2Name, "Types:", level2Component.types)
                  localidad = level2Name
                }
              }
              
              if (!localidad) {
                const anyLocalityComponent = addressComponents.find(
                  (component: any) => {
                    const hasLocalityType = component.types.some((type: string) => 
                      type.includes("locality") || 
                      type.includes("administrative_area") ||
                      type.includes("sublocality")
                    )
                    const isNotStreet = !component.types.some((type: string) => ignoreTypes.includes(type))
                    return hasLocalityType && isNotStreet
                  }
                )
                if (anyLocalityComponent) {
                  const anyLocalityName = anyLocalityComponent.longText || anyLocalityComponent.long_name
                  console.log("Any locality component found:", anyLocalityName, "Types:", anyLocalityComponent.types)
                  localidad = anyLocalityName
                }
              }
                }
                
                console.log("✅ Localidad extraída final:", localidad || "NO ENCONTRADA")
                
                // Extraer código postal y limpiar (solo números)
                let codigoPostal = ""
                if (addressComponents) {
                  const postalCodeComponent = addressComponents.find(
                    (component: any) => component.types.includes("postal_code")
                  )
                  if (postalCodeComponent) {
                    const rawPostalCode = postalCodeComponent.longText || postalCodeComponent.long_name || postalCodeComponent.shortText || postalCodeComponent.short_name || ""
                    // Extraer solo los números del código postal
                    codigoPostal = rawPostalCode.replace(/\D/g, "")
                    console.log("✅ Código postal extraído (raw):", rawPostalCode, "-> (limpio):", codigoPostal)
                  }
                }
                
                console.log("=== END DEBUG ===")
                
                // Ocultar el web component y mostrar el input controlado con el valor
                setShowAutocomplete(false)
                
                onChange(formattedAddress, localidad, codigoPostal)
              }
          } catch (error) {
            console.error("Error al procesar lugar:", error)
          }
        }
      })
    } catch (error) {
      console.error("Error al inicializar PlaceAutocompleteElement:", error)
    }
  }

    initializeAutocomplete()

    return () => {
      if (containerRef.current && containerRef.current.firstChild) {
        containerRef.current.innerHTML = ""
      }
    }
  }, [isScriptLoaded, onChange, showAutocomplete])

  // Si hay un valor y no estamos mostrando el autocomplete, mostrar el input controlado
  // También mostrar el input si el usuario hace clic para editar
  const handleInputFocus = () => {
    setShowAutocomplete(true)
    // Limpiar el contenedor y reinicializar el autocomplete
    if (containerRef.current) {
      containerRef.current.innerHTML = ""
    }
    autocompleteRef.current = null
  }

  return (
    <div className="w-full">
      {(!isScriptLoaded || !showAutocomplete || value) && (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            // Si el usuario empieza a escribir, mostrar el autocomplete
            if (e.target.value && !showAutocomplete) {
              setShowAutocomplete(true)
            }
          }}
          onFocus={handleInputFocus}
          placeholder="Buscar dirección..."
          className="w-full h-8 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6B46FF] focus:border-transparent"
        />
      )}
      {isScriptLoaded && showAutocomplete && !value && (
        <div ref={containerRef} className="w-full"></div>
      )}
    </div>
  )
}

