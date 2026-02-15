#!/bin/bash

# Script para iniciar un túnel HTTPS para desarrollo local
# Opciones: ngrok, cloudflare, localtunnel

TUNNEL_TYPE=${1:-ngrok}
PORT=${2:-3000}

echo "🚀 Iniciando túnel HTTPS para desarrollo local..."
echo "Tipo: $TUNNEL_TYPE"
echo "Puerto: $PORT"
echo ""

case $TUNNEL_TYPE in
  ngrok)
    if ! command -v ngrok &> /dev/null; then
      echo "❌ ngrok no está instalado."
      echo "Instala con: brew install ngrok"
      echo "O descarga desde: https://ngrok.com/download"
      exit 1
    fi
    echo "✅ Iniciando ngrok en puerto $PORT..."
    echo "📋 Copia la URL HTTPS que aparece (ejemplo: https://abc123.ngrok-free.app)"
    echo "📋 Úsala en MercadoLibre Developers como Redirect URI"
    echo ""
    ngrok http $PORT
    ;;
  
  cloudflare)
    if ! command -v cloudflared &> /dev/null; then
      echo "❌ cloudflared no está instalado."
      echo "Instala con: brew install cloudflared"
      exit 1
    fi
    echo "✅ Iniciando Cloudflare Tunnel en puerto $PORT..."
    echo "📋 Copia la URL HTTPS que aparece (ejemplo: https://abc123.trycloudflare.com)"
    echo "📋 Úsala en MercadoLibre Developers como Redirect URI"
    echo ""
    cloudflared tunnel --url http://localhost:$PORT
    ;;
  
  localtunnel)
    if ! command -v lt &> /dev/null; then
      echo "❌ localtunnel no está instalado."
      echo "Instala con: npm install -g localtunnel"
      exit 1
    fi
    echo "✅ Iniciando localtunnel en puerto $PORT..."
    echo "📋 Copia la URL HTTPS que aparece (ejemplo: https://abc123.loca.lt)"
    echo "📋 Úsala en MercadoLibre Developers como Redirect URI"
    echo ""
    lt --port $PORT
    ;;
  
  *)
    echo "❌ Tipo de túnel no reconocido: $TUNNEL_TYPE"
    echo "Opciones disponibles: ngrok, cloudflare, localtunnel"
    echo ""
    echo "Uso: ./start-tunnel.sh [tipo] [puerto]"
    echo "Ejemplo: ./start-tunnel.sh ngrok 3000"
    exit 1
    ;;
esac
