/**
 * useAutoLocation
 *
 * Called once on app open (after the user is authenticated).
 * - Requests foreground location permission (asks once, remembers)
 * - Gets current GPS coordinates
 * - Sends them to POST /location/update (backend does Google Maps reverse geocode)
 * - Updates AuthContext profile with returned city / address / country
 */
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';

export function useAutoLocation() {
  const { token, updateProfile } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;

    const run = async () => {
      try {
        // ── Request permission ─────────────────────────────────────────────
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        // ── Get coordinates ────────────────────────────────────────────────
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;

        // ── Device fallback geocode (used if backend has no Google key) ────
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

        // ── POST to backend ────────────────────────────────────────────────
        const data = await apiFetch<{
          latitude: number;
          longitude: number;
          city: string | null;
          address: string | null;
          country: string | null;
        }>('/location/update', {
          method: 'POST',
          token,
          body: JSON.stringify({
            latitude,
            longitude,
            city:    fallbackCity,
            address: fallbackAddress,
            country: fallbackCountry,
          }),
        });

        updateProfile({
          latitude:  data.latitude,
          longitude: data.longitude,
          city:      data.city,
          address:   data.address,
          country:   data.country,
        });
      } catch {
        // Non-fatal — location is best-effort
      }
    };

    run();
  }, [token]);
}
