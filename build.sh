#!/bin/bash
# Build script for Roam Depot GitHub Action
# This script is called by Roam's CI to build the extension

set -e

# Install dependencies
npx pnpm install

# Build the extension (outputs extension.js to project root)
npx pnpm build

echo "Build complete: extension.js"

