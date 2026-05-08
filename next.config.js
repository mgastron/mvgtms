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
      { source: "/envios/lista-precios", destination: "/pedidos/lista-precios", permanent: true },
      { source: "/reimprimir-noflex", destination: "/pedidos/reimpresion-etiquetas", permanent: true },
      { source: "/sistema/buscador-pedidos", destination: "/pedidos/buscador", permanent: true },

      // Cargar (paths viejos)
      { source: "/subir-individual", destination: "/pedidos/cargar/manual", permanent: true },
      { source: "/subir-envio", destination: "/pedidos/cargar/modelo", permanent: true },
      { source: "/subir-flex-manual", destination: "/pedidos/cargar/flex", permanent: true },

      // Sistema
      { source: "/usuarios", destination: "/sistema/usuarios", permanent: true },
      { source: "/lista-precios", destination: "/sistema/tarifas", permanent: true },

      // Vendedores
      { source: "/clientes", destination: "/vendedores", permanent: true },

      // Repartidores
      { source: "/ruteate/geochoferes", destination: "/repartidores/ubicacion", permanent: true },
      { source: "/ruteate/cierre", destination: "/repartidores/cierre", permanent: true },
      { source: "/chofer", destination: "/repartidor", permanent: true },
    ]
  },
}

module.exports = nextConfig

