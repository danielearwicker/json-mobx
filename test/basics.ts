import * as test from "tape";
import { json } from "../index"

test(`basic arrays`, t => {

    // ignored:
    json.load(null, null);

    t.throws(
        () => json.load({}, {}), 
        "Can only load JSON into an object with a json property, or an array");

    t.end();
});

