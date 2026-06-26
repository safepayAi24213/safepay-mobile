import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { loadSession } from '@/lib/session-store';

export default function Index() {
  // Returning users (with a saved session) skip onboarding and go straight to
  // the login screen, which auto-prompts Face ID. New users see onboarding.
  const [returning, setReturning] = useState<boolean | null>(null);

  useEffect(() => {
    loadSession().then((s) => setReturning(!!s));
  }, []);

  if (returning === null) return null; // brief check; splash stays visible
  return <Redirect href={returning ? '/(auth)/login' : '/onboarding'} />;
}
