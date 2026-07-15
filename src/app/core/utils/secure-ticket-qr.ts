const QR_PATTERN = /^ALCON-TICKET:v1:([A-Za-z0-9_-]{32,96})$/;
const QR_PREFIX = 'ALCON-TICKET:v1:';

const toBase64Url = (bytes: Uint8Array): string => {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const createSecureTicketQr = (): string => {
  const bytes = new Uint8Array(32);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return `${QR_PREFIX}${toBase64Url(bytes)}`;
};

export const parseSecureTicketQr = (value: string): string | null => {
  const match = value.trim().match(QR_PATTERN);
  return match?.[1] ?? null;
};

export const isSecureTicketQr = (value: string): boolean => parseSecureTicketQr(value) !== null;
