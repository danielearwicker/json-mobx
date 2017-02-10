import * as test from "tape";
import { observable } from "mobx"
import { json } from "../index"

class Node {
    @json @observable tag: number;
    @json @observable next?: Node;

    constructor(tag: number, next?: Node) {
        this.tag = tag;
        this.next = next;
    }
}

test(`deepTree`, t => {

    let head: Node | undefined = undefined;
    for (let n = 0; n < 20; n++) {
        head = new Node(n, head);
    }

    const j1 = json.save(head);

    t.equal(JSON.stringify(j1), '{"tag":19,"next":{"tag":18,"next":{"tag":17,"next":{"tag":16,"next":{"tag":15,"next":{"tag":14,"next":{"tag":13,"next":{"tag":12,"next":{"tag":11,"next":{"tag":10,"next":{"tag":9,"next":{"tag":8,"next":{"tag":7,"next":{"tag":6,"next":{"tag":5,"next":{"tag":4,"next":{"tag":3,"next":{"tag":2,"next":{"tag":1,"next":{"tag":0}}}}}}}}}}}}}}}}}}}}');    

    json.load(head, JSON.parse('{"tag":4,"next":{"tag":3,"next":{"tag":2,"next":{"tag":1,"next":{"tag":0}}}}}'));

    t.equal(head!.next!.next!.next!.next!.next!, undefined);
    t.equal(head!.next!.next!.next!.next!.tag, 0);
    t.equal(head!.next!.next!.next!.tag, 1);
    t.equal(head!.next!.next!.tag, 2);
    t.equal(head!.next!.tag, 3);
    t.equal(head!.tag, 4);

    t.end();
});
