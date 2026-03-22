# FrostComponent

[![npm version](https://img.shields.io/npm/v/%40fr0st%2Fcomponent?style=flat-square)](https://www.npmjs.com/package/@fr0st/component)
[![npm downloads](https://img.shields.io/npm/dm/%40fr0st%2Fcomponent?style=flat-square)](https://www.npmjs.com/package/@fr0st/component)
[![minzipped size](https://img.shields.io/bundlejs/size/%40fr0st%2Fcomponent?format=minzip&style=flat-square)](https://bundlejs.com/?q=@fr0st/component)
[![license](https://img.shields.io/github/license/elusivecodes/FrostComponent?style=flat-square)](./LICENSE)

Native JavaScript stateful web components with reactive bindings, slots, shadow DOM, suspense, and HTML template autoloading. FrostComponent is powered by Custom Elements and FrostState, with no compilation step.

## Highlights

- Default ESM export for browser projects and bundlers
- Browser UMD bundle in `dist/` exposed as `globalThis.Component`
- No compilation step or virtual DOM
- Reactive component state powered by `@fr0st/state`
- HTML template autoloading for `x-*` elements
- Text, attribute, property, event, and input bindings
- Control-flow directives with `x:if`, `x:else-if`, `x:else`, and `x:each`
- Slots, shadow DOM templates, and built-in `x-suspense`
- JSDoc-powered IntelliSense

## Installation

### Bundlers / browser projects

```bash
npm i @fr0st/component
```

FrostComponent is ESM-only. Import the default `Component` export into browser-targeted bundles and apps.

### Browser (UMD)

Load the bundle from your own copy or a CDN:

```html
<script src="/path/to/dist/frost-component.min.js"></script>
<!-- or -->
<script src="https://cdn.jsdelivr.net/npm/@fr0st/component@latest/dist/frost-component.min.js"></script>
<script>
    Component.bootstrap({ baseUrl: '/components', extension: 'html' });
</script>
```

The browser bundle exposes `globalThis.Component`. Call `Component.bootstrap(...)` to start the runtime and register built-ins such as `x-suspense`.

## Quick Start

### HTML autoloaded components

Point `Component.bootstrap()` at a folder of component templates and drop `x-*` elements into the page.

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <script src="https://cdn.jsdelivr.net/npm/@fr0st/component@latest/dist/frost-component.min.js"></script>
</head>
<body>
    <script>
        Component.bootstrap({ baseUrl: '/components', extension: 'html' });
    </script>

    <x-counter start="3"></x-counter>
</body>
</html>
```

`/components/x-counter.html`

```html
<!-- shadow -->

<script>
    this.state.use('count', Number(this.state.start ?? 0));
</script>

<button @click="{ this.state.count++ }">Count: {count}</button>
```

See the full examples in [examples/counter.html](./examples/counter.html) and [examples/todo.html](./examples/todo.html).

### JavaScript-defined components

You can also define components directly with `customElements.define(...)`.

```js
import Component from '@fr0st/component';

class XGreeting extends Component {
    static get template() {
        return `
            <div>
                <h1>Hello {name}</h1>
                <button @click="{ this.state.count++ }">Clicked {count} times</button>
            </div>
        `;
    }

    initialize() {
        this.state.use('name', 'World');
        this.state.use('count', 0);
    }
}

customElements.define('x-greeting', XGreeting);
```

JS-defined classes can also opt into shadow DOM with `static shadowMode = 'open'` or `static shadowMode = 'closed'`.

TypeScript note: FrostComponent is written in JavaScript and uses JSDoc types, which most editors surface as IntelliSense.

## Authoring Model

FrostComponent revolves around a small base class and declarative template bindings.

- Component tag names must begin with `x-`
- Components must render exactly one root element
- Root `<slot>` elements are not allowed
- `this.state` is a FrostState `StateStore`
- Non-`x:` host attributes become initial state and are removed from the host
- `x:key` exposes keyed descendants directly on the component instance

Host attributes are parsed as JavaScript when possible and otherwise kept as strings.

```html
<x-profile
    name="Ada"
    age="37"
    active="true"
    state="{ theme: 'dark', compact: true }">
</x-profile>
```

Inside the component, that becomes state like:

```js
this.state.name; // 'Ada'
this.state.age; // 37
this.state.active; // true
this.state.theme; // 'dark'
this.state.compact; // true
```

`x:key` lets you grab important nodes directly from the instance:

```html
<div>
    <button x:key="saveButton">Save</button>
</div>
```

```js
this.saveButton; // <button>
```

## Bindings

Expressions use two forms:

- Bare expressions such as `count` resolve through `this.state.count`
- Braced expressions such as `{ this.state.count + 1 }` evaluate as JavaScript with `this` bound to the component

Text nodes interpolate expressions directly:

```html
<p>Hello {name}. Count: {count}</p>
```

### Attributes

Use `:attr` for dynamic attributes:

```html
<button
    :class="({ active: this.state.active, disabled: this.state.disabled })"
    :style="({ color: this.state.urgent ? 'red' : '' })"
    :title="label">
    Save
</button>
```

You can also bind `class` and `style` from state keys such as `:class="classes"` or `:style="styles"`. `class` bindings support strings, arrays, and object maps. `style` bindings support strings and object maps.

When the target is another component, `:state` merges object values into the child state, and other bound attributes become child state keys.

### Properties

Use `.prop` to assign custom JavaScript properties on DOM elements:

```html
<button .service="service"></button>
```

`.prop` is intentionally limited to custom properties. Built-in DOM properties such as `.value` are not supported.

### Events

Use `@event` to attach handlers.

Valid handler forms are:

- Component method names such as `@click="save"`
- Function expressions such as `@remove="(event) => { ... }"`
- Braced statement bodies such as `@click="{ this.state.count++ }"`

Supported modifiers:

- `.prevent`
- `.stop`
- `.once`
- `.self`
- `.capture`
- `.passive`

```html
<button @click.prevent="{ this.dispatch('save') }">Save</button>
<x-item @remove="(event) => { this.removeItem(event.target.state.id) }"></x-item>
```

### Form inputs

Use `x:bind` to keep inputs and state in sync:

```html
<input type="text" x:bind="text" />
<input type="checkbox" x:bind="completed" />
<input type="checkbox" value="red" x:bind="colors" />
<select multiple x:bind="tags"></select>
```

`x:bind` supports text inputs, textareas, selects, multi-selects, checkbox booleans, checkbox arrays, and radio groups.

## Control Flow

FrostComponent supports conditional and loop blocks directly in templates.

### Conditionals

Conditionals follow the same expression rules as other bindings: use a bare state key for simple lookups, or wrap JavaScript expressions in braces.

```html
<x-empty x:if="empty"></x-empty>
<x-list x:else-if="{ this.state.items.length < 10 }"></x-list>
<x-list-large x:else></x-list-large>
```

### Loops

`x:each` is used on component elements, not plain DOM elements.

```html
<x-todo-item x:each="items" x:id="id"></x-todo-item>
```

- `x:each` defaults to `items` when left empty
- `x:id` defaults to `id`
- Each item must include the identifier property
- Existing component instances are reused when identifiers stay stable

## Slots

Slots work in both light DOM and shadow DOM components.

```html
<div>
    <slot name="header"></slot>
    <slot></slot>
</div>
```

In light DOM components, FrostComponent replaces descendant `<slot>` elements with markers and moves matching children into place. In shadow mode, assigned children continue to behave like native slotted content.

## HTML Template Components

Autoloaded HTML components can include one render root plus optional top-level scripts and styles.

### Scripts

- `<script src="...">`: external scripts loaded once per source
- `<script connected>`: runs on each connection
- `<script>`: runs during `initialize()`

### Styles

- Light DOM templates append top-level `<style>` and `<link rel="stylesheet">` tags to `document.head`
- Shadow templates clone those styles into each shadow root

### Shadow mode

Use a top-level comment directive in an HTML template:

```html
<!-- shadow -->
```

or

```html
<!-- shadow:closed -->
```

This keeps the host element and renders the template inside a shadow root. Without a shadow directive, a light DOM component replaces its host with the rendered root element.

## Component API

FrostComponent exports a single default class:

```js
import Component from '@fr0st/component';
```

### `Component.bootstrap(options)`

Bootstraps built-in components, DOM observation, and optional autoloading for undefined `x-*` elements.

```js
Component.bootstrap({
    baseUrl: '/components',
    extension: 'html',
});
```

Options:

- `options.baseUrl`: folder used to fetch component templates
- `options.extension`: optional file extension appended to component URLs

### Instance properties

- `component.state`: the reactive FrostState store
- `component.element`: the public DOM node for the component
- `component.rootElement`: the rendered root element
- `component.renderRoot`: the shadow root in shadow mode, otherwise the root element
- `component.parentComponent`: nearest parent component, if any
- `component.childComponents`: rendered child components
- `component.connected`
- `component.mounted`
- `component.visible`
- `component.initialized`
- `component.loaded`

### Instance methods

- `component.initialize()`: lifecycle hook after render and binding
- `component.effect(callback, options)`: register a reactive effect
- `component.dispatch(name, detail)`: dispatch a bubbling composed custom event
- `component.deferLoad(promise)`: hold back `loaded` until a promise settles
- `component.ready(callback)`: run a callback once the component is loaded
- `component.slot(name = '')`: access a parsed slot definition in light DOM mode

Example:

```js
class XLoader extends Component {
    static get template() {
        return '<div>{label}</div>';
    }

    initialize() {
        this.state.use('label', 'Loading...');
        this.deferLoad(fetch('/api/data').then(() => {
            this.state.label = 'Ready';
        }));
    }
}
```

## `x-suspense`

`x-suspense` is registered when you call `Component.bootstrap(...)`. It renders fallback content until child components finish loading, then unwraps the real content.

```html
<x-suspense>
    <template slot="fallback">
        <div>Loading...</div>
    </template>

    <x-todos></x-todos>
</x-suspense>
```

## Behavior Notes

- Light DOM components replace their custom-element host with the rendered root. Shadow components keep the host element.
- `dispatch()` emits from the component's public DOM node. In light DOM that is the rendered root element. In shadow mode that is the host element.
- `.prop` bindings support custom expandos only.
- Event handlers must be a method name, a function expression, or a braced statement body.
- `x:each` can only be used on component elements.
- Slots must be descendants of the render root, not the root element itself.
- `effect(callback, { skipInvisible })` skips invisible components by default.

## Development

```bash
npm test
npm run js-lint
npm run build
```

## License

FrostComponent is released under the [MIT License](./LICENSE).
