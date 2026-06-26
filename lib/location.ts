import * as Location from 'expo-location';

export type Coords = { latitude: number; longitude: number };

// A couple of named points so the demo toggle can simulate "far away".
export const KIGALI: Coords = { latitude: -1.9596, longitude: 30.0586 };
export const NAIROBI: Coords = { latitude: -1.2864, longitude: 36.8172 };

/**
 * Demo override. When set, getCurrentCoords() returns this instead of the real
 * device location — lets you demonstrate the location-mismatch fraud signal
 * without physically travelling. Toggled from the Profile screen.
 */
let demoOverride: Coords | null = null;

export function setDemoLocation(coords: Coords | null): void {
  demoOverride = coords;
}

export function getDemoLocation(): Coords | null {
  return demoOverride;
}

/**
 * Best-effort current location. Requests permission the first time; returns
 * null if denied or unavailable (the transaction still goes through — location
 * is an optional context signal, never a hard gate).
 */
export async function getCurrentCoords(): Promise<Coords | null> {
  if (demoOverride) return demoOverride;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}
