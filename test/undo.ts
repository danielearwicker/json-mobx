import * as test from "tape";
import { observable, runInAction } from "mobx";
import { json, Undo } from "../index";

class TestModel {

    @json @observable lights = false;
    @json @observable camera = false;
    @json @observable action = false;
}

test(`undo`, t => {

    const m = new TestModel();

    let state: any;

    const u = new Undo(m, after => state = after);

    m.lights = true;

    t.true(u.canUndo);
    t.false(u.canRedo);

    t.same(state, { lights: true, camera: false, action: false });

    u.undo();

    t.false(m.lights);
    t.false(m.camera);
    t.false(m.action);
    t.false(u.canUndo);
    t.true(u.canRedo);

    t.same(state, { lights: false, camera: false, action: false });

    u.redo();

    t.true(m.lights);
    t.false(m.camera);
    t.false(m.action);
    t.true(u.canUndo);
    t.false(u.canRedo);

    t.same(state, { lights: true, camera: false, action: false });

    runInAction(() => {
        m.lights = false;
        m.camera = true;
    });

    t.false(m.lights);
    t.true(m.camera);
    t.false(m.action);
    
    t.same(state, { lights: false, camera: true, action: false });

    u.undo();

    t.true(m.lights);
    t.false(m.camera);
    t.false(m.action);
    
    t.same(state, { lights: true, camera: false, action: false });

    u.redo();

    t.false(m.lights);
    t.true(m.camera);
    t.false(m.action);
    
    t.same(state, { lights: false, camera: true, action: false });

    u.dispose();

    t.end();
});
