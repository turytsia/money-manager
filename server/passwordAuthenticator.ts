import { createHash, timingSafeEqual } from 'node:crypto';
import { AuthStatus, type Authenticator } from './authenticator.js';

const BEARER_PREFIX = 'Bearer ';

/** With one shared password there is only one user. */
const SINGLE_USER_ID = 'default';

/**
 * Mixed into the password before hashing. The app does the same, so it
 * must match `TOKEN_SALT` in `src/utilities/sync/token.ts`.
 */
const TOKEN_SALT = 'money-manager-sync:';

/**
 * Lets in anyone who knows one shared password. The app never sends the
 * password itself, only a hash of it.
 */
export function createPasswordAuthenticator(
  password: string | undefined,
): Authenticator {
  const expectedToken = password ? createToken(password) : undefined;

  return {
    authenticate: async (request) => {
      if (!expectedToken) {
        return { status: AuthStatus.NotConfigured };
      }
      const header = request.headers.get('authorization') ?? '';
      const token = header.startsWith(BEARER_PREFIX)
        ? header.slice(BEARER_PREFIX.length)
        : '';
      return isSameToken(token, expectedToken)
        ? { status: AuthStatus.Granted, userId: SINGLE_USER_ID }
        : { status: AuthStatus.Denied };
    },
  };
}

export function createToken(password: string): string {
  return createHash('sha256')
    .update(TOKEN_SALT + password, 'utf8')
    .digest('hex');
}

/** Compares in constant time, so timing does not leak how close a guess is. */
function isSameToken(given: string, expected: string): boolean {
  const givenBytes = Buffer.from(given);
  const expectedBytes = Buffer.from(expected);
  return (
    givenBytes.length === expectedBytes.length &&
    timingSafeEqual(givenBytes, expectedBytes)
  );
}
