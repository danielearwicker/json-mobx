
import * as test from "tape";
import { json } from "../index"

class HasSimpleArray {

    @json simpleArray: any[] = [];
}

test(`basic arrays`, t => {

    t.same(json.save([]), []);

    t.same(json.save([1, 2, "hi"]), [1, 2, "hi"]);
    t.same(json.save([1, 2, [3, 4]]), [1, 2, [3, 4]]);

    const o1 = new HasSimpleArray();

    o1.simpleArray.push("fish");
    o1.simpleArray.push({ firstName: "bob" });

    const s1 = json.save(o1);

    const o2 = new HasSimpleArray();
    json.load(o2, s1);

    t.same(o2.simpleArray, ["fish", { firstName: "bob" }]);

    t.end();
});

class FancyItem {

    @json firstName = "Homer";
    @json lastName = "Simpson";

    tag: number;
}

class HasFancyArray {

    @json fancyArray = json.arrayOf(FancyItem);
}

function fancyArrayTest(o1: HasFancyArray, t: test.Test) {
    o1.fancyArray.push(new FancyItem());
    o1.fancyArray.push(new FancyItem());
    o1.fancyArray.push(new FancyItem());
    
    o1.fancyArray[1].firstName = "Lisa";
    o1.fancyArray[2].firstName = "Grandpa";

    // These won't be serialized but we can use them to check that objects are reused
    o1.fancyArray[0].tag = 500;
    o1.fancyArray[1].tag = 501;
    o1.fancyArray[2].tag = 502;

    const s1 = json.save(o1);

    t.same(s1, {
        fancyArray: [
            { "<id>": 1, firstName: "Homer", lastName: "Simpson" },
            { "<id>": 2, firstName: "Lisa", lastName: "Simpson" },
            { "<id>": 3, firstName: "Grandpa", lastName: "Simpson" },
        ]
    });

    o1.fancyArray[1].firstName = "Bart";

    json.load(o1, s1); // revert

    t.equal(o1.fancyArray[1].firstName, "Lisa");

    // same objects
    t.equal(o1.fancyArray[0].tag, 500);
    t.equal(o1.fancyArray[1].tag, 501);
    t.equal(o1.fancyArray[2].tag, 502);

    json.load(o1, {
        fancyArray: [
            { "<id>": 2, firstName: "Lisa", lastName: "Lionheart" },
            { "<id>": 1, firstName: "Homer", lastName: "Simpson" },            
            { "<id>": 3, firstName: "Grandpa", lastName: "Simpson" },
        ]
    });

    // same objects, reordered
    t.equal(o1.fancyArray[0].tag, 501);
    t.equal(o1.fancyArray[1].tag, 500);
    t.equal(o1.fancyArray[2].tag, 502);

    t.equal(o1.fancyArray[0].lastName, "Lionheart");

    json.load(o1, {
        fancyArray: [
            { "<id>": 2, firstName: "Lisa", lastName: "Lionheart" },
            { "<id>": 3, firstName: "Grandpa", lastName: "Simpson" },
            { firstName: "Monty", lastName: "Burns" },
        ]
    });

    // 500 (Homer) now missing, new object has undefined tag
    t.equal(o1.fancyArray[0].tag, 501);    
    t.equal(o1.fancyArray[1].tag, 502);
    t.equal(o1.fancyArray[2].tag, undefined);

    t.equal(o1.fancyArray.length, 3);
    t.equal(o1.fancyArray[2].firstName, "Monty");

    const s2 = json.save(o1);

    t.same(s2, {
        fancyArray: [
            { "<id>": 2, firstName: "Lisa", lastName: "Lionheart" },
            { "<id>": 3, firstName: "Grandpa", lastName: "Simpson" },
            { "<id>": 4, firstName: "Monty", lastName: "Burns" },
        ]
    });

    const o3 = new HasFancyArray();
    o3.fancyArray.push(new FancyItem());
    o3.fancyArray[0].firstName = "Bart";

    json.save(o3); // force an ID to be assigned to Bart
    t.equal(json.idOf(o3.fancyArray[0]), 1);

    const o4 = new HasFancyArray();
    o4.fancyArray.push(new FancyItem());
    o4.fancyArray.push(o3.fancyArray[0]);

    const s4 = json.save(o4);

    // Bart got allocated id 1 first, so Homer gets 2 (maximum stability)
    t.same(s4, {
        fancyArray: [
            { "<id>": 2, firstName: "Homer", lastName: "Simpson" },
            { "<id>": 1, firstName: "Bart", lastName: "Simpson" }
        ]
    });

    t.end();
}

test(`fancy arrays`, t => fancyArrayTest(new HasFancyArray(), t));

class HasFancyObservableArray {

    @json fancyArray = json.arrayOf(FancyItem);
}

test(`fancy observable arrays`, t => fancyArrayTest(new HasFancyObservableArray(), t));
