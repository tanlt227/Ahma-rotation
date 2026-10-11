/**
 * lib/broadcast.ts
 *
 * Real-time broadcasting is handled by client-side polling (/api/state every 15s).
 * This module is intentionally a no-op — it exists so all api/* handlers can call
 * broadcastState() without needing to know whether a push channel is configured.
 */

import type { AppSyncState } from '../src/types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function broadcastState(_state: AppSyncState): Promise<void> {
  // Polling-based sync — nothing to push
}
