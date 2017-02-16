import { getOrCreateComputed, isArray, save, load } from "./core";

import { observable } from "mobx";
import { Disposable } from "./Disposable";

const arrayItemIdKey = "<id>";

export function getArrayItemId(item: any, idKey?: string) {
    return item && typeof item === "object" && item[idKey || arrayItemIdKey];
}

function setArrayItemId(item: any, id: string|number|undefined, idKey: string|undefined) {
    if (item && typeof item === "object") {
        item[idKey || arrayItemIdKey] = id;
    }
}

function setArrayItemIds(ar: any[], idKey: string|undefined) {
    let nextId = 1;
    const usedIds: { [id: string]: boolean } = {};

    // First pass - clear IDs that are duplicates
    for (const item of ar) {
        const id = getArrayItemId(item, idKey);
        if (id !== undefined) {
            nextId = typeof id === "number" ? Math.max(nextId, id + 1) : nextId;

            if (usedIds[id]) {
                setArrayItemId(item, undefined, idKey);
            } else {
                usedIds[id] = true;
            }
        }
    }

    // Second pass - allocate IDs
    for (const item of ar) {
        const id = getArrayItemId(item, idKey);
        if (id === undefined) {
            setArrayItemId(item, nextId++, idKey);
        }
    }
}

function saveItemWithId(item: any) {
    return { ...save(item), [arrayItemIdKey]: getArrayItemId(item) };
}


function getArrayJsonComputed(ar: any[], itemFactory: () => any, idKey: string|undefined) {

    return getOrCreateComputed(ar, "<json>", () => ({

        get() {
            setArrayItemIds(ar, idKey);
            return ar.map(idKey ? save : saveItemWithId);
        },

        set(data: any) {
            if (!isArray(data)) {
                ar.length = 0; // most likely schema has changed
                return;
            }

            // Build map of existing items by ID
            const existing: { [id: string]: any } = {};
            for (const item of ar) {
                const id = getArrayItemId(item, idKey);
                if (id !== undefined && !existing[id]) {
                    existing[id] = item;
                }
            }

            // Bring into line with supplied data
            ar.length = data.length;
            
            for (let i = 0; i < data.length; i++) {
                const itemJson = data[i];
                const itemId = getArrayItemId(itemJson, idKey);

                // Reuse existing item with same id
                let item = existing[itemId];
                if (item) {
                    delete existing[itemId];
                } else {
                    item = itemFactory();
                    setArrayItemId(item, itemId, idKey);
                }

                load(item, itemJson);            
                ar[i] = item;
            }
        
            // Dispose any items not reused
            for (const key of Object.keys(existing)) {
                const item = existing[key];
                if (item.dispose) {
                    item.dispose();
                }
            }
        }
    }));
}

export function array<T extends Partial<Disposable>>(factory: () => T, id?: keyof T): T[] {

    const result: T[] = observable([]);

    Object.defineProperty(result, "json", {
        get(this: any) {
            return getArrayJsonComputed(this, factory, id).get();
        },
        set(this: any, data: any) {
            getArrayJsonComputed(this, factory, id).set(data);
        }
    });

    return result;
}

export function arrayOf<T extends Partial<Disposable>>(ctor: new() => T, id?: keyof T): T[] {
    return array(() => new ctor(), id);
}
