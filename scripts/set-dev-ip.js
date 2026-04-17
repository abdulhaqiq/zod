#!/usr/bin/env node
/**
 * Detects the current local network IP and writes it to .env.local so that
 * EXPO_PUBLIC_DEV_API_URL always points at the right backend — no manual
 * edits needed when switching WiFi networks or hotspots.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getLocalIP() {
  const attempts = [
    // macOS: active WiFi adapter
    () => execSync('ipconfig getifaddr en0', { stdio: 'pipe' }).toString().trim(),
    // macOS: Ethernet
    () => execSync('ipconfig getifaddr en1', { stdio: 'pipe' }).toString().trim(),
    // macOS: any interface
    () =>
      execSync("ifconfig | grep 'inet ' | grep -v '127\\.' | awk '{print $2}' | head -1", { stdio: 'pipe' })
        .toString()
        .trim(),
  ];

  for (const attempt of attempts) {
    try {
      const ip = attempt();
      if (ip && ip !== '127.0.0.1' && ip !== 'localhost') return ip;
    } catch {}
  }
  return null;
}

const ip = getLocalIP();
const envPath = path.join(__dirname, '..', '.env.local');

if (!ip) {
  console.warn('[set-dev-ip] Could not detect local IP — keeping existing .env.local');
  process.exit(0);
}

const content = `EXPO_PUBLIC_DEV_API_URL=http://${ip}:8000\n`;

// Only write if the IP actually changed (avoids triggering Metro reload)
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
if (existing.trim() !== content.trim()) {
  fs.writeFileSync(envPath, content, 'utf8');
  console.log(`[set-dev-ip] Updated .env.local → ${ip}`);
} else {
  console.log(`[set-dev-ip] IP unchanged: ${ip}`);
}
