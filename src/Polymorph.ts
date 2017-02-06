import { computed, observable } from "mobx";
import { Disposable } from "./Disposable";
import { json } from "./json";

export class Polymorph<T extends Partial<Disposable>> {
    @observable private type: string;
    @observable.ref private ref: T;

    constructor(type: string, private factory: (type: string) => T) {
        this.type = type;
        this.ref = factory(type);
    }

    dispose() {
        if (this.ref && this.ref.dispose) {
            this.ref.dispose();
        }
    }

    get target() {
        return this.ref;
    }

    get() {
        return this.type;
    }
    set(type: string) {
        if (this.type !== type) {
            this.type = type;
            this.dispose();
            this.ref = this.factory(this.type);
        }
    }

    @computed get json() {
        return {
            type: this.type,
            settings: json.save(this.ref) 
        };
    }
    set json(data: any) {
        if (data && data.type) {
            this.set(data.type);
            json.load(this.ref, data.settings);
        }
    }
}

