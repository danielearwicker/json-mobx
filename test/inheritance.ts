import * as test from "tape";
import { json } from "../index"
import { computed, observable, autorun } from "mobx"

class C1 {
    @json firstName = "Donald";
    @json lastName = "Twain";
}

class C2 extends C1 {
    // Middle layer with no persistence
    get fullName() {
        return `${this.firstName} ${this.lastName}`;
    }
}

class C3 extends C2 {
    @json profession = "Trained Actor";
    @json status = "Bum";
}

test("Inheritance", t => {

    const o = new C3();

    const j = json.save(o);

    t.equal(j.firstName, "Donald");
    t.equal(j.lastName, "Twain");
    t.equal(j.profession, "Trained Actor");
    t.equal(j.status, "Bum");
    
    json.load(o, {
        lastName: "O'Connor",
        status: "Legend"
    });

    t.equal(o.firstName, "Donald");
    t.equal(o.lastName, "O'Connor");
    t.equal(o.profession, "Trained Actor");
    t.equal(o.status, "Legend");
    t.equal(o.fullName, "Donald O'Connor");
    
    t.end();
});

class C4 {
    count = 5;

    get json() {
        return {
            count: this.count
        };
    }
    set json(data: any) {
        this.count = data.count;
    }
}

class C5 extends C4 {
    @json label = "Test";
}

test("Inheritance - non-computed custom base", t => {

    const o = new C5();

    const j = json.save(o);

    t.equal(j.count, 5);
    t.equal(j.label, "Test");
    
    json.load(o, {
        count: 3,
        label: "Changed"
    });

    t.equal(o.count, 3);
    t.equal(o.label, "Changed");
    
    t.end();
});

class C6 {
    count = 5;

    @computed get json() {
        return {
            count: this.count
        };
    }
    set json(data: any) {
        this.count = data.count;
    }
}

class C7 extends C6 {
    @json label = "Test";
}

test("Inheritance - computed custom base", t => {

    const o = new C7();

    const j = json.save(o);

    t.equal(j.count, 5);
    t.equal(j.label, "Test");
    
    json.load(o, {
        count: 3,
        label: "Changed"
    });

    t.equal(o.count, 3);
    t.equal(o.label, "Changed");
    
    t.end();
});

class C8 {
    @json @observable count = 5;
}

class C9 extends C8 {
    @json @observable label = "Test";
}

test("Inheritance - recomputation when required", t => {

    const o = new C9();

    const j = json.save(o);

    t.equal(j.count, 5);
    t.equal(j.label, "Test");
    
    let saves = 0;
    const ar = autorun(() => {
        json.save(o);
        saves++;
    })

    t.equal(saves, 1);

    o.label = "Changed";    
    t.equal(saves, 2);
    saves = 1;

    o.label = "Changed2";    
    t.equal(saves, 2);
    saves = 1;

    o.count = 3;
    t.equal(saves, 2); 
    saves = 1;

    o.count = 4;
    t.equal(saves, 2); 
    saves = 1;

    ar();

    t.end();
});