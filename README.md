# json-mobx
*Simple undo/redo and persistence for MobX*

Based on a single trivial concept: an object must have a mutable property called `json` that holds its JSON representation (and by JSON we mean a plain object tree that can be round-tripped via JSON).

As the `json` property is mutable, it means you can restore the object to a prior state by assigning to its `json` property. This is in contrast to most serialization systems which deserialize by creating a brand new tree of objects. Here we tend towards *minimally updating* an existing tree to bring it into line with the provided JSON.

This is particularly suited to situations where an object is not pure data but is also dependent on (or depended on by) the "environment". This is closely related to the way React components can use `componentDidMount` and `componentWillUnmount` to wire themselves into environmental dependencies. Or to put it another way, objects have a life-cycle.

    npm install --save json-mobx

## The `json` decorator

For many simple types of object, which just have a set of properties that need to be stored, it is a pain to write the `json` property by hand. So we provide a `json` decorator:

```ts
export class Widget  {

    @json @observable left = 0;
    @json @observable top = 0;
    @json @observable width = 1;
    @json @observable height = 1;

    @json @observable title = "New widget";
}
```

This class automagically gains a hidden `json` property. It is defined by a MobX `computed` so it only regenerates the JSON representation if anything changes.

There are also helper functions `json.save` and `json.load`. These are trivial and just deal with missing objects and checking that the `json` property exists before accessing or updating it:

```ts
function load(obj: any, data: any) {    
    if (data) {
        checkJsonProperty(obj);
        obj.json = data;
    }
}

function save(obj: any) {
    if (!obj) {
        return undefined;
    }
    checkJsonProperty(obj);
    return obj.json;
}
```

So:

```ts
const w = new Widget();

const j = json.save(w);

const w2 = new Widget();
json.load(w2, j);
```

If you use the `@json` decorator on a property that refers to an object with its own `json` implementation, that implementation will be used to persist that object, so ultimately you have control over what is saved/loaded and what side-effects this can have (this is important when objects may be "wired up" to external dependencies).

This means that stateful objects form a tree in which each object has a single owner.

Everything else is just extending or consuming this idea.

## Built-in classes

Building on this idea, we define two built-in classes, but note that these are just objects with their own `json` property implementation and are very simple, so you can see them as examples for rolling your own varieties:

* `Collection` (an array of objects)
* `Polymorph` (a reference to a child object that can be of a set of types)

In addition we provide `Undo`, an automatic undo/redo system suitable for editors. You construct it by passing an object with a `json` property, and it does the rest.

## Collection

The `Collection` class holds a readonly observable array of `items`. Each item is an object with a `json` property, and the collection's own `json` format is an array. 

Furthermore `Collection` mandates that each item must have a property called `id`, which is either a number or a string. This is very closely analogous to React's `key` prop. When the `json` is assigned to, the `Collection` compares its array of items with the provided array and makes minimal updates, matching items by `id`.

Optionally, items can have a `dispose` method. This is called when the diffing process discards an item. This is again closely analogous to `componentWillUnmount`, providing objects with an opportunity to detach themselves from any environmental dependencies.

## Polymorph

A polymorph is a container that holds exactly one object, of a type that may change. It doesn't just refer to the object; it *owns* it (just as `Collection` owns all its items), so it can optionally `dispose` it when necessary.

To construct it, you specify the string that names the initial type and a `factory` function that constructs an instance of the type (the constructor immediately calls it to get the initial instance).

```ts
constructor(type: string, private factory: (type: string) => T) ...
```

It has a `readonly` property `target` which is the current owned instance.

It has `get` and `set` methods that operate on the object type. So `p.set("MisterTickle")` will assign a new instance of `MisterTickle` (that is, whatever is returned when the factory is called with `"MisterTickle"`). If you're familiar with [bidi-mobx](https://github.com/danielearwicker/bidi-mobx) you'll have noticed that this makes it a `BoxedValue` holding the type of the object, so it can be bound to a `SelectString`.

It implements the `json` property so that the format is 

```ts
{
    type: string,
    settings: { ... }
}
```

The `settings` part depends on the type.

When the type changes, the previous instance has its `dispose` method called, if any. Also `Polymorph` itself implements `dispose` by calling on to the current instance's `dispose`, if any.

## Undo

When you construct an `Undo` object you pass it the root object-with-a-`json`-property and it immediately captures the current state. It does this inside `autorun`, so if the state changes it will be recaptured. The second time this happens, the previous state is pushed onto the undo stack. `Undo` has public properties `canUndo` and `canRedo`, and methods `undo` and `redo`, so you can link those up to a couple of toolbar buttons in an editor.
