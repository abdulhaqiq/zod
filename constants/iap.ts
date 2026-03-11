/**
 * In-App Purchase / RevenueCat configuration.
 *
 * Setup checklist:
 * 1. Create a RevenueCat account → revenuecat.com
 * 2. Add your iOS app and link your App Store Connect account
 * 3. Create an Entitlement called "pro"
 * 4. Create two Subscription products in App Store Connect:
 *      com.zodapp.pro.monthly  — $14.99/month
 *      com.zodapp.pro.yearly   — $95.88/year  ($7.99/mo)
 * 5. Add those products to a RevenueCat Offering called "default"
 * 6. Replace REVENUECAT_API_KEY below with your iOS public key (appl_...)
 * 7. Add REVENUECAT_SECRET_KEY + REVENUECAT_WEBHOOK_AUTH to backend/.env
 * 8. Set webhook URL in RevenueCat → Integrations → Webhooks:
 *      https://YOUR_API_DOMAIN/api/v1/subscription/webhook
 */

// Must match what you created in App Store Connect & RevenueCat
export const PRODUCT_IDS = {
  monthly: 'com.zod.ai.pro.monthly',
  yearly:  'com.zod.ai.pro.yearly',
} as const;

// RevenueCat Offering & Entitlement identifiers
export const RC_OFFERING    = 'default';
export const RC_ENTITLEMENT = 'pro';
