// Configuración de la API del backend
// Detecta automáticamente si estamos en localhost o en el túnel
// En producción no se loguea nada para no exponer URLs ni variables de entorno.

import { logDev, errorDev } from "./logger"

// ⚠️ IMPORTANTE: Si estás usando el túnel Cloudflare para el frontend,
// también necesitas exponer el backend. Configura la URL del backend aquí:
// Crea un archivo .env.local con: NEXT_PUBLIC_BACKEND_TUNNEL_URL=https://tu-backend-url.trycloudflare.com

export function getApiBaseUrl(): string {
  // Si estamos en el navegador
  if (typeof window !== "undefined") {
    const origin = window.location.origin
    const BACKEND_TUNNEL_URL = process.env.NEXT_PUBLIC_BACKEND_TUNNEL_URL || ""

    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      logDev("Usando localhost:8080/api")
      return "http://localhost:8080/api"
    }

    const isProduction = origin.includes("mvgtms.com.ar")
    const baseFromEnv = BACKEND_TUNNEL_URL?.trim() || ""
    const resolvedBase = baseFromEnv || (isProduction ? "https://api.mvgtms.com.ar" : "")

    if (resolvedBase) {
      let baseUrl = resolvedBase
      if (baseUrl.endsWith("/api")) {
        // ya tiene /api
      } else if (baseUrl.endsWith("/")) {
        baseUrl = `${baseUrl}api`
      } else {
        baseUrl = `${baseUrl}/api`
      }
      logDev("Usando backend:", baseUrl)
      return baseUrl
    }

    errorDev("Backend no configurado. Configurá NEXT_PUBLIC_BACKEND_TUNNEL_URL en .env.local o Amplify.")
    return "http://localhost:8080/api"
  }

  return "http://localhost:8080/api"
}
