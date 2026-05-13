#!/bin/bash
# Build and submit to TestFlight automatically

echo "🚀 Building Zod for TestFlight..."
echo ""

# Check if logged in to EAS
echo "Checking EAS login status..."
npx eas-cli whoami || {
    echo "❌ Not logged in to EAS. Please run: npx eas-cli login"
    exit 1
}

echo ""
echo "✅ Logged in to EAS"
echo ""
echo "Starting build + auto-submit to TestFlight..."
echo "This will take 10-20 minutes. You'll get an email when it's ready."
echo ""

# Build and auto-submit
npx eas-cli build \
    --platform ios \
    --profile production \
    --auto-submit \
    --non-interactive

echo ""
echo "✅ Build submitted to TestFlight!"
echo ""
echo "Next steps:"
echo "1. Wait for email confirmation (10-20 mins)"
echo "2. Go to App Store Connect → TestFlight"
echo "3. Add testers or enable public link"
echo ""
