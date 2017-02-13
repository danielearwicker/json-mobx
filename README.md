# json-mobx
*Simple undo/redo and persistence for MobX*

    npm install --save json-mobx

Based on a single trivial concept: an object must have a mutable property called `json` that holds its JSON representation (and by JSON we mean a plain object tree that can be round-tripped via JSON).

As the `json` property is mutable, it means you can restore the object to a prior state by assigning to its `json` property. This is in contrast to most serialization systems which deserialize by creating a brand new tree of objects. Here we tend towards *reconciling* or *minimally updating* an existing tree to bring it into line with the provided JSON.

This is particularly suited to situations where an object is not pure data but is also dependent on (or depended on by) the "environment". This is closely related to the way React components can use `componentDidMount` and `componentWillUnmount` to wire themselves into environmental dependencies. Or to put it another way, objects have a life-cycle.

It also means that, thanks to MobX, implementing Undo/Redo is very easy. Prior states can be captured efficiently, and can be "loaded into" a live object hierarchy with minimal impact on unchanged objects.

In these notes we will use the term *live object* to refer to objects that have a `json` computed property.

## The `@json` decorator

For typical live objects it is a pain to write the `json` computed property by hand. So we provide a `json` decorator:

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

## Saving and Loading

There are also helper functions `json.save` and `json.load`. These select the correct way to serialize based on the kind of object. Note that `json.load` does not return a new de-serialized object. Rather, it updates the object passed to it.

So:

```ts
const w = new Widget();

const j = json.save(w);

const w2 = new Widget();
json.load(w2, j);
```

If you use the `@json` decorator on a property that refers to an object with its own `json` implementation, that implementation will be used to persist that object, so ultimately you have control over what is saved/loaded and what side-effects this can have (this is important when objects may be "wired up" to external dependencies).

This means that stateful objects form a tree in which each object has a single owner. Where a `@json` property refers to another live object, consider marking it `readonly`; instead of allocating a new object, you will be reconfiguring the existing one. (This is not an absolute rule, but usually makes sense.)

## Arrays
There is built-in support for arrays. The `save` and `load` functions descend recursively into the items of arrays. Arrays of plain objects or primitives are not treated any differently to primitives.

More interestingly, you can construct an array property using `json.arrayOf(SomeClass)` instead of plain `[]`:

```ts
class FancyItem {
    @json firstName = "Homer";
    @json lastName = "Simpson";
}

class HasFancyArray {
    @json readonly fancyArray = json.arrayOf(FancyItem);

    // instead of:
    // @json fancyArray = [];
}
```

Again, note the use of `readonly` on the `fancyArray` property. This is a good idea because if you accidentally assigned a new (ordinary) array to `fancyArray` it would lose the ability to perform reconciliation.

Behind the scenes, the items of the array will be stamped with unique IDs, which are later used for reconciliation. When a prior state of `HasFancyArray` is restored by `json.load`, it will match up the data with the right objects by ID. It will also use the `FancyItem` constructor to default-construct any additional objects specified in the saved state, so it can load into them.

The type parameter of `json.arrayOf` is constrained so it must be a `new`-able class constructor that takes no arguments. If it has a method `dispose`, that must require no arguments (it will be automatically called whenever `json.load` discards an existing item from the array).

This reconciliation process is closely analogous to React's treatement of the virtual DOM. The optional `dispose` method works like `componentWillUnmount`, providing objects with an opportunity to detach themselves from any environmental dependencies before they are abandoned.

Also the auto-generated ID stamped onto each array item plays a similar role to React's `key` prop. The major difference is that you don't need to specify the ID manually.

If you want to use the ID as a React `key`, you can get it with `json.idOf(item)`. But note that it will return the value 0 until its containing array has been saved. (If you attach an `Undo` system to your root object, this will happen automatically).

## Polymorph

As you can create a class with a `json` computed property to define a custom serialization technique, it is easy to extend this library. One very common requirement is to refer to an object whose precise type may vary. This is supported by the built-in `Polymorph` class, though in reality it is just a (very simple) example of a class with a custom `json` computed property.

A polymorph is a container that holds exactly one object, of a type that may change. It doesn't just refer to the object; it *owns* it, so it can optionally `dispose` it when necessary.

To construct it, you specify the string that names the initial type and a `factory` function that constructs an instance of the type (the constructor immediately calls it to get the initial instance).

```ts
constructor(type: string, private factory: (type: string) => T) ...
```

It has a `readonly` property `target` which is the current owned instance (note: this property's value may change. It is `readonly`, not `const`!)

It has `get` and `set` methods that operate on the object type. So `p.set("MisterTickle")` will assign a new instance of `MisterTickle` (that is, whatever is returned when the factory is called with `"MisterTickle"`). If you're familiar with [bidi-mobx](https://github.com/danielearwicker/bidi-mobx) you'll have noticed that this makes it a `BoxedValue` holding the type of the object, so it can be bound to a `SelectString`.

It implements the `json` property so that the format is 

```ts
{
    type: string,
    settings: { ... }
}
```

The `settings` part depends on the type: `Polymorph` simply uses `json.load` and `json.save` to take care of it.

When the type changes, the previous instance has its `dispose` method called, if any. Also `Polymorph` itself implements `dispose` by calling on to the current instance's `dispose`, if any.

## Undo

When you construct an `Undo` object you pass it the root live object and it immediately captures the current state. It does this inside `autorun`, so if the state changes it will be recaptured. The second time this happens, the previous state is pushed onto the undo stack. `Undo` has public properties `canUndo` and `canRedo`, and methods `undo` and `redo`, so you can link those up to a couple of toolbar buttons in an editor.
