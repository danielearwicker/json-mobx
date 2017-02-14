import { computed, IComputedValue, isObservableArray, observable } from "mobx";
import { Disposable } from "./Disposable";

let nextSuffix = 1;

function getPropertyDescriptor(obj: any, propertyName: string) {
    while (obj) {
        const desc = Object.getOwnPropertyDescriptor(obj, propertyName);
        if (desc) {
            return desc;
        }
        obj = Object.getPrototypeOf(obj);
    }
    return undefined;
}

function getOrCreateComputed(obj: any, key: string, options: () => { get(): any; set(data: any): void }) {
    let result: IComputedValue<any>;
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        const { get, set } = options();
        obj[key] = result = computed(get, set);
    } else {
        result = obj[key];
    }
    return result;
}

function getJsonComputed(
    that: any, 
    { computedKey, propertiesKey, superGet, superSet }: {
        computedKey: string,
        propertiesKey: string,
        superGet: (() => any) | undefined, 
        superSet: ((data: any) => void) | undefined 
    }
) {
    return getOrCreateComputed(that, computedKey, () => ({
        
        get() {
            // Note we "clone" the superclass's data if any, not merging into its data!
            const data = { ... (superGet && superGet.call(that)) } || {};
            for (const propertyName of that[propertiesKey]) {            
                data[propertyName] = save(that[propertyName]);
            }
            return data;
        },

        set(data: any) {
            if (superSet) {
                superSet.call(that, data);
            }

            if (!data || typeof data !== "object") {
                return;
            }

            for (const propertyName of that[propertiesKey]) {
                if (!(propertyName in data)) {
                    continue;
                }

                const source = data[propertyName];
                const target = that[propertyName];

                if (source !== null && source !== undefined && canLoadInto(target)) {                
                    load(target, source);
                } else {
                    const prop = getPropertyDescriptor(that, propertyName);
                    if (!prop || prop.set || !prop.get) {
                        that[propertyName] = source;
                    }
                }
            }
        }
    }));
}

const classSuffixKey = "<classId>";

function makePropertiesKey(suffix: number) {
    return `<properties:${suffix}>`;
}

function jsonImpl(prototype: any, propertyName: string) {
    
    if (Object.prototype.hasOwnProperty.call(prototype, classSuffixKey)) {
        const suffix = prototype[classSuffixKey];
        prototype[makePropertiesKey(suffix)].push(propertyName);
        return;
    }

    const suffix = nextSuffix++;
    prototype[classSuffixKey] = suffix;

    const propertiesKey = makePropertiesKey(suffix);
    prototype[propertiesKey] = [propertyName];

    if (!Object.prototype.hasOwnProperty.call(prototype, "json")) {

        const superJsonProp = getPropertyDescriptor(prototype, "json");

        const options = {
            propertiesKey,
            computedKey: `<json:${suffix}>`,            
            superGet: superJsonProp && superJsonProp.get,
            superSet: superJsonProp && superJsonProp.set
        };

        Object.defineProperty(prototype, "json", {
            get(this: any) {
                return getJsonComputed(this, options).get();
            },
            set(this: any, data: any) {
                getJsonComputed(this, options).set(data);
            }
        });
    }
}

const arrayItemIdKey = "<id>";

function getArrayItemId(item: any) {
    return (item && typeof item === "object" && item[arrayItemIdKey]) || 0;
}

function setArrayItemId(item: any, id: number) {
    if (item && typeof item === "object") {
        item[arrayItemIdKey] = id;
    }
}

function setArrayItemIds(ar: any[]) {
    let nextId = 1;
    const usedIds: { [id: number]: boolean } = {};
    
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

function isArray(obj: any) {
    return Array.isArray(obj) || isObservableArray(obj);
}

function save(obj: any): any {    
    return hasJsonProperty(obj) ? obj.json : obj;
}

function hasJsonProperty(obj: any) {
    return obj && typeof obj === "object" && ("json" in obj);
}

function canLoadInto(obj: any) {
    return hasJsonProperty(obj) || (obj && isArray(obj));
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

function load(obj: any, data: any) {
    if (data === "undefined" || !obj) {
        return;
    }

    if (!canLoadInto(obj)) {
        throw new Error("Can only load JSON into an object with a json property, or an array");
    }

    if (hasJsonProperty(obj)) {
        obj.json = data;
        return;
    }

    if (isArray(obj)) {
        // Plain array data, so just replace everything
        if (isArray(data)) {            
            obj.splice.apply(obj, [0, obj.length].concat(data));
        } else {
            obj.length = 0;
        }
        return;
    }
}

function array<T extends Partial<Disposable>>(factory: () => T): T[] {

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

function arrayOf<T extends Partial<Disposable>>(ctor: new() => T): T[] {
    return array(() => new ctor());
}

export const json = Object.assign(jsonImpl, { load, save, array, arrayOf, idOf: getArrayItemId });
