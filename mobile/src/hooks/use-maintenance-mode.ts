import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { env } from '@/lib/env';

export function useMaintenanceMode() {
  const [maintenance, setMaintenance] = useState(false);
  const [checking, setChecking] = useState(false);
  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch(`${env.webUrl}/api/maintenance?ts=${Date.now()}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json() as { maintenanceMode?: unknown };
      setMaintenance(data.maintenanceMode === true);
    } catch {
      // A maintenance endpoint outage must not lock users out of cached data.
    } finally { setChecking(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [refresh]);
  return { maintenance, checking, refresh };
}
