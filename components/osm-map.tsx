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
  const markersRef = useRef(markers)
  const centerRef = useRef(center)
  const zoomRef = useRef(zoom)
  markersRef.current = markers
  centerRef.current = center
  zoomRef.current = zoom

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      if (!containerRef.current) return
      try {
        const L = await loadLeaflet()
        if (cancelled || !containerRef.current) return
        leafletRef.current = L

        const currentMarkers = markersRef.current
        const currentCenter = centerRef.current
        const startCenter = currentCenter || (currentMarkers[0] ? { lat: currentMarkers[0].lat, lng: currentMarkers[0].lng } : DEFAULT_CENTER)
        const map = L.map(containerRef.current, {
          center: [startCenter.lat, startCenter.lng],
          zoom: currentMarkers.length === 1 ? Math.max(zoomRef.current, 15) : zoomRef.current,
        })
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map)
        mapRef.current = map
        layerRef.current = L.layerGroup().addTo(map)
        mapRefOut?.({
          setView: (lat, lng, z) => map.setView([lat, lng], z ?? 15),
        })
        renderMarkers(L, map)
        setTimeout(() => map.invalidateSize(), 80)
      } catch {
        // el contenedor queda vacío; el caller muestra el aviso
      }
    }

    start()
    return () => {
      cancelled = true
      mapRefOut?.(null)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return
    renderMarkers(L, map)
  }, [markers, center, zoom])

  function renderMarkers(L: any, map: any) {
    if (layerRef.current) {
      layerRef.current.clearLayers()
    } else {
      layerRef.current = L.layerGroup().addTo(map)
    }
    const list = markersRef.current
    const currentCenter = centerRef.current
    const currentZoom = zoomRef.current
    const bounds: any[] = []
    list.forEach((m, index) => {
      if (m.lat == null || m.lng == null) return
      const marker = L.circleMarker([m.lat, m.lng], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: m.color || "#1570ef",
        fillOpacity: 1,
      })
      if (m.popup || m.title) {
        marker.bindPopup(`<strong>${m.title || ""}</strong>${m.popup ? `<br/>${m.popup}` : ""}`)
      }
      if (onMarkerClick) {
        marker.on("click", () => onMarkerClick(index))
      }
      marker.addTo(layerRef.current)
      bounds.push([m.lat, m.lng])
    })
    if (currentCenter) {
      map.setView([currentCenter.lat, currentCenter.lng], list.length <= 1 ? Math.max(currentZoom, 15) : map.getZoom())
    } else if (bounds.length === 1) {
      map.setView(bounds[0], Math.max(currentZoom, 15))
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
    setTimeout(() => map.invalidateSize(), 50)
  }

  return <div ref={containerRef} className={className || "h-full w-full"} />
}
