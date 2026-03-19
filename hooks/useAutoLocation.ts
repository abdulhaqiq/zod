/**
 * useAutoLocation
 *
 * Called once on app open (after the user is authenticated).
 * - Requests foreground location permission (asks once, remembers)
 * - Gets current GPS coordinates
 * - Sends them to POST /location/update (backend does Google Maps reverse geocode)
 * - Updates AuthContext profile with returned city / address / country
 *
 * Skipped when travel_mode_enabled — the manually set city persists until
 * the user explicitly changes or disables it.
 */
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

/**
 * Standalone helper: get real GPS and push to /location/update.
 * Call this explicitly when travel mode is turned off so real location
 * is restored immediately.
 */
export async function restoreRealLocation(
  token: string,
  updateProfile: (patch: any) => void,
) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = loc.coords;

    let fallbackCity: string | null = null;
    let fallbackAddress: string | null = null;
    let fallbackCountry: string | null = null;
    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geo) {
        fallbackCity    = geo.city ?? geo.subregion ?? geo.region ?? null;
        fallbackCountry = geo.country ?? null;
        const parts = [geo.streetNumber, geo.street, geo.city, geo.region, geo.country].filter(Boolean);
        fallbackAddress = parts.join(', ') || null;
      }
    } catch { /* ignore */ }

    const data = await apiFetch<{
      city: string | null; address: string | null; country: string | null;
    }>('/location/update', {
      method: 'POST', token,
      body: JSON.stringify({ latitude, longitude, city: fallbackCity, address: fallbackAddress, country: fallbackCountry }),
    });

    updateProfile({
      city:      data.city,
      address:   data.address,
      country:   data.country,
      travel_mode_enabled: false,
      travel_city:    null,
      travel_country: null,
    });
  } catch { /* non-fatal */ }
}

export function useAutoLocation() {
  const { token, profile, updateProfile } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;

    const run = async () => {
      try {
        // Travel city is preserved until the user explicitly changes or disables it
        if (profile?.travel_mode_enabled) return;

        await restoreRealLocation(token, updateProfile);
      } catch {
        // Non-fatal — location is best-effort
      }
    };

    run();
  }, [token]);
}
