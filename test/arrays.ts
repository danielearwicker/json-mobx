
import * as test from "tape";
import { json } from "../index"
import { observable } from "mobx";

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

    json.load(o2, { simpleArray: { notAnArray: true } });

    t.equal(o2.simpleArray.length, 0);

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

function fancyArrayTest(cls: new() => HasFancyArray, t: test.Test) {
    
    const o1 = new cls();
    o1.fancyArray.push(new FancyItem());
    json.load(o1, { fancyArray: { notAnArray: true } });
    t.equal(o1.fancyArray.length, 0);

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

    const o3 = new cls();
    o3.fancyArray.push(new FancyItem());
    o3.fancyArray[0].firstName = "Bart";

    json.save(o3); // force an ID to be assigned to Bart
    t.equal(json.idOf(o3.fancyArray[0]), 1);

    const o4 = new cls();
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

    const o5 = new cls();
    o5.fancyArray.push(new FancyItem());
    o5.fancyArray[0].firstName = "Bart";
    json.save(o5); // force an ID to be assigned to Bart
    t.equal(json.idOf(o5.fancyArray[0]), 1);

    const o6 = new cls();
    o6.fancyArray.push(new FancyItem());
    json.save(o6); // force an ID to be assigned to Homer
    t.equal(json.idOf(o6.fancyArray[0]), 1);

    o6.fancyArray.push(o5.fancyArray[0]);

    json.load(o6, {
        fancyArray: [
            { "<id>": 1, firstName: "Homer", lastName: "Simpson" },
            { "<id>": 2, firstName: "Bart", lastName: "Simpson" }
        ]
    });

    const o7 = new cls();
    o7.fancyArray.push(new FancyItem());
    o7.fancyArray[0].firstName = "Bart";
    json.save(o7); // force an ID to be assigned to Bart
    t.equal(json.idOf(o7.fancyArray[0]), 1);

    const o8 = new cls();
    o8.fancyArray.push(new FancyItem());
    json.save(o8); // force an ID to be assigned to Homer
    t.equal(json.idOf(o8.fancyArray[0]), 1);

    o8.fancyArray.push(o7.fancyArray[0]);

    const s8 = json.save(o8);

    t.same(s8, {
        fancyArray: [
            { "<id>": 1, firstName: "Homer", lastName: "Simpson" },
            { "<id>": 2, firstName: "Bart", lastName: "Simpson" }
        ]
    });

    const o9 = new cls();
    const bart = new DisposableItem("Bart", "Simpson", 100);
    const homer = new DisposableItem("Homer", "Simpson", 200)
    o9.fancyArray.push(bart);
    o9.fancyArray.push(homer);
    
    t.same(json.save(o9), {
        fancyArray: [
            { "<id>": 1, firstName: "Bart", lastName: "Simpson" },
            { "<id>": 2, firstName: "Homer", lastName: "Simpson" }
        ]
    })

    json.load(o9, {
        fancyArray: [
            { "<id>": 1, firstName: "Bart", lastName: "Simpson" },
            { "<id>": "other", firstName: "Lisa", lastName: "Simpson" },
        ]
    })

    t.equal(bart.disposed, false);
    t.equal(homer.disposed, true);

    t.end();
}

class DisposableItem extends FancyItem {

    disposed = false;

    constructor(firstName: string, lastName: string, tag: number) {
        super();
        this.firstName = firstName;
        this.lastName = lastName;
        this.tag = tag;    
    }

    dispose() {
        this.disposed = true;
    }   
}

test(`fancy arrays`, t => fancyArrayTest(HasFancyArray, t));

class HasFancyObservableArray {

    @json fancyArray = json.arrayOf(FancyItem);
}

test(`fancy observable arrays`, t => fancyArrayTest(HasFancyObservableArray, t));

class Todo {
    @json @observable id = "";
    @json @observable text = "";

    @observable completed = false; // not included in JSON
}

class TodoStore {
    @json todos = json.arrayOf(Todo, "id");
}

test(`basic arrays`, t => {

    const m = new TodoStore();

    const shop = new Todo();
    shop.id = "abc1";
    shop.text = "Shop";
    m.todos.push(shop);

    const drop = new Todo();
    drop.id = "abc2";
    drop.text = "Drop";
    m.todos.push(drop);

    const s1 = json.save(m);

    t.same(s1, {
        todos: [
            { id: "abc1", text: "Shop" },
            { id: "abc2", text: "Drop" }
        ]
    });

    drop.completed = true;
    drop.text = "Snooze";

    json.load(m, s1);

    t.same(s1, {
        todos: [
            { id: "abc1", text: "Shop" },
            { id: "abc2", text: "Drop" }
        ]
    });

    t.equal(shop.completed, false);
    t.equal(drop.completed, true);

    t.end();
});