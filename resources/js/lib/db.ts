import Dexie, { type Table } from 'dexie';

export type ShootStatus = 'draft' | 'loaded' | 'returned' | 'closed' | 'cancelled';
export type LoadStatus = 'pending' | 'confirmed' | 'skipped';
export type ReturnStatus = 'pending' | 'complete' | 'partial' | 'missing';

export interface Category {
    id: string;
    name: string;
    color: string;
    sort_order: number;
}

export interface Item {
    id: string;
    category_id: string | null;
    name: string;
    code: string | null;
    serial: string | null;
    quantity: number;
    reference_value: string | null;
    status: string;
    notes: string | null;
    is_adhoc: boolean;
    needs_review: boolean;
}

export interface ShootItem {
    id: string;
    shoot_id: string;
    item_id: string;
    quantity_planned: number;
    quantity_loaded: number;
    quantity_returned: number;
    quantity_damaged: number;
    load_status: LoadStatus;
    return_status: ReturnStatus;
    notes: string | null;
    loaded_at: string | null;
    returned_at: string | null;
    was_added_in_field: boolean;
}

export interface Shoot {
    id: string;
    name: string;
    project_name: string | null;
    location: string | null;
    scheduled_date: string;
    expected_return_date: string | null;
    responsible_user_id: number;
    status: ShootStatus;
    notes: string | null;
    loaded_at: string | null;
    returned_at: string | null;
    closed_at: string | null;
    /** Marca que este rodaje se descargó explícitamente para trabajo sin conexión. */
    downloaded_at?: string;
}

export interface Responsable {
    id: number;
    name: string;
    email: string;
    role: string;
}

/**
 * Cada cambio hecho sin conexión se encola aquí. La cola es la única vía por la
 * que los datos salen del celular, así nada se pierde si la app se cierra.
 */
export interface QueuedOperation {
    id: string;
    entity: 'item' | 'shoot' | 'shoot_item';
    entity_id: string;
    action: 'create' | 'update';
    client_created_at: string;
    payload: Record<string, unknown>;
    /** Se conserva tras sincronizar para poder mostrar qué fue rechazado. */
    synced_at?: string;
    result?: string;
    message?: string | null;
}

export interface MetaEntry {
    key: string;
    value: unknown;
}

class RodajeDatabase extends Dexie {
    categories!: Table<Category, string>;
    items!: Table<Item, string>;
    shoots!: Table<Shoot, string>;
    shootItems!: Table<ShootItem, string>;
    responsables!: Table<Responsable, number>;
    queue!: Table<QueuedOperation, string>;
    meta!: Table<MetaEntry, string>;

    constructor() {
        super('rodaje-inventario');

        this.version(1).stores({
            categories: 'id, name, sort_order',
            items: 'id, name, code, category_id, status, needs_review',
            shoots: 'id, status, scheduled_date, responsible_user_id',
            shootItems: 'id, shoot_id, item_id, [shoot_id+item_id], return_status',
            responsables: 'id, name',
            queue: 'id, entity, entity_id, client_created_at, synced_at',
            meta: 'key',
        });
    }
}

export const db = new RodajeDatabase();

export async function setMeta(key: string, value: unknown): Promise<void> {
    await db.meta.put({ key, value });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
    const entry = await db.meta.get(key);

    return entry?.value as T | undefined;
}

export async function clearLocalData(): Promise<void> {
    await db.transaction(
        'rw',
        [db.categories, db.items, db.shoots, db.shootItems, db.responsables, db.queue, db.meta],
        async () => {
            await Promise.all([
                db.categories.clear(),
                db.items.clear(),
                db.shoots.clear(),
                db.shootItems.clear(),
                db.responsables.clear(),
                db.queue.clear(),
                db.meta.clear(),
            ]);
        },
    );
}
