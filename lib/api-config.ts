// Configuración de la API del backend
// Detecta automáticamente si estamos en localhost o en el túnel

// ⚠️ IMPORTANTE: Si estás usando el túnel Cloudflare para el frontend,
// también necesitas exponer el backend. Configura la URL del backend aquí:
// Crea un archivo .env.local con: NEXT_PUBLIC_BACKEND_TUNNEL_URL=https://tu-backend-url.trycloudflare.com

export function getApiBaseUrl(): string {
  // Si estamos en el navegador
  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    
    // Leer la variable de entorno en tiempo de ejecución (importante para Next.js)
    const BACKEND_TUNNEL_URL = process.env.NEXT_PUBLIC_BACKEND_TUNNEL_URL || ''
    
    console.log('🔍 getApiBaseUrl - Origin:', origin)
    console.log('🔍 getApiBaseUrl - NEXT_PUBLIC_BACKEND_TUNNEL_URL:', BACKEND_TUNNEL_URL || '(no configurado)')
    
    // Si estamos en localhost, usar localhost:8080
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log('✅ Usando localhost:8080/api')
      return 'http://localhost:8080/api'
    }
    
    // URL del backend: variable de entorno o fallback según el origen
    const isProduction = origin.includes('mvgtms.com.ar')
    const baseFromEnv = BACKEND_TUNNEL_URL?.trim() || ''
    const resolvedBase = baseFromEnv || (isProduction ? 'https://api.mvgtms.com.ar' : '')

    if (resolvedBase) {
      let baseUrl = resolvedBase
      if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl
      } else if (baseUrl.endsWith('/')) {
        baseUrl = `${baseUrl}api`
      } else {
        baseUrl = `${baseUrl}/api`
      }
      console.log('✅ Usando backend:', baseUrl)
      return baseUrl
    }

    // Desarrollo (no localhost y sin túnel): pedir config
    console.error('⚠️ Backend no configurado. Origen:', origin)
    console.error('Configurá NEXT_PUBLIC_BACKEND_TUNNEL_URL en .env.local (desarrollo) o en Amplify (producción).')
    return 'http://localhost:8080/api'
  }
  
  // Fallback para SSR
  return 'http://localhost:8080/api'
}
