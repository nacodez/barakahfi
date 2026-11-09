'use client';

import { useQueryClient } from '@tanstack/react-query';
import { REALTIME_EVENTS, type ComplianceAlertDto } from '@barakahfi/shared';
import { X } from 'lucide-react';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { STATUS_LABEL } from '@/components/compliance-badge';
import { useWebSocket, type SocketStatus } from '@/hooks/use-websocket';

interface RealtimeValue {
  status: SocketStatus;
  alerts: ComplianceAlertDto[];
  dismiss: (at: string) => void;
}

const RealtimeContext = createContext<RealtimeValue>({
  status: 'idle',
  alerts: [],
  dismiss: () => undefined,
});

/** Live connection status and alerts for pages that care. Safe to call outside the provider. */
export const useRealtime = () => useContext(RealtimeContext);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [alerts, setAlerts] = useState<ComplianceAlertDto[]>([]);

  const status = useWebSocket(true, {
    // The server already recomputed values; just refetch what changed instead of patching by hand.
    [REALTIME_EVENTS.prices]: () => {
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['zakat'] });
    },
    [REALTIME_EVENTS.alerts]: (payload) => {
      setAlerts((prev) => [payload as ComplianceAlertDto, ...prev].slice(0, 5));
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['screener'] });
    },
  });

  const value = useMemo<RealtimeValue>(
    () => ({
      status,
      alerts,
      dismiss: (at) => setAlerts((prev) => prev.filter((a) => a.at !== at)),
    }),
    [status, alerts],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-20 left-4 z-40 flex flex-col items-end gap-2 md:bottom-4"
      >
        {alerts.map((a) => (
          <div
            key={a.at}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          >
            <p className="flex-1">
              <strong>{a.symbol}</strong> changed from {STATUS_LABEL[a.from].toLowerCase()} to{' '}
              <strong>{STATUS_LABEL[a.to].toLowerCase()}</strong>. Review your holding.
            </p>
            <button
              type="button"
              onClick={() => value.dismiss(a.at)}
              aria-label={`Dismiss alert for ${a.symbol}`}
              className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </RealtimeContext.Provider>
  );
}
