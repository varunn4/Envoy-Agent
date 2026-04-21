import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySocket = Socket | any;

let socketInstance: AnySocket | null = null;

export function getSocket(): AnySocket {
  if (socketInstance) return socketInstance;

  socketInstance = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });

  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect?.();
    socketInstance = null;
  }
}
