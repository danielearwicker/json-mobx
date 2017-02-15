import { getOrCreateComputed, isArray, save, load } from "./core";

import { observable } from "mobx";
import { Disposable } from "./Disposable";

const arrayItemIdKey = "<id>";

export function getArrayItemId(item: any) {
    return (item && typeof item === "object" && item[arrayItemIdKey]) || 0;
}

function setArrayItemId(item: any, id: number) {
    if (item && typeof item === "object") {
        item[arrayItemIdKey] = id;
    }
}

function setArrayItemIds(ar: any[]) {
    let nextId = 1;
    const usedIds: { [id: string]: boolean } = {};
    
    // First pass - clear IDs that are duplicates
    for (const item of ar) {
        const id = getArrayItemId(item);
        if (id) {
            nextId = Math.max(nextId, id + 1);

            if (usedIds[id]) {
                setArrayItemId(item, 0);
            } else {
                usedIds[id] = true;
            }        
        }
    }

    // Second pass - allocate IDs
    for (const item of ar) {
        const id = getArrayItemId(item);
        if (!id) {
            setArrayItemId(item, nextId++);
        }
    }
}

function saveArrayItem(item: any) {
    return { ...save(item), [arrayItemIdKey]: getArrayItemId(item) };
}

function getArrayJsonComputed(ar: any[], itemFactory: () => any) {

    return getOrCreateComputed(ar, "<json>", () => ({

        get() {
            setArrayItemIds(ar);
            return ar.map(saveArrayItem);        
        },

        set(data: any) {
            if (!isArray(data)) {
                ar.length = 0; // most likely schema has changed
                return;
            }

            // Build map of existing items by ID
            const existing: { [id: string]: any } = {};
            for (const item of ar) {
                const id = getArrayItemId(item);
                if (!existing[id]) {
                    existing[id] = item;    
                }            
            }

            // Bring into line with supplied data
            ar.length = data.length;
            
            for (let i = 0; i < data.length; i++) {
                const itemJson = data[i];
                const itemId = getArrayItemId(itemJson);

                // Reuse existing item with same id
                let item = existing[itemId];
                if (item) {
                    delete existing[itemId];
                } else {
                    item = itemFactory();
                    setArrayItemId(item, itemId);
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

export function array<T extends Partial<Disposable>>(factory: () => T): T[] {

    const result: T[] = observable([]);

    Object.defineProperty(result, "json", {
        get(this: any) {
            return getArrayJsonComputed(this, factory).get();
        },
        set(this: any, data: any) {
            getArrayJsonComputed(this, factory).set(data);
        }
    });

    return result;
}

export function arrayOf<T extends Partial<Disposable>>(ctor: new() => T): T[] {
    return array(() => new ctor());
}
