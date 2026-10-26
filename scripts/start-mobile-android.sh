#!/usr/bin/env bash
# Arranca Expo para Android en la misma WiFi (USB opcional).
# Ejecutar en una terminal INTERACTIVA (Terminal.app o terminal de Cursor).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/mobile"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [[ -z "${IP}" ]]; then
  echo "ERROR: no pude obtener la IP WiFi de la Mac (en0/en1)."
  echo "Conectá la Mac al WiFi e intentá de nuevo."
  exit 1
fi

PORT=8083
TENANT="${TENANT:-${EXPO_PUBLIC_TENANT:-nexo}}"
if [[ "${USE_PROD_API:-0}" == "1" ]]; then
  API_URL="https://api.isnexo.net/api"
else
  API_URL="http://${IP}:8082/api"
fi
EXPO_URL="exp://${IP}:${PORT}"

echo "==> IP Mac (WiFi): $IP"
echo "==> API:  $API_URL"
echo "==> Tenant: ${TENANT}"
echo "==> Expo: $EXPO_URL"
echo "==> Celular y Mac deben estar en la MISMA red WiFi."
echo ""

cat > .env <<EOF
EXPO_PUBLIC_API_URL=${API_URL}
EXPO_PUBLIC_TENANT=${TENANT}
EOF
echo "==> .env:"
cat .env
echo ""

HAVE_DEVICE=0
if command -v adb >/dev/null 2>&1; then
  adb start-server >/dev/null 2>&1 || true
  echo "==> Dispositivos adb:"
  adb devices -l
  if adb devices | awk '/\tdevice$/{found=1} END{exit !found}'; then
    HAVE_DEVICE=1
    echo "==> USB OK: adb reverse Metro ($PORT)..."
    adb reverse "tcp:${PORT}" "tcp:${PORT}" >/dev/null 2>&1 || true
    adb reverse --list || true
  else
    echo "==> Sin USB: modo solo WiFi (está bien)."
  fi
fi

echo ""
echo "============================================================"
echo "  EN EL TELÉFONO (cuando Metro diga Waiting/Metro waiting):"
echo "  1) Expo Go → Enter URL"
echo "  2) Pegá:  ${EXPO_URL}"
echo "  3) Login: andrestorres / pass456"
echo ""
echo "  Si Expo pregunta login de cuenta → 'Proceed anonymously'"
echo "  Si pregunta actualizar Expo Go → NO / Decline"
echo "============================================================"
echo ""

# Liberar el puerto si quedó algo zombie
if lsof -tiTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "==> Liberando puerto ${PORT}..."
  kill $(lsof -tiTCP:"${PORT}" -sTCP:LISTEN) 2>/dev/null || true
  sleep 1
fi

# Abrir en el teléfono un poco después (en background), sin usar `expo -a`
# (eso intenta reinstalar Expo Go y rompe todo)
if [[ "$HAVE_DEVICE" -eq 1 ]]; then
  (
    sleep 8
    adb shell am force-stop host.exp.exponent >/dev/null 2>&1 || true
    adb shell am start -a android.intent.action.VIEW -d "${EXPO_URL}" host.exp.exponent >/dev/null 2>&1 || true
    echo "==> Intenté abrir ${EXPO_URL} en el teléfono"
  ) &
fi

echo "==> Iniciando Metro. Dejá ESTA terminal abierta."
echo ""

# SIN CI=1 (rompe con pedido de EXPO_TOKEN)
# --lan: el celular llega por WiFi a 192.168.x.x:8083
export EXPO_NO_TELEMETRY=1
exec npx expo start --lan --port "${PORT}"
