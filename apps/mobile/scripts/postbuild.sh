#!/bin/bash
# Post-build script for Vercel deployment
# Copies overview page assets and injects PWA meta tags into index.html

set -e

# Copy overview page
mkdir -p dist/overview/assets
cp -r overview dist/
cp assets/icon.png dist/overview/assets/

# Inject Apple PWA meta tags + manifest link into static HTML
# Safari reads these at "Add to Home Screen" time, before JS executes
sed -i 's|</head>|<link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="theme-color" content="#7C003A"></head>|' dist/index.html
