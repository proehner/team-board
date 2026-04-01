#!/usr/bin/env sh
# Generiert ein selbstsigniertes TLS-Zertifikat für localhost.
# Voraussetzung: OpenSSL muss installiert sein.
#
# Verwendung (aus dem Projekt-Root):
#   sh docker/scripts/generate-ssl.sh
#   sh docker/scripts/generate-ssl.sh mein-server.intern   # für alternativen Hostnamen

set -e

HOST="${1:-localhost}"
OUT_DIR="$(dirname "$0")/../nginx/ssl"

mkdir -p "$OUT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 \
  -days 3650 \
  -keyout "$OUT_DIR/key.pem" \
  -out    "$OUT_DIR/cert.pem" \
  -subj   "/CN=${HOST}" \
  -addext "subjectAltName=DNS:${HOST},IP:127.0.0.1"

echo ""
echo "Zertifikat erstellt:"
echo "  $OUT_DIR/cert.pem"
echo "  $OUT_DIR/key.pem"
echo ""
echo "Gültig bis: $(openssl x509 -noout -enddate -in "$OUT_DIR/cert.pem")"
