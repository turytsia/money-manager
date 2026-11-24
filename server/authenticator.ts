export enum AuthStatus {
  Granted = 'granted',
  Denied = 'denied',
  /** The server has not been given what it needs to check anyone. */
  NotConfigured = 'not-configured',
}

export type AuthResult =
  | { status: AuthStatus.Granted; userId: string }
  | { status: AuthStatus.Denied | AuthStatus.NotConfigured };

/**
 * Decides who a request comes from. Each user gets their own document, so
 * supporting several users means writing an implementation that returns a
 * different `userId` per person.
 */
export interface Authenticator {
  authenticate: (request: Request) => Promise<AuthResult>;
}
