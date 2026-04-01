/**
 * In-App Purchase / RevenueCat configuration.
 *
 * Setup checklist:
 * 1. Create a RevenueCat account → revenuecat.com
 * 2. Add your iOS app (bundle: com.zod.ai) and link App Store Connect
 * 3. Create an Entitlement called "pro"
 * 4. Products already created in App Store Connect:
 *      0283238jadfak1   — Pro Weekly    $4.99/week
 *      293423874982734  — Pro Monthly   $14.99/month
 *      028399823293     — Pro 3 Months  $34.99/3 months
 * 5. In RevenueCat: add those products to an Offering called "default"
 *    with packages: $rc_weekly, $rc_monthly, $rc_three_month
 * 6. Get your iOS public key (appl_...) → add to backend .env as REVENUECAT_PUBLIC_KEY
 * 7. Add REVENUECAT_SECRET_KEY + REVENUECAT_WEBHOOK_AUTH to backend/.env
 * 8. Set webhook URL in RevenueCat → Integrations → Webhooks:
 *      https://dev.zod.ailoo.co/api/v1/subscription/webhook
 */

// Must match what you created in App Store Connect & RevenueCat
export const PRODUCT_IDS = {
  // Pro — "default" offering
  pro_weekly:      '928392834923',
  pro_monthly:     '293423874982734',
  pro_threemonths: '028399823293',
  // Premium+ — "premium" offering
  premium_weekly:      '2038923892',
  premium_monthly:     '823823023',
  premium_threemonths: '289392323',
} as const;

/**
 * AI Credits — consumable one-time purchases.
 * Create these as Consumable (Non-Subscription) products in App Store Connect,
 * then add them to RevenueCat under the same app.
 *   com.zod.ai.credits.10  — $0.99  →  10 AI Credits
 *   com.zod.ai.credits.25  — $1.99  →  25 AI Credits
 *   com.zod.ai.credits.50  — $3.99  →  50 AI Credits
 */
export const AI_CREDIT_PACKS = [
  { id: 'com.zod.ai.credits.10', credits: 10, price: '$0.99', label: '10 Credits' },
  { id: 'com.zod.ai.credits.25', credits: 25, price: '$1.99', label: '25 Credits', badge: 'Popular' },
  { id: 'com.zod.ai.credits.50', credits: 50, price: '$3.99', label: '50 Credits', badge: 'Best Value' },
] as const;

export type AiCreditPack = (typeof AI_CREDIT_PACKS)[number];

// RevenueCat Offering & Entitlement identifiers
export const RC_OFFERING          = 'default';   // Pro plans
export const RC_PREMIUM_OFFERING  = 'premium';   // Premium+ plans
export const RC_ENTITLEMENT       = 'pro';
export const RC_PREMIUM_ENTITLEMENT = 'premium';
