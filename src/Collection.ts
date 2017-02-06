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
        // Do a simple diff/merge to avoid recreating items unnecessarily
        const existing: { [id: string]: boolean } = {};
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const itemJson = data.find(w => w.id === item.id);
            if (itemJson) {
                json.load(item, itemJson);
                existing[item.id] = true;
            } else {
                if (item.dispose) {
                    item.dispose();
                }                
                this.items.splice(i, 1);
                i--;
            }
        }
        for (const itemJson of data) {
            if (!existing[itemJson.id]) {
                const newItem = this.factory();
                json.load(newItem, itemJson);
                this.items.push(newItem);
            }
        }
    }
}
