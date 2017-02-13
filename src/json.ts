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

function getJsonComputed(
    that: any, 
    { computedKey, propertiesKey, superGet, superSet }: {
        computedKey: string,
        propertiesKey: string,
        superGet: (() => any) | undefined, 
        superSet: ((data: any) => void) | undefined 
    }
) {
    function get() {
        // Note we "clone" the superclass's data if any, not merging into its data!
        const data = { ... (superGet && superGet.call(that)) } || {};
        for (const propertyName of that[propertiesKey]) {            
            data[propertyName] = save(that[propertyName]);
        }
        return data;
    }

    function set(data: any) {
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

    let result: IComputedValue<any>;
    if (!Object.prototype.hasOwnProperty.call(that, computedKey)) {
        that[computedKey] = result = computed(get, set);
    } else {
        result = that[computedKey];
    }
    return result;
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
const arrayConstructorKey = "<constructor>";

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
    if (obj === undefined || obj === null || typeof obj !== "object" ||
        !(("json" in obj) || isArray(obj))) {
        return obj;
    }

    if (isArray(obj)) {
        if ((obj as any)[arrayConstructorKey]) {
            setArrayItemIds(obj);
            return obj.map(saveArrayItem);
        }

        return obj;
    }

    return obj.json;
}

function canLoadInto(obj: any) {
    return obj && typeof obj === "object" && (("json" in obj) || isArray(obj));
}

function load(obj: any, data: any) {
    if (data === "undefined" || !obj) {
        return;
    }

    if (!canLoadInto(obj)) {
        throw new Error("Can only load JSON into an object with a json property, or an array");
    }

    if (isArray(obj)) {
        if (!isArray(data)) {
            obj.length = 0; // most likely schema has changed
            return;
        }

        const itemConstructor = (obj as any)[arrayConstructorKey];
        if (!itemConstructor) {
            // Plain array data, so just replace everything
            obj.splice.apply(obj, [0, obj.length].concat(data));
            return;
        }

        // Build map of existing items by ID
        const existing: { [id: string]: any } = {};
        for (const item of obj) {
            const id = getArrayItemId(item);
            if (existing[id]) {
                throw new Error(`Duplicate item id ${id}`);
            }
            existing[id] = item;
        }

        // Bring into line with supplied data
        obj.length = data.length;
        
        for (let i = 0; i < data.length; i++) {
            const itemJson = data[i];
            const itemId = getArrayItemId(itemJson);

            // Reuse existing item with same id
            let item = existing[itemId];
            if (item) {
                delete existing[itemId];
            } else {
                item = new itemConstructor();
                setArrayItemId(item, itemId);
            }

            json.load(item, itemJson);            
            obj[i] = item;
        }
    
        // Dispose any items not reused
        for (const key of Object.keys(existing)) {
            const item = existing[key];
            if (item.dispose) {
                item.dispose();
            }
        }
    }

    obj.json = data;
}

function arrayOf<T extends Partial<Disposable>>(ctor: new() => T): T[] {
    const result: T[] = observable([]);
    (result as any)[arrayConstructorKey] = ctor;
    return result;
}

export const json = Object.assign(jsonImpl, { load, save, arrayOf, idOf: getArrayItemId });
