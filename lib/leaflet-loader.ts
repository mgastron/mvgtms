let loading: Promise<any> | null = null

export function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet solo corre en el browser"))
  }
  const w = window as any
  if (w.L) return Promise.resolve(w.L)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const cssHref = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    if (!document.querySelector(`link[href="${cssHref}"]`)) {
      const css = document.createElement("link")
      css.rel = "stylesheet"
      css.href = cssHref
      document.head.appendChild(css)
    }

    const script = document.createElement("script")
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.onload = () => {
      const L = (window as any).L
      if (!L) {
        reject(new Error("Leaflet no cargó"))
        return
      }
      try {
        delete L.Icon.Default.prototype._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        })
      } catch {
        // ignore
      }
      resolve(L)
    }
    script.onerror = () => reject(new Error("No se pudo cargar Leaflet"))
    document.head.appendChild(script)
  })

  return loading
}
