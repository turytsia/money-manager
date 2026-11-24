import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryCloud, SECRET_TOKEN } from '../../test/mocks/memoryCloud';
import { createStore } from '../store';
import { createSyncEngine, SyncPhase } from './syncEngine';

describe('createSyncEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 23, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when sync is turned on with the right password', () => {
    it('should send the data of this device to an empty cloud', async () => {
      localStorage.setItem('mm:tx:202611', '[["a1",23,2,1250]]');
      const cloud = createMemoryCloud();
      const store = createStore();
      const engine = createSyncEngine(store, cloud.createProvider);

      const phase = await engine.connect(SECRET_TOKEN);

      expect(phase).toBe(SyncPhase.Idle);
      expect(cloud.getDocument()).toMatchObject({
        app: 'money-manager',
        transactions: [
          { id: 'a1', date: '2026-11-23', category: 'groceries', amount: 12.5 },
        ],
      });
      expect(engine.getStatus()).toEqual({
        phase: SyncPhase.Idle,
        syncedAt: new Date(2026, 10, 23, 12).getTime(),
      });
    });

    it('should bring back the cloud copy on a device that lost its data', async () => {
      const cloud = createMemoryCloud();
      cloud.saveFromOtherDevice(
        createDocument([{ id: 'r1', category: 'food' }], 'EUR'),
      );
      const store = createStore();
      const engine = createSyncEngine(store, cloud.createProvider);

      await engine.connect(SECRET_TOKEN);

      expect(store.getState().transactions).toEqual([
        { id: 'r1', day: 20261120, categoryId: 1, amount: 800 },
      ]);
      expect(store.getState().settings.currency).toBe('EUR');
      // Nothing changed here, so nothing is sent back.
      expect(cloud.getPushCount()).toBe(0);
    });
  });

  describe('when sync cannot be turned on', () => {
    it('should stay off after a wrong password', async () => {
      const store = createStore();
      const engine = createSyncEngine(
        store,
        createMemoryCloud().createProvider,
      );

      const phase = await engine.connect('wrong');

      expect(phase).toBe(SyncPhase.Unauthorized);
      expect(store.getState().sync).toBeNull();
      expect(engine.getStatus().phase).toBe(SyncPhase.Off);
    });

    it('should stay off when the server cannot be reached', async () => {
      const store = createStore();
      const cloud = createMemoryCloud({ isOnline: false });
      const engine = createSyncEngine(store, cloud.createProvider);

      expect(await engine.connect(SECRET_TOKEN)).toBe(SyncPhase.Offline);
      expect(store.getState().sync).toBeNull();
    });
  });

  describe('when sync is on', () => {
    it('should send a change made on this device', async () => {
      const { cloud, store, engine } = await createConnected();
      store.addTransaction({ day: 20261123, categoryId: 1, amount: 500 });

      await engine.syncNow();

      expect(cloud.getDocument()).toMatchObject({
        transactions: [{ date: '2026-11-23', category: 'food', amount: 5 }],
      });
      expect(store.getState().sync?.pending.upsertedTransactionIds).toEqual([]);
    });

    it('should not send anything when nothing changed', async () => {
      const { cloud, engine } = await createConnected();
      const pushCount = cloud.getPushCount();

      await engine.syncNow();

      expect(cloud.getPushCount()).toBe(pushCount);
    });

    it('should pick up a change made on another device', async () => {
      const { cloud, store, engine } = await createConnected();
      cloud.saveFromOtherDevice(
        createDocument([{ id: 'r1', category: 'fun' }]),
      );

      await engine.syncNow();

      expect(store.getState().transactions.map(({ id }) => id)).toEqual(['r1']);
    });

    it('should keep the changes of both devices when both changed', async () => {
      const { cloud, store, engine } = await createConnected();
      const added = store.addTransaction({
        day: 20261123,
        categoryId: 1,
        amount: 500,
      });
      cloud.saveFromOtherDevice(
        createDocument([{ id: 'r1', category: 'fun' }]),
      );

      await engine.syncNow();

      const expectedIds = [added?.id, 'r1'].sort();
      expect(
        store
          .getState()
          .transactions.map(({ id }) => id)
          .sort(),
      ).toEqual(expectedIds);
      expect(
        (
          cloud.getDocument() as { transactions: Array<{ id: string }> }
        ).transactions
          .map(({ id }) => id)
          .sort(),
      ).toEqual(expectedIds);
    });

    it('should keep the data and try again later while offline', async () => {
      const { cloud, store, engine } = await createConnected();
      cloud.setOnline(false);
      const added = store.addTransaction({
        day: 20261123,
        categoryId: 1,
        amount: 500,
      });

      expect(await engine.syncNow()).toBe(SyncPhase.Offline);
      expect(store.getState().transactions).toHaveLength(1);

      cloud.setOnline(true);
      await vi.advanceTimersByTimeAsync(30_000);

      expect(engine.getStatus().phase).toBe(SyncPhase.Idle);
      expect(cloud.getDocument()).toMatchObject({
        transactions: [{ id: added?.id }],
      });
    });

    it('should stop sending after it is turned off', async () => {
      const { cloud, store, engine } = await createConnected();
      const pushCount = cloud.getPushCount();

      engine.disconnect();
      store.addTransaction({ day: 20261123, categoryId: 1, amount: 500 });
      await engine.syncNow();

      expect(cloud.getPushCount()).toBe(pushCount);
      expect(localStorage.getItem('mm:sync')).toBeNull();
    });
  });

  describe('when it is started', () => {
    it('should send a single change on its own shortly after it is made', async () => {
      const { cloud, store, engine } = await createConnected();
      const stop = engine.start();
      await vi.advanceTimersByTimeAsync(0);

      const added = store.addTransaction({
        day: 20261123,
        categoryId: 1,
        amount: 500,
      });
      await vi.advanceTimersByTimeAsync(2500);
      stop();

      expect(cloud.getDocument()).toMatchObject({
        transactions: [{ id: added?.id }],
      });
    });

    it('should send a burst of changes together, in one request', async () => {
      const { cloud, store, engine } = await createConnected();
      const stop = engine.start();
      await vi.advanceTimersByTimeAsync(0);

      store.addTransaction({ day: 20261123, categoryId: 1, amount: 500 });
      store.addTransaction({ day: 20261123, categoryId: 2, amount: 700 });
      const pushCount = cloud.getPushCount();
      await vi.advanceTimersByTimeAsync(2500);
      stop();

      expect(cloud.getPushCount()).toBe(pushCount + 1);
      expect(
        (cloud.getDocument() as { transactions: Array<unknown> }).transactions,
      ).toHaveLength(2);
    });

    it('should tell listeners what it is doing', async () => {
      const { store, engine } = await createConnected();
      const phases: Array<SyncPhase> = [];
      engine.subscribe(() => phases.push(engine.getStatus().phase));
      store.addTransaction({ day: 20261123, categoryId: 1, amount: 500 });

      await engine.syncNow();

      expect(phases).toContain(SyncPhase.Syncing);
      expect(phases.at(-1)).toBe(SyncPhase.Idle);
    });
  });
});

async function createConnected(): Promise<{
  cloud: ReturnType<typeof createMemoryCloud>;
  store: ReturnType<typeof createStore>;
  engine: ReturnType<typeof createSyncEngine>;
}> {
  const cloud = createMemoryCloud();
  const store = createStore();
  const engine = createSyncEngine(store, cloud.createProvider);
  await engine.connect(SECRET_TOKEN);
  return { cloud, store, engine };
}

/** A cloud document as another device would have saved it. */
function createDocument(
  transactions: Array<{ id: string; category: string }>,
  currency: string = 'USD',
): object {
  return {
    app: 'money-manager',
    version: 2,
    currency,
    transactions: transactions.map(({ id, category }) => ({
      id,
      date: '2026-11-20',
      category,
      amount: 8,
    })),
  };
}
