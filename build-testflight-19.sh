#!/bin/bash
# Build and submit version 1.0.6 (build 19) to TestFlight

echo "🚀 Building Zod v1.0.6 (build 19) for TestFlight..."
echo ""

# Build and auto-submit
npx eas-cli build \
    --platform ios \
    --profile production \
    --auto-submit \
    --non-interactive \
    --message "Build 19 - v1.0.6"

echo ""
echo "✅ Build submitted!"
echo ""
echo "Track at: https://expo.dev/accounts/abdulkumshey/projects/zod"
