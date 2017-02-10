import * as test from "tape";
//import { observable } from "mobx"
import { json, Collection } from "../index"

class I {
    @json id = I.nextId++;
    @json message = ""

    selected = false;

    constructor(message?: string) {
        this.message = message || "";
    }

    static nextId = 1;
}

class C {
    @json list = new Collection<I>(() => new I());

    messages() {
        return this.list.items.map(i => i.message).join(",");
    }
}

test(`stableCollection`, t => {

    const c = new C();

    c.list.items.push(new I("a"));
    c.list.items.push(new I("b"));
    t.equal(c.messages(), "a,b");

    c.list.items[1].selected = true;

    json.load(c, {
        list: [
            {id: 1, message: "a"},
            {id: 3, message: "c"},
            {id: 2, message: "b"}
        ]
    });

    t.equal(c.messages(), "a,c,b");
    t.equal(c.list.items[2].selected, true);

    t.end();
});
