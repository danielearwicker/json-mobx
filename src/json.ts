import { getOrCreateComputed, save, load, canLoadInto } from "./core";
import { array, arrayOf, getArrayItemId } from "./array";
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
    return getOrCreateComputed(that, computedKey, () => ({
        
        get() {
            // Note we "clone" the superclass's data if any, not merging into its data!
            const data = superGet ? { ... superGet.call(that) } : {};
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

export const json = Object.assign(jsonImpl, { load, save, array, arrayOf, idOf: getArrayItemId });

(0 as any as Disposable); // Disposable is unused but must be imported
