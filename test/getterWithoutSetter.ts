import * as test from "tape";
import { observable } from "mobx"
import { json } from "../index"

class C1 {
    @json yourName = "Ted";

    @json get message() {
        return `Hello, ${this.yourName}`;
    }
}

test(`getterWithoutSetter - with plain value`, t => {

    const o1 = new C1();

    const j = json.save(o1);

    t.equal(j.yourName, "Ted");
    t.equal(j.message, "Hello, Ted");

    j.yourName = "Bill";

    json.load(o1, j);

    t.equal(o1.yourName, "Bill");
    t.equal(o1.message, "Hello, Bill");

    t.end();
});

class C2 {
    @json @observable yourName = "Ted";

    @json get message() {
        return `Hello, ${this.yourName}`;
    }
}

test(`getterWithoutSetter - with observable value`, t => {

    const o1 = new C2();

    const j = json.save(o1);

    t.equal(j.yourName, "Ted");
    t.equal(j.message, "Hello, Ted");

    j.yourName = "Bill";

    json.load(o1, j);

    t.equal(o1.yourName, "Bill");
    t.equal(o1.message, "Hello, Bill");

    t.end();
});

