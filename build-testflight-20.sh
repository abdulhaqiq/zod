#!/bin/bash
echo "🚀 Building Zod v1.0.7 (build 20) - Face verification crash fix..."
echo ""

npx eas-cli build \
    --platform ios \
    --profile production \
    --auto-submit \
    --non-interactive \
    --message "Build 20 - Face verification memory fix"

echo ""
echo "✅ Build submitted!"
echo "Track at: https://expo.dev/accounts/abdulkumshey/projects/zod"
