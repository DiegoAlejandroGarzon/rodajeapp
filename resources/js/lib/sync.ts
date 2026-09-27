import { api, getDeviceId, isNetworkError } from './api';
import {
    db,
    getMeta,
    setMeta,
    type Item,
    type QueuedOperation,
    type Shoot,
    type ShootItem,
} from './db';

const LAST_PULL_KEY = 'last_pull_at';
const LAST_PUSH_KEY = 'last_push_at';

export interface SyncResultRow {
    operation_id: string;
    result: string;
    message: string | null;
}

export interface PushOutcome {
    pushed: number;
    applied: number;
    rejected: SyncResultRow[];
}

type ApiShoot = Shoot & { items?: ShootItem[] };

function nowIso(): string {
    return new Date().toISOString();
}

export function newId(): string {
    return crypto.randomUUID();
}

/**
 * Aplica un cambio localmente y lo encola en la misma transacción. Si el celular
 * se apaga justo aquí, o se guardan ambos o ninguno: nunca un cambio visible que
 * el servidor jamás recibirá.
 */
async function commitLocal(
    operation: Omit<QueuedOperation, 'client_created_at'>,
    applyLocally: () => Promise<void>,
): Promise<void> {
    await db.transaction('rw', [db.items, db.shoots, db.shootItems, db.queue], async () => {
        await applyLocally();
        await db.queue.put({ ...operation, client_created_at: nowIso() });
    });
}

export async function updateShootItemLocally(
    shootItem: ShootItem,
    changes: Partial<ShootItem>,
): Promise<void> {
    const clientUpdatedAt = nowIso();
    const merged = { ...shootItem, ...changes };

    await commitLocal(
        {
            id: newId(),
            entity: 'shoot_item',
            entity_id: shootItem.id,
            action: 'update',
            payload: {
                shoot_id: shootItem.shoot_id,
                quantity_loaded: merged.quantity_loaded,
                quantity_returned: merged.quantity_returned,
                quantity_damaged: merged.quantity_damaged,
                load_status: merged.load_status,
                notes: merged.notes,
                loaded_at: merged.loaded_at,
                returned_at: merged.returned_at,
                client_updated_at: clientUpdatedAt,
            },
        },
        async () => {
            await db.shootItems.put({ ...merged, return_status: resolveReturnStatus(merged) });
        },
    );
}

export async function updateShootLocally(shoot: Shoot, changes: Partial<Shoot>): Promise<void> {
    const clientUpdatedAt = nowIso();
    const merged = { ...shoot, ...changes };

    await commitLocal(
        {
            id: newId(),
            entity: 'shoot',
            entity_id: shoot.id,
            action: 'update',
            payload: {
                status: merged.status,
                notes: merged.notes,
                loaded_at: merged.loaded_at,
                returned_at: merged.returned_at,
                client_updated_at: clientUpdatedAt,
            },
        },
        async () => {
            await db.shoots.put(merged);
        },
    );
}

/**
 * Equipo que apareció en locación y no estaba en el catálogo: se crea con un UUID
 * generado en el celular, así la referencia funciona sin pedirle un id al servidor.
 */
export async function addAdhocItemToShoot(
    shoot: Shoot,
    name: string,
    quantity: number,
): Promise<void> {
    const itemId = newId();
    const shootItemId = newId();
    const clientUpdatedAt = nowIso();

    const item: Item = {
        id: itemId,
        category_id: null,
        name,
        code: null,
        serial: null,
        quantity,
        reference_value: null,
        status: 'available',
        notes: null,
        is_adhoc: true,
        needs_review: true,
    };

    const shootItem: ShootItem = {
        id: shootItemId,
        shoot_id: shoot.id,
        item_id: itemId,
        quantity_planned: 0,
        quantity_loaded: quantity,
        quantity_returned: 0,
        quantity_damaged: 0,
        load_status: 'confirmed',
        return_status: 'pending',
        notes: 'Agregado en locación.',
        loaded_at: clientUpdatedAt,
        returned_at: null,
        was_added_in_field: true,
    };

    await db.transaction('rw', [db.items, db.shootItems, db.queue], async () => {
        await db.items.put(item);
        await db.shootItems.put(shootItem);

        // El equipo se encola primero: el renglón del rodaje lo referencia y el
        // servidor rechazaría la referencia si llegara antes que el equipo.
        await db.queue.put({
            id: newId(),
            entity: 'item',
            entity_id: itemId,
            action: 'create',
            client_created_at: clientUpdatedAt,
            payload: { name, quantity, client_updated_at: clientUpdatedAt },
        });

        await db.queue.put({
            id: newId(),
            entity: 'shoot_item',
            entity_id: shootItemId,
            action: 'create',
            client_created_at: new Date(Date.now() + 1).toISOString(),
            payload: {
                shoot_id: shoot.id,
                item_id: itemId,
                quantity_planned: 0,
                quantity_loaded: quantity,
                load_status: 'confirmed',
                notes: 'Agregado en locación.',
                loaded_at: clientUpdatedAt,
                client_updated_at: clientUpdatedAt,
            },
        });
    });
}

export function resolveReturnStatus(shootItem: ShootItem): ShootItem['return_status'] {
    if (shootItem.quantity_loaded === 0) {
        return 'pending';
    }

    const accountedFor = shootItem.quantity_returned + shootItem.quantity_damaged;

    if (accountedFor === 0) {
        return 'missing';
    }

    return accountedFor >= shootItem.quantity_loaded ? 'complete' : 'partial';
}

export async function pendingCount(): Promise<number> {
    return db.queue.filter((operation) => operation.synced_at === undefined).count();
}

/**
 * Envía la cola pendiente. Devuelve lo que el servidor rechazó para poder
 * mostrárselo al usuario en lugar de fallar en silencio.
 */
export async function pushQueue(): Promise<PushOutcome> {
    const pending = await db.queue
        .filter((operation) => operation.synced_at === undefined)
        .sortBy('client_created_at');

    if (pending.length === 0) {
        return { pushed: 0, applied: 0, rejected: [] };
    }

    const response = await api.post<{ results: SyncResultRow[]; shoots: ApiShoot[] }>('/sync/push', {
        device_id: getDeviceId(),
        operations: pending.map(({ id, entity, entity_id, action, client_created_at, payload }) => ({
            id,
            entity,
            entity_id,
            action,
            client_created_at,
            payload,
        })),
    });

    const { results, shoots } = response.data;
    const syncedAt = nowIso();

    await db.transaction('rw', [db.queue], async () => {
        for (const row of results) {
            await db.queue.update(row.operation_id, {
                synced_at: syncedAt,
                result: row.result,
                message: row.message,
            });
        }
    });

    // El servidor devuelve el estado final de los rodajes tocados: lo adoptamos
    // para que la pantalla refleje lo que quedó guardado de verdad.
    await replaceShoots(shoots);
    await setMeta(LAST_PUSH_KEY, syncedAt);

    const rejected = results.filter((row) => row.result !== 'applied');

    return {
        pushed: pending.length,
        applied: results.length - rejected.length,
        rejected,
    };
}

async function replaceShoots(shoots: ApiShoot[]): Promise<void> {
    if (shoots.length === 0) {
        return;
    }

    await db.transaction('rw', [db.shoots, db.shootItems], async () => {
        for (const shoot of shoots) {
            const { items, ...rest } = shoot;
            const existing = await db.shoots.get(shoot.id);

            await db.shoots.put({ ...rest, downloaded_at: existing?.downloaded_at });

            if (items) {
                await db.shootItems.where('shoot_id').equals(shoot.id).delete();
                await db.shootItems.bulkPut(items);
            }
        }
    });
}

/**
 * Descarga catálogo y rodajes activos. Es el paquete que el productor baja
 * mientras todavía tiene señal.
 */
export async function pullBootstrap(): Promise<void> {
    const response = await api.get<{
        server_time: string;
        categories: unknown[];
        items: Item[];
        responsables: unknown[];
        shoots: ApiShoot[];
    }>('/sync/bootstrap');

    const { categories, items, responsables, shoots } = response.data;

    await db.transaction(
        'rw',
        [db.categories, db.items, db.responsables, db.shoots, db.shootItems],
        async () => {
            await db.categories.clear();
            await db.categories.bulkPut(categories as never);

            await db.items.clear();
            await db.items.bulkPut(items);

            await db.responsables.clear();
            await db.responsables.bulkPut(responsables as never);

            // Preservamos la marca de descarga offline: es del dispositivo, no del servidor.
            const downloadMarks = new Map(
                (await db.shoots.toArray()).map((shoot) => [shoot.id, shoot.downloaded_at]),
            );

            const activeIds = shoots.map((shoot) => shoot.id);
            await db.shoots.where('id').noneOf(activeIds).delete();

            for (const shoot of shoots) {
                const { items: shootItems, ...rest } = shoot;

                await db.shoots.put({ ...rest, downloaded_at: downloadMarks.get(shoot.id) });
                await db.shootItems.where('shoot_id').equals(shoot.id).delete();

                if (shootItems) {
                    await db.shootItems.bulkPut(shootItems);
                }
            }
        },
    );

    await setMeta(LAST_PULL_KEY, nowIso());
}

/**
 * Descarga explícita de un rodaje para trabajo sin conexión. Es lo que garantiza
 * que los datos estén en el celular, en lugar de esperar que el Service Worker
 * haya alcanzado a cachear la pantalla correcta.
 */
export async function downloadShootForOffline(shootId: string): Promise<void> {
    const response = await api.get<{ shoot: ApiShoot }>(`/sync/shoots/${shootId}`);
    const { items, ...shoot } = response.data.shoot;

    await db.transaction('rw', [db.shoots, db.shootItems], async () => {
        await db.shoots.put({ ...shoot, downloaded_at: nowIso() });
        await db.shootItems.where('shoot_id').equals(shootId).delete();

        if (items) {
            await db.shootItems.bulkPut(items);
        }
    });
}

export interface SyncNowResult {
    ok: boolean;
    offline: boolean;
    push?: PushOutcome;
    error?: string;
}

/**
 * Sincronización completa: primero empuja lo pendiente, luego refresca. Ese orden
 * importa — si refrescáramos primero, el servidor sobrescribiría los cambios de
 * campo que aún no ha recibido.
 */
export async function syncNow(): Promise<SyncNowResult> {
    if (!navigator.onLine) {
        return { ok: false, offline: true };
    }

    try {
        const push = await pushQueue();
        await pullBootstrap();

        return { ok: true, offline: false, push };
    } catch (error) {
        if (isNetworkError(error)) {
            return { ok: false, offline: true };
        }

        return {
            ok: false,
            offline: false,
            error: error instanceof Error ? error.message : 'Falló la sincronización.',
        };
    }
}

export async function lastPullAt(): Promise<string | undefined> {
    return getMeta<string>(LAST_PULL_KEY);
}

/** Operaciones que el servidor rechazó y el usuario todavía no ha revisado. */
export async function rejectedOperations(): Promise<QueuedOperation[]> {
    return db.queue
        .filter(
            (operation) =>
                operation.synced_at !== undefined &&
                operation.result !== undefined &&
                operation.result !== 'applied',
        )
        .toArray();
}

export async function dismissRejected(): Promise<void> {
    const rejected = await rejectedOperations();
    await db.queue.bulkDelete(rejected.map((operation) => operation.id));
}

/** Limpia operaciones ya aplicadas para que la cola no crezca sin control. */
export async function pruneSyncedOperations(): Promise<void> {
    const applied = await db.queue
        .filter((operation) => operation.synced_at !== undefined && operation.result === 'applied')
        .toArray();

    await db.queue.bulkDelete(applied.map((operation) => operation.id));
}
