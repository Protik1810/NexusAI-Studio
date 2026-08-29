#!/usr/bin/env bash
set -e

echo "✨ Installing NexusAI Studio..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install Node.js (v18+) and try again."
    exit 1
fi

# Check Git
if ! command -v git &> /dev/null; then
    echo "❌ Git is required. Please install Git and try again."
    exit 1
fi

INSTALL_DIR="${HOME}/.nexusai-studio"

if [ -d "$INSTALL_DIR" ]; then
    echo "🔄 Updating existing installation in $INSTALL_DIR..."
    cd "$INSTALL_DIR"
    git pull origin main
else
    echo "📥 Cloning NexusAI Studio into $INSTALL_DIR..."
    git clone https://github.com/Protik1810/NexusAI-Studio.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo "📦 Installing dependencies..."
npm install

echo "🚀 Starting NexusAI Studio..."
npm run dev
