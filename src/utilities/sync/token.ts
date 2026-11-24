const HEX_RADIX = 16;
const HEX_BYTE_LENGTH = 2;

/**
 * Mixed into the password before hashing. The server does the same, so it
 * must match `TOKEN_SALT` in `server/passwordAuthenticator.ts`.
 */
const TOKEN_SALT = 'money-manager-sync:';

/**
 * Turns the sync password into the token that is saved on the device and
 * sent to the server. The password itself is never stored or sent.
 */
export async function createSyncToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(TOKEN_SALT + password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_LENGTH, '0'))
    .join('');
}
