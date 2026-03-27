#!/bin/sh

set -eu

REPO="${ACORN_INSTALL_REPO:-SzymonKostrubiec/Acorn-FileManager}"
INSTALL_DIR="${ACORN_INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"

case "$os" in
  linux)
    platform="linux"
    ;;
  darwin)
    platform="darwin"
    ;;
  *)
    echo "Unsupported OS: $os" >&2
    exit 1
    ;;
esac

case "$arch" in
  x86_64|amd64)
    target_arch="x64"
    ;;
  arm64|aarch64)
    target_arch="arm64"
    ;;
  *)
    echo "Unsupported architecture: $arch" >&2
    exit 1
    ;;
esac

asset="acorn-${platform}-${target_arch}"
url="https://github.com/${REPO}/releases/latest/download/${asset}"

mkdir -p "$INSTALL_DIR"
tmp_file="$(mktemp)"

cleanup() {
  rm -f "$tmp_file"
}

trap cleanup EXIT INT TERM

echo "Downloading ${url}"
curl -fsSL "$url" -o "$tmp_file"
chmod +x "$tmp_file"
mv "$tmp_file" "$INSTALL_DIR/acorn"

echo "Installed to $INSTALL_DIR/acorn"
echo "Run: $INSTALL_DIR/acorn help"
