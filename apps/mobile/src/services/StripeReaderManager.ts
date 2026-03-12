import {
  useStripeTerminal,
  type Reader,
} from '@stripe/stripe-react-native';

let _connectedReader: Reader.Type | null = null;

export function getConnectedReader(): Reader.Type | null {
  return _connectedReader;
}

// These functions are designed to be called from a component that has the
// StripeTerminalProvider context. Export them as plain async functions that
// delegate to the hook results stored in module state.

let _discoverReadersFn: (() => Promise<{ readers: Reader.Type[]; error?: unknown }>) | null = null;
let _connectReaderFn: ((reader: Reader.Type) => Promise<{ reader?: Reader.Type; error?: unknown }>) | null = null;
let _disconnectReaderFn: (() => Promise<void>) | null = null;

export function registerTerminalHooks(hooks: {
  discoverReaders: () => Promise<{ readers: Reader.Type[]; error?: unknown }>;
  connectReader: (reader: Reader.Type) => Promise<{ reader?: Reader.Type; error?: unknown }>;
  disconnectReader: () => Promise<void>;
}): void {
  _discoverReadersFn = hooks.discoverReaders;
  _connectReaderFn = hooks.connectReader;
  _disconnectReaderFn = hooks.disconnectReader;
}

export async function discoverReaders(): Promise<Reader.Type[]> {
  if (!_discoverReadersFn) throw new Error('Terminal hooks not registered');
  const result = await _discoverReadersFn();
  return result.readers;
}

export async function connectReader(readerId: string): Promise<Reader.Type> {
  if (!_connectReaderFn) throw new Error('Terminal hooks not registered');
  const readers = await discoverReaders();
  const reader = readers.find((r) => r.serialNumber === readerId);
  if (!reader) throw new Error(`Reader ${readerId} not found`);
  const result = await _connectReaderFn(reader);
  if (result.error) throw new Error(String(result.error));
  _connectedReader = result.reader ?? null;
  return result.reader!;
}

export async function disconnectReader(): Promise<void> {
  if (!_disconnectReaderFn) throw new Error('Terminal hooks not registered');
  await _disconnectReaderFn();
  _connectedReader = null;
}
