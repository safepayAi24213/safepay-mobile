/**
 * Secure, persistent session storage backed by expo-secure-store (Keychain /
 * Keystore). Lets "Sign in with Face ID" restore a real session after the app
 * is closed.
 *
 * expo-secure-store is imported lazily inside each call so that merely importing
 * this module never touches the native side — keeps the app bootable even right
 * after the package is added to a running dev session.
 */

import type { UserDTO } from './api';

const SESSION_KEY = 'safepay.session.v1';
const BIO_KEY = 'safepay.biometric_enabled.v1';

export type StoredSession = { token: string; user: UserDTO };

async function store() {
  return import('expo-secure-store');
}

export async function saveSession(token: string, user: UserDTO): Promise<void> {
  try {
    const SecureStore = await store();
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ token, user }));
  } catch {
    // best-effort — persistence failing shouldn't break login
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const SecureStore = await store();
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    const SecureStore = await store();
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // ignore
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  try {
    const SecureStore = await store();
    if (enabled) await SecureStore.setItemAsync(BIO_KEY, '1');
    else await SecureStore.deleteItemAsync(BIO_KEY);
  } catch {
    // ignore
  }
}

export async function getBiometricEnabled(): Promise<boolean> {
  try {
    const SecureStore = await store();
    return (await SecureStore.getItemAsync(BIO_KEY)) === '1';
  } catch {
    return false;
  }
}
