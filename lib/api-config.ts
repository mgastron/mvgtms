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
    
    // Si estamos en el túnel Cloudflare y tenemos configurada la URL del backend
    if (BACKEND_TUNNEL_URL && BACKEND_TUNNEL_URL.trim() !== '') {
      // Asegurarse de que la URL no termine con /api para evitar duplicación
      let baseUrl = BACKEND_TUNNEL_URL.trim()
      if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl
      } else if (baseUrl.endsWith('/')) {
        baseUrl = `${baseUrl}api`
      } else {
        baseUrl = `${baseUrl}/api`
      }
      console.log('✅ Usando túnel del backend:', baseUrl)
      return baseUrl
    }
    
    // Si estamos en el túnel pero no hay URL configurada, mostrar error más claro
    console.error('⚠️ ERROR: Backend no accesible desde el túnel.')
    console.error('Estás accediendo desde:', origin)
    console.error('Pero no hay NEXT_PUBLIC_BACKEND_TUNNEL_URL configurado.')
    console.error('')
    console.error('SOLUCIÓN:')
    console.error('1. Expone el backend con Cloudflare Tunnel:')
    console.error('   cloudflared tunnel --url http://localhost:8080')
    console.error('2. Crea/actualiza el archivo .env.local en la raíz del proyecto con:')
    console.error('   NEXT_PUBLIC_BACKEND_TUNNEL_URL=https://tu-backend-url.trycloudflare.com')
    console.error('3. Reinicia el servidor Next.js (npm run dev)')
    console.error('')
    console.error('⚠️ Intentando usar localhost (probablemente fallará desde otra red)...')
    
    // Intentar usar localhost (fallará desde fuera, pero al menos no romperá el código)
    return 'http://localhost:8080/api'
  }
  
  // Fallback para SSR
  return 'http://localhost:8080/api'
}
