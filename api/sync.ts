import { createPasswordAuthenticator } from '../server/passwordAuthenticator.js';
import { createSyncHandler } from '../server/syncHandler.js';
import { createVercelBlobStore } from '../server/vercelBlobStore.js';

// This file is the only place that names the vendors in use. To change
// where data is kept or how people sign in, swap these two lines.
const handleSync = createSyncHandler({
  store: createVercelBlobStore(),
  authenticator: createPasswordAuthenticator(process.env.SYNC_PASSWORD),
});

export function GET(request: Request): Promise<Response> {
  return handleSync(request);
}

export function PUT(request: Request): Promise<Response> {
  return handleSync(request);
}
