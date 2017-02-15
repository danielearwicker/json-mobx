import * as test from "tape";
import { Polymorph, json } from "../index";

class C1 {
    @json name: string;

    disposed = false;

    dispose() {
        this.disposed = true;
    }

    constructor(name: string) {
        this.name = name;
    }
}

test(`polymorph`, t => {

    const p1 = new Polymorph("x", n => new C1("name: " + n));

    t.equals(p1.target.name, "name: x");
    t.equals(p1.get(), "x");

    const s1 = json.save(p1);

    p1.set("y");

    t.equals(p1.target.name, "name: y");
    t.equals(p1.get(), "y");

    json.load(p1, s1);

    t.equals(p1.target.name, "name: x");
    t.equals(p1.get(), "x");

    t.false(p1.target.disposed);

    p1.dispose();
    t.true(p1.target.disposed);


    t.end();
});
