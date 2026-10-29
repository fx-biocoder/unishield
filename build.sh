#!/bin/bash
set -e

# Extract version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | head -1 | cut -d'"' -f4)

echo "Building UniShield v$VERSION..."
mkdir -p dist

# 1. Build Chrome / Chromium version (Standard MV3 service_worker)
echo "Packaging for Chrome / Chromium..."
zip -qr "dist/unishield_chrome_v$VERSION.zip" \
    manifest.json \
    LICENSE.md \
    PRIVACY_POLICY.md \
    *.html \
    *.js \
    assets/ \
    background/ \
    content/ \
    lib/ \
    options/ \
    popup/ \
    styles/ \
    -x "*.DS_Store" "*__pycache__*" "*.git*"

# 2. Build Firefox version (Injects background.scripts fallback for MV3 Gecko compatibility)
echo "Packaging for Firefox..."
cp manifest.json manifest.original.json

# Inject background.scripts: ["background/service_worker.js"], remove service_worker and ensure data_collection_permissions
python3 -c '
import json
with open("manifest.json", "r") as f:
    d = json.load(f)

# Firefox uses background.scripts, not service_worker
if "background" in d:
    d["background"].pop("service_worker", None)
    d["background"]["scripts"] = ["background/service_worker.js"]

# Ensure browser_specific_settings.gecko.data_collection_permissions
gecko = d.setdefault("browser_specific_settings", {}).setdefault("gecko", {})
gecko["id"] = "unishield@extension"
gecko["data_collection_permissions"] = { "required": ["none"] }

with open("manifest.json", "w") as f:
    json.dump(d, f, indent=2)
'

zip -qr "dist/unishield_firefox_v$VERSION.zip" \
    manifest.json \
    LICENSE.md \
    PRIVACY_POLICY.md \
    *.html \
    *.js \
    assets/ \
    background/ \
    content/ \
    lib/ \
    options/ \
    popup/ \
    styles/ \
    -x "*.DS_Store" "*__pycache__*" "*.git*"

# Restore original manifest
mv manifest.original.json manifest.json

echo "Build complete!"
echo "  dist/unishield_chrome_v$VERSION.zip"
echo "  dist/unishield_firefox_v$VERSION.zip"