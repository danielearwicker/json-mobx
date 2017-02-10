import { computed, observable } from "mobx";
import { Disposable } from "./Disposable";
import { json } from "./json";

export interface Identified {
    id: string|number;
}

export class Collection<T extends (Identified & Partial<Disposable>)> {
    
    @observable readonly items: T[] = [];

    constructor(private factory: () => T) {}

    @computed get json() {
        return this.items.map(json.save);
    }
    set json(data) {

        // Build map of existing items by id (check for uniqueness)
        const existing: { [id: string]: T } = {};
        for (const item of this.items) {
            if (existing[item.id]) {
                throw new Error(`Duplicate item id ${item.id}`);
            }
            existing[item.id] = item;
        }

        // Bring into line with supplied data
        if (data && Array.isArray(data)) {            
            for (let i = 0; i < data.length; i++) {
                const itemJson = data[i];

                // Reuse existing item with same id
                let item = existing[itemJson.id];
                if (item) {
                    delete existing[itemJson.id];
                } else {
                    item = this.factory();
                }

                json.load(item, itemJson);
                if (item.id !== itemJson.id) {
                    throw new Error("Items must have persistent id property");
                }

                this.items[i] = item;
            }
        } else {
            this.items.length = 0;
        }

        // Dispose any items not reused
        for (const key of Object.keys(existing)) {
            const item = existing[key];
            if (item.dispose) {
                item.dispose();
            }
        }
    }
}
