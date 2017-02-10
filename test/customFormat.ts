import * as test from "tape";
import { json } from "../index"

class C1 {

    get json() {
        return { mandatory: true };
    }
    set json(data: any) {
        if (!data.mandatory) {
            throw new Error("missing!");
        }
    }
}

class C2 {
    @json c1 = new C1();
}

class C3 {

    b = false;

    get json() {
        return this.b;
    }
    set json(data: any) {
        this.b = data;
    }
}

test(`customFormat`, t => {

    const o1 = new C1();
    const j1 = json.save(o1);
    t.same(j1, { mandatory: true });
    json.load(o1, { mandatory: true});

    const o2 = new C2();
    const j2 = json.save(o2);
    t.same(j2, { c1: { mandatory: true } });
    json.load(o2, { c1: { mandatory: true} });

    const o3 = new C3();
    const j3 = json.save(o3);
    t.equal(j3, false);
    json.load(o3, true);
    t.equal(o3.b, true);
    json.load(o3, false);
    t.equal(o3.b, false);

    t.end();
});
