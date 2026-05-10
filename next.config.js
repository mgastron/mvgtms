/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suprimir warnings de hidratación causados por extensiones del navegador
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  async redirects() {
    return [
      // Pedidos
      { source: "/envios", destination: "/pedidos", permanent: true },
      { source: "/envios/subida", destination: "/pedidos/cargar", permanent: true },
      { source: "/envios/lista-precios", destination: "/utilidades/lista-precios", permanent: true },
      { source: "/reimprimir-noflex", destination: "/pedidos/reimpresion-etiquetas", permanent: true },
      { source: "/sistema/buscador-pedidos", destination: "/utilidades/buscador", permanent: true },
      { source: "/pedidos/buscador", destination: "/utilidades/buscador", permanent: true },
      { source: "/pedidos/lista-precios", destination: "/utilidades/lista-precios", permanent: true },

      // Cargar (paths viejos)
      { source: "/subir-individual", destination: "/pedidos/cargar/manual", permanent: true },
      { source: "/subir-envio", destination: "/pedidos/cargar/modelo", permanent: true },
      { source: "/subir-flex-manual", destination: "/pedidos/cargar/flex", permanent: true },

      // Rutas antiguas /sistema/* y /vendedores → nuevas URLs
      { source: "/sistema/usuarios", destination: "/configuracion/usuarios", permanent: true },
      { source: "/sistema/grupos", destination: "/configuracion/grupos", permanent: true },
      { source: "/sistema/informes", destination: "/administracion/informes", permanent: true },
      { source: "/sistema/tarifas", destination: "/administracion/tarifa", permanent: true },
      { source: "/sistema/estado-ordenes", destination: "/administracion/estado-ordenes", permanent: true },
      { source: "/vendedores", destination: "/configuracion/vendedores", permanent: true },

      // Atajos legacy
      { source: "/usuarios", destination: "/configuracion/usuarios", permanent: true },
      { source: "/lista-precios", destination: "/administracion/tarifa", permanent: true },
      { source: "/clientes", destination: "/configuracion/vendedores", permanent: true },

      // Repartidores
      { source: "/ruteate/geochoferes", destination: "/repartidores/ubicacion", permanent: true },
      { source: "/ruteate/cierre", destination: "/repartidores/cierre", permanent: true },
      { source: "/chofer", destination: "/repartidor", permanent: true },
    ]
  },
}

module.exports = nextConfig

