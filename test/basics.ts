import * as test from "tape";
import { json } from "../index"

class C {
    @json member = "hello";
}

test(`basics`, t => {

    // ignored:
    json.load(null, null);

    t.throws(
        () => json.load({}, {}), 
        "Can only load JSON into an object with a json property, or an array");

    const c = new C();
    json.load(c, 5); // should be ignored (possible schema change)
    t.equal(c.member, "hello");
    
    t.end();
});

