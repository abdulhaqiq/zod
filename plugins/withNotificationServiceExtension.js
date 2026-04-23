/**
 * Expo config plugin — adds a Notification Service Extension target to the
 * Xcode project so iOS can download and attach the sender's photo to push
 * notifications before they are displayed.
 *
 * The Swift source lives at ios/NotificationService/NotificationService.swift
 */
const { withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const EXTENSION_NAME       = 'NotificationService';
const EXTENSION_BUNDLE_ID  = 'com.zod.ai.NotificationService';
const SWIFT_FILE           = 'NotificationService.swift';
const DEPLOYMENT_TARGET    = '16.0';

module.exports = function withNotificationServiceExtension(config) {
  return withXcodeProject(config, async (cfg) => {
    const xcodeProject = cfg.modResults;
    const projectRoot  = cfg.modRequest.projectRoot;
    const iosDir       = path.join(projectRoot, 'ios');
    const extDir       = path.join(iosDir, EXTENSION_NAME);
    const swiftSrc     = path.join(extDir, SWIFT_FILE);

    // Ensure the Swift source file exists (written manually)
    if (!fs.existsSync(swiftSrc)) {
      console.warn(`[withNotificationServiceExtension] Swift file not found at ${swiftSrc} — skipping`);
      return cfg;
    }

    // Avoid adding the target twice on repeated prebuild runs
    const existingTargets = xcodeProject.pbxNativeTargetSection();
    const alreadyAdded = Object.values(existingTargets)
      .some(t => t && t.name === EXTENSION_NAME);
    if (alreadyAdded) return cfg;

    // ── Add the extension target ─────────────────────────────────────────────
    const target = xcodeProject.addTarget(
      EXTENSION_NAME,
      'app_extension',
      EXTENSION_NAME,
      EXTENSION_BUNDLE_ID,
    );

    // ── Create a group for the extension source files ────────────────────────
    xcodeProject.addPbxGroup(
      [SWIFT_FILE],
      EXTENSION_NAME,
      EXTENSION_NAME,
    );

    // ── Add the Swift source file to the target's Compile Sources phase ──────
    xcodeProject.addSourceFile(
      `${EXTENSION_NAME}/${SWIFT_FILE}`,
      { target: target.uuid },
    );

    // ── Build settings ───────────────────────────────────────────────────────
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const conf = configurations[key];
      if (!conf || !conf.buildSettings) continue;
      if (conf.buildSettings.PRODUCT_NAME !== `"${EXTENSION_NAME}"` &&
          conf.buildSettings.PRODUCT_NAME !== EXTENSION_NAME) continue;

      Object.assign(conf.buildSettings, {
        ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES: 'NO',
        CODE_SIGN_ENTITLEMENTS:                '',
        DEPLOYMENT_TARGET_SETTING_NAME:        'IPHONEOS_DEPLOYMENT_TARGET',
        IPHONEOS_DEPLOYMENT_TARGET:            DEPLOYMENT_TARGET,
        PRODUCT_BUNDLE_IDENTIFIER:             `"${EXTENSION_BUNDLE_ID}"`,
        SWIFT_VERSION:                         '5.0',
        TARGETED_DEVICE_FAMILY:                '"1,2"',
      });
    }

    return cfg;
  });
};
