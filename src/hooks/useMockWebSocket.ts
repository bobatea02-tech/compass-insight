// Deprecated — kept as a stub for backward compatibility. Use useWebSocket.
import { useCallback, useState } from 'react';
import type { WsMessage } from '@/types/compass';

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export function useMockWebSocket(_onMessage: (msg: WsMessage) => void) {
  const [status] = useState<ConnStatus>('idle');
  const connect = useCallback(() => {}, []);
  const close = useCallback(() => {}, []);
  return { status, connect, close };
}
