"use client"

import { useEffect, useRef } from "react"
import { loadLeaflet } from "@/lib/leaflet-loader"

export type OsmMarker = {
  lat: number
  lng: number
  title?: string
  popup?: string
  color?: string
}

type OsmMapProps = {
  markers: OsmMarker[]
  center?: { lat: number; lng: number }
  zoom?: number
  className?: string
  onMarkerClick?: (index: number) => void
  mapRefOut?: (api: { setView: (lat: number, lng: number, zoom?: number) => void } | null) => void
}

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 }

function markerKey(m: OsmMarker): string {
  return m.title || `${m.lat.toFixed(5)},${m.lng.toFixed(5)}`
}

function popupHtml(m: OsmMarker): string {
  return `<strong>${m.title || ""}</strong>${m.popup ? `<br/>${m.popup}` : ""}`
}

function centerKey(c?: { lat: number; lng: number } | null): string | null {
  if (!c) return null
  return `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`
}

export function OsmMap({
  markers,
  center,
  zoom = 12,
  className,
  onMarkerClick,
  mapRefOut,
}: OsmMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const markersByKeyRef = useRef<Map<string, any>>(new Map())
  const markersRef = useRef(markers)
  const centerRef = useRef(center)
  const zoomRef = useRef(zoom)
  const onMarkerClickRef = useRef(onMarkerClick)
  const mapRefOutRef = useRef(mapRefOut)
  const userMovedRef = useRef(false)
  const programmaticRef = useRef(false)
  const lastCenterKeyRef = useRef<string | null>(null)
  const openedKeyRef = useRef<string | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncRef = useRef<(isInitial: boolean) => void>(() => {})

  markersRef.current = markers
  centerRef.current = center
  zoomRef.current = zoom
  onMarkerClickRef.current = onMarkerClick
  mapRefOutRef.current = mapRefOut

  useEffect(() => {
    let cancelled = false

    const clearHold = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }
    }

    const bindOpen = (marker: any, key: string) => {
      const open = () => {
        openedKeyRef.current = key
        marker.openPopup()
        const idx = markersRef.current.findIndex((m) => markerKey(m) === key)
        if (idx >= 0) onMarkerClickRef.current?.(idx)
      }
      marker.on("click", open)
      marker.on("contextmenu", (event: any) => {
        event.originalEvent?.preventDefault?.()
        open()
      })
      marker.on("mousedown", () => {
        clearHold()
        holdTimerRef.current = setTimeout(open, 420)
      })
      marker.on("touchstart", () => {
        clearHold()
        holdTimerRef.current = setTimeout(open, 420)
      })
      marker.on("mouseup", clearHold)
      marker.on("mouseout", clearHold)
      marker.on("touchend", clearHold)
      marker.on("touchmove", clearHold)
      marker.on("popupopen", () => {
        openedKeyRef.current = key
      })
      marker.on("popupclose", () => {
        if (openedKeyRef.current === key) openedKeyRef.current = null
      })
    }

    const setViewSafe = (map: any, lat: number, lng: number, z: number) => {
      programmaticRef.current = true
      map.setView([lat, lng], z)
      programmaticRef.current = false
    }

    const maybeCenter = (map: any, isInitial: boolean) => {
      const currentCenter = centerRef.current
      if (!currentCenter || userMovedRef.current) return
      const key = centerKey(currentCenter)
      if (!isInitial && lastCenterKeyRef.current === key) return
      lastCenterKeyRef.current = key
      const list = markersRef.current
      const currentZoom = zoomRef.current
      setViewSafe(
        map,
        currentCenter.lat,
        currentCenter.lng,
        list.length <= 1 ? Math.max(currentZoom, 15) : isInitial ? currentZoom : map.getZoom()
      )
    }

    const syncMarkers = (isInitial: boolean) => {
      const L = leafletRef.current
      const map = mapRef.current
      if (!L || !map) return
      if (!layerRef.current) {
        layerRef.current = L.layerGroup().addTo(map)
      }
      const list = markersRef.current
      const existing = markersByKeyRef.current
      const nextKeys = new Set<string>()

      list.forEach((m) => {
        if (m.lat == null || m.lng == null) return
        const key = markerKey(m)
        nextKeys.add(key)
        const prev = existing.get(key)
        if (prev) {
          prev.setLatLng([m.lat, m.lng])
          prev.setStyle({ fillColor: m.color || "#1570ef" })
          if (m.popup || m.title) {
            prev.setPopupContent(popupHtml(m))
          }
        } else {
          const marker = L.circleMarker([m.lat, m.lng], {
            radius: 9,
            color: "#ffffff",
            weight: 2,
            fillColor: m.color || "#1570ef",
            fillOpacity: 1,
          })
          if (m.popup || m.title) {
            marker.bindPopup(popupHtml(m), { autoPan: false, closeOnClick: true })
          }
          bindOpen(marker, key)
          marker.addTo(layerRef.current)
          existing.set(key, marker)
        }
      })

      for (const [key, marker] of Array.from(existing.entries())) {
        if (!nextKeys.has(key)) {
          layerRef.current.removeLayer(marker)
          existing.delete(key)
          if (openedKeyRef.current === key) openedKeyRef.current = null
        }
      }

      const opened = openedKeyRef.current
      if (opened) {
        const still = existing.get(opened)
        if (still && !still.isPopupOpen()) still.openPopup()
      }

      maybeCenter(map, isInitial)
    }

    syncRef.current = syncMarkers

    const start = async () => {
      if (!containerRef.current) return
      try {
        const L = await loadLeaflet()
        if (cancelled || !containerRef.current) return
        leafletRef.current = L

        const currentMarkers = markersRef.current
        const currentCenter = centerRef.current
        const startCenter =
          currentCenter ||
          (currentMarkers[0] ? { lat: currentMarkers[0].lat, lng: currentMarkers[0].lng } : DEFAULT_CENTER)
        const map = L.map(containerRef.current, {
          center: [startCenter.lat, startCenter.lng],
          zoom: currentMarkers.length === 1 ? Math.max(zoomRef.current, 15) : zoomRef.current,
        })
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Tiles &copy; Esri",
            maxZoom: 16,
          }
        ).addTo(map)
        const markUserMove = () => {
          if (!programmaticRef.current) userMovedRef.current = true
        }
        map.on("dragstart", markUserMove)
        map.on("zoomstart", markUserMove)
        mapRef.current = map
        layerRef.current = L.layerGroup().addTo(map)
        mapRefOutRef.current?.({
          setView: (lat, lng, z) => {
            userMovedRef.current = true
            setViewSafe(map, lat, lng, z ?? 15)
          },
        })
        lastCenterKeyRef.current = centerKey(startCenter)
        syncMarkers(true)
        const bump = () => {
          if (!cancelled) map.invalidateSize()
        }
        bump()
        requestAnimationFrame(bump)
        const t1 = setTimeout(bump, 120)
        const t2 = setTimeout(bump, 400)
        const t3 = setTimeout(bump, 900)
        let ro: ResizeObserver | null = null
        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          ro = new ResizeObserver(bump)
          ro.observe(containerRef.current)
        }
        ;(map as any).__nexoCleanupSize = () => {
          clearTimeout(t1)
          clearTimeout(t2)
          clearTimeout(t3)
          ro?.disconnect()
        }
      } catch {
        // el contenedor queda vacío; el caller muestra el aviso
      }
    }

    start()
    return () => {
      cancelled = true
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      mapRefOutRef.current?.(null)
      markersByKeyRef.current.clear()
      if (mapRef.current) {
        mapRef.current.__nexoCleanupSize?.()
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    syncRef.current(false)
  }, [markers, center, zoom])

  return <div ref={containerRef} className={className || "h-full w-full"} />
}
