import { computed, IComputedValue } from "mobx";

const jsonPropertiesKey = "$jsonProperties";
const jsonJsonKey = "$jsonJson";

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

function jsonImpl(prototype: any, propertyName: string) {
    
    function getJsonComputed(that: any) {

        let result: IComputedValue<any>;
        if (!Object.prototype.hasOwnProperty.call(that, jsonJsonKey)) {
            that[jsonJsonKey] = result = computed(() => {
                const data = {} as any;
                for (const propertyName of that[jsonPropertiesKey]) {
                    const val = that[propertyName];
                    const valJson = (val && val.json) || val;
                    data[propertyName] = valJson;
                }
                return data;
            }, (data: any) => {
                for (const propertyName of that[jsonPropertiesKey]) {
                    const source = data[propertyName];
                    const target = that[propertyName];
                    if (source && target && typeof target === "object" && "json" in target) {
                        target.json = source;
                    } else {
                        const prop = getPropertyDescriptor(that, propertyName);
                        if (!prop || prop.set || !prop.get) {
                            that[propertyName] = source;
                        }
                    }
                }
            });
        } else {
            result = that[jsonJsonKey];
        }
        return result;        
    }

    let propArray;
    if (!Object.prototype.hasOwnProperty.call(prototype, jsonPropertiesKey)) {
        propArray = prototype[jsonPropertiesKey];
        if (propArray) {
            propArray = propArray.slice(0);
        } else {
            propArray = [];
        }
        prototype[jsonPropertiesKey] = propArray;
    } else {
        propArray = prototype[jsonPropertiesKey];
    }

    propArray.push(propertyName);

    if (!Object.prototype.hasOwnProperty.call(prototype, "json")) {
        Object.defineProperty(prototype, "json", {
            get(this: any) {
                return getJsonComputed(this).get();
            },
            set(this: any, data: any) {
                getJsonComputed(this).set(data);
            }
        });
    }
}

function checkJsonProperty(obj: any) {
    if (typeof obj !== "object" || !("json" in obj)) {
        throw new Error("Cannot load/save objects without json property");
    }
}

function load(obj: any, data: any) {    
    if (data !== "undefined" && obj) {
        checkJsonProperty(obj);
        obj.json = data;
    }
}

function save(obj: any) {
    if (!obj) {
        return undefined;
    }
    checkJsonProperty(obj);
    return obj.json;
}

export const json = Object.assign(jsonImpl, { load, save });
