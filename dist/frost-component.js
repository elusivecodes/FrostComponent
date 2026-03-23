(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Component = factory());
})(this, (function () { 'use strict';

    /**
     * Checks whether a value is a plain object constructed by `Object`.
     * Values with a null prototype and class instances return `false`.
     * @param {*} value The value to test.
     * @returns {boolean} Whether the value is a plain object.
     */
    function isPlainObject$1(value) {
        return value?.constructor === Object;
    }

    const activeEffects = [];
    const effectNextStates = new WeakMap();

    /**
     * Checks whether state reads are currently being tracked by an active effect.
     * @returns {boolean} Whether an effect is currently collecting dependencies.
     */
    function isTrackingEffects() {
        return activeEffects.length > 0;
    }

    /**
     * Callable state accessor returned by `useState`.
     * @template T
     * @typedef {Function} StateAccessor
     * @property {(markEffects?: boolean) => T} get The function to retrieve the current value.
     * @property {(newValue: T) => void} set The function to set a new value.
     * @property {T} value The current value.
     * @property {T|undefined} previous The previous value after the last successful change.
     */

    /**
     * Registers a reactive effect that runs immediately and re-runs when any state
     * read inside the callback changes.
     * Re-execution is scheduled in a microtask unless `.sync()` is used.
     * @param {Function} callback The callback function.
     * @param {{ weak?: boolean }} [options] The effect options.
     * @param {boolean} [options.weak=false] Whether to use a WeakRef for the effect runner.
     * @returns {Function} The wrapped effect runner.
     * @throws {Error} If the effect synchronously triggers itself.
     * @throws {*} Re-throws any error thrown by `callback`.
     */
    function useEffect(callback, { weak = false } = {}) {
        const prevStates = new Set();
        const nextStates = new Set();

        const wrapped = () => {
            if (activeEffects.includes(ref)) {
                throw new Error('Cannot trigger an effect inside itself');
            }

            activeEffects.push(ref);

            try {
                callback();
            } catch (error) {
                for (const state of nextStates) {
                    if (!prevStates.has(state)) {
                        state.effects.delete(ref);
                    }
                }

                nextStates.clear();

                throw error;
            } finally {
                activeEffects.pop();
            }

            for (const state of prevStates) {
                if (!nextStates.has(state)) {
                    state.effects.delete(ref);
                }
            }

            prevStates.clear();

            for (const state of nextStates) {
                prevStates.add(state);
            }

            nextStates.clear();
        };

        let running;
        let pending = false;
        const debounced = () => {
            if (running) {
                pending = true;
                return;
            }

            running = true;

            Promise.resolve()
                .then(() => {
                    wrapped();
                })
                .finally(() => {
                    running = false;
                    if (pending) {
                        pending = false;
                        debounced();
                    }
                });
        };

        debounced.sync = wrapped;

        const ref = weak ?
            new WeakRef(debounced) :
            { deref: () => debounced };

        effectNextStates.set(ref, nextStates);

        wrapped();

        return debounced;
    }
    /**
     * Creates a reactive state container.
     * @template T
     * @param {T} value The initial state value.
     * @returns {StateAccessor<T>} The state accessor.
     */
    function useState(value) {
        let previous;
        const effects = new Set();

        const get = (markEffects = true) => {
            if (markEffects && activeEffects.length) {
                const activeEffect = activeEffects.at(-1);

                effects.add(activeEffect);

                if (effectNextStates.has(activeEffect)) {
                    effectNextStates.get(activeEffect).add(state);
                }
            }

            return value;
        };

        const set = (newValue) => {
            if (Object.is(value, newValue)) {
                return;
            }

            previous = value;
            value = newValue;

            for (const effect of effects) {
                const callback = effect.deref();

                if (callback) {
                    callback(state);
                } else {
                    effects.delete(effect);
                }
            }
        };

        const state = function(newValue) {
            if (!arguments.length) {
                return get();
            }

            set(newValue);
        };

        state[Symbol.toPrimitive] = get;
        state.get = get;
        state.set = set;

        state.cleanup = () => {
            if (!activeEffects.length) {
                return;
            }
            const activeEffect = activeEffects.at(-1);
            if (effectNextStates.has(activeEffect) && !effectNextStates.get(activeEffect).has(state)) {
                effects.delete(activeEffect);
            }
        };

        Object.defineProperty(state, 'previous', {
            get: () => previous,
        });

        Object.defineProperty(state, 'value', {
            get,
            set,
        });

        Object.defineProperty(state, 'effects', {
            get: () => effects,
        });

        return state;
    }

    /** @import { StateAccessor } from './state.js' */


    /**
     * Creates a callable, proxy-backed keyed reactive store.
     * Existing keys are read via property access, written via assignment, and raw
     * state accessors are available via `store.use(key)` or `store(key)`.
     * Missing string-key reads return `undefined`. Reads made during effect
     * tracking subscribe to later assignments without exposing the key.
     * API keys are reserved and cannot be used as state keys.
     */
    class StateStore extends Function {
        #state = new Map();
        #visibleKeys = new Set();

        /**
         * Merges plain-object data into a `StateStore`.
         * Non-plain values replace the current value and are returned unchanged.
         * @template T
         * @param {*} store The target store to merge into. It must already be a `StateStore`
         *   unless `options.allowFallback` is true.
         * @param {T} value The value to merge.
         * @param {{ deep?: boolean, allowFallback?: boolean }} [options] The merge options.
         * @param {boolean} [options.deep=false] Whether to recursively merge nested plain objects into nested stores.
         * @param {boolean} [options.allowFallback=false] Whether to wrap the value when the target is not already a `StateStore`.
         * @returns {StateStore|T} The updated store, or the original value.
         * @throws {TypeError} If `store` is not a `StateStore` and fallback is disabled.
         * @throws {TypeError} If the merged data contains a reserved `StateStore` key.
         */
        static merge(store, value, options = { deep: false, allowFallback: false }) {
            if (!(store instanceof StateStore)) {
                if (options.allowFallback) {
                    return StateStore.wrap(value, options);
                }

                throw new TypeError('First argument must be a StateStore instance');
            }

            if (!isPlainObject$1(value)) {
                return value;
            }

            for (const [key, val] of Object.entries(value)) {
                store[key] = options.deep ?
                    StateStore.merge(
                        store.has(key) ?
                            store.use(key).value :
                            undefined,
                        val,
                        {
                            ...options,
                            allowFallback: true,
                        },
                    ) :
                    val;
            }

            return store;
        }

        /**
         * Wraps a plain object in a `StateStore`.
         * Non-plain values are returned unchanged.
         * @template T
         * @param {T} value The value to wrap.
         * @param {{ deep?: boolean }} [options] The wrap options.
         * @param {boolean} [options.deep=false] Whether to recursively wrap nested plain objects.
         * @returns {StateStore|T} The wrapped store, or the original value.
         * @throws {TypeError} If the wrapped object contains a reserved `StateStore` key.
         */
        static wrap(value, options = { deep: false }) {
            if (value instanceof StateStore) {
                return value;
            }

            if (!isPlainObject$1(value)) {
                return value;
            }

            const store = new StateStore();

            for (const [key, val] of Object.entries(value)) {
                store[key] = options.deep ?
                    StateStore.wrap(val, options) :
                    val;
            }

            return store;
        }

        static #isReservedStateKey(key) {
            return typeof key === 'string' && (
                Object.prototype.hasOwnProperty.call(StateStore.prototype, key)
            );
        }

        /**
         * Creates a new callable `StateStore` proxy.
         */
        constructor() {
            super();

            return new Proxy(
                this,
                {
                    apply(target, thisArg, args) {
                        if (!args.length) {
                            return target;
                        }

                        return target.use(...args);
                    },
                    get(target, prop) {
                        if (typeof prop === 'symbol') {
                            return Reflect.get(target, prop, target);
                        }

                        if (StateStore.#isReservedStateKey(prop)) {
                            const value = Reflect.get(target, prop, target);

                            if (typeof value === 'function') {
                                return value.bind(target);
                            }

                            return value;
                        }

                        return target.#readKey(prop);
                    },
                    getOwnPropertyDescriptor(target, prop) {
                        const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

                        if (descriptor) {
                            return descriptor;
                        }

                        if (target.has(prop)) {
                            return {
                                configurable: true,
                                enumerable: true,
                                writable: true,
                                value: target.use(prop).value,
                            };
                        }

                        return undefined;
                    },
                    has(target, prop) {
                        if (typeof prop === 'symbol') {
                            return Reflect.has(target, prop);
                        }

                        return StateStore.#isReservedStateKey(prop) || target.has(prop);
                    },
                    ownKeys(target) {
                        const baseKeys = Reflect.ownKeys(target);
                        const stateKeys = target.keys();

                        return Array.from(
                            new Set([...baseKeys, ...stateKeys]),
                        );
                    },
                    set(target, prop, value) {
                        if (typeof prop === 'symbol') {
                            return Reflect.set(target, prop, value, target);
                        }

                        target.#assignKey(prop, value);

                        return true;
                    },
                },
            );
        }

        /**
         * Checks whether a state key exists in the store.
         * @param {string} key The state key.
         * @returns {boolean} Whether the key exists.
         */
        has(key) {
            return this.#visibleKeys.has(key);
        }

        /**
         * Retrieves the stored state keys.
         * Reserved API keys are not included.
         * @returns {IterableIterator<string>} The key iterator.
         */
        keys() {
            return this.#visibleKeys.values();
        }

        /**
         * Sets multiple keys from an object's own enumerable string properties.
         * @param {Record<string, *>} data The key/value pairs.
         * @throws {TypeError} If `data` contains a reserved `StateStore` key.
         */
        set(data) {
            for (const [key, value] of Object.entries(data)) {
                this.#assignKey(key, value);
            }
        }

        /**
         * Retrieves or creates a state by key.
         * Missing keys become visible only through this method, `set(...)`, or proxy assignment.
         * @template T
         * @param {string} key The state key.
         * @param {T} [defaultValue] The default value when creating.
         * @returns {StateAccessor<T>} The state accessor for the key.
         * @throws {TypeError} If `key` is reserved for the `StateStore` API.
         */
        use(key, defaultValue) {
            if (StateStore.#isReservedStateKey(key)) {
                throw new TypeError(`"${key}" is a reserved StateStore key`);
            }

            if (this.#state.has(key)) {
                const state = this.#state.get(key);

                if (!this.has(key)) {
                    this.#visibleKeys.add(key);

                    if (arguments.length > 1) {
                        state.value = defaultValue;
                    }
                }

                return state;
            }

            const state = useState(defaultValue);

            this.#state.set(key, state);
            this.#visibleKeys.add(key);

            return state;
        }

        #assignKey(key, value) {
            if (StateStore.#isReservedStateKey(key)) {
                throw new TypeError(`"${key}" is a reserved StateStore key`);
            }

            if (this.#state.has(key)) {
                this.#visibleKeys.add(key);
                this.#state.get(key).value = value;
                return;
            }

            const state = useState(value);

            this.#state.set(key, state);
            this.#visibleKeys.add(key);
        }

        #readKey(key) {
            if (this.#state.has(key)) {
                return this.#state.get(key).value;
            }

            if (!isTrackingEffects()) {
                return undefined;
            }

            const state = useState(undefined);

            this.#state.set(key, state);

            return state.value;
        }
    }

    const textarea = document.createElement('textarea');

    /**
     * Builds an evaluator for a binding expression.
     * @param {Component} component The component that owns the expression.
     * @param {string} expression The expression string to evaluate.
     * @param {*} [defaultValue] The fallback value to use when resolving a state path.
     * @returns {() => *} A callback that resolves the current expression value.
     */
    function evaluator(component, expression, defaultValue) {
        textarea.innerHTML = expression;
        expression = textarea.value.trim();

        if (!expression) {
            return () => null;
        }

        if (
            (expression.startsWith('{') && expression.endsWith('}')) ||
            (expression.startsWith('({') && expression.endsWith('})'))
        ) {
            expression = expression.slice(1, -1).trim();

            return Function.constructor(`return ${expression};`).bind(component);
        }

        return () => component.state(expression, defaultValue).value;
    }

    /**
     * Finds child components rendered within an element subtree.
     * @param {Component} component The root component.
     * @param {Element} element The element to scan.
     * @param {Component[]} [components=[]] The accumulator for discovered components.
     * @returns {Component[]} The collected child components.
     */
    function findChildren(component, element, components = []) {
        if (element.component && element.component !== component) {
            components.push(element.component);
        } else if (isComponent(element.tagName)) {
            components.push(element);
        } else if (element.tagName === 'SLOT') {
            const assigned = element.assignedElements({ flatten: true });
            for (const child of assigned) {
                findChildren(component, child, components);
            }
        } else {
            for (const child of element.children) {
                findChildren(component, child, components);
            }
        }

        return components;
    }
    /**
     * Finds the parent component of a component.
     * @param {Component} component The component to resolve.
     * @returns {Component|null} The parent component, or `null` if none exists.
     */
    function findParent(component) {
        if (component.component) {
            let parentComponent = component.component;
            while (parentComponent.component) {
                parentComponent = parentComponent.component;
            }
            return parentComponent;
        }

        const baseNode = component.initialized ?
            component.element :
            component;

        let parent = baseNode.parentNode;
        while (parent) {
            if (parent.component) {
                return parent.component;
            }

            if (parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE && parent.host) {
                parent = parent.host;
                continue;
            }

            if (parent.nodeType === Node.ELEMENT_NODE && isComponent(parent.tagName)) {
                return parent;
            }

            parent = parent.parentNode;
        }

        return null;
    }
    /**
     * Determines whether an element is a component.
     * @param {string} tagName The element tag name.
     * @returns {boolean} True when the tag name represents a component.
     */
    function isComponent(tagName) {
        return tagName.toLowerCase().startsWith('x-');
    }
    /**
     * Flattens a node list into a list of element nodes and their descendants.
     * @param {Iterable<Node>} nodes The nodes to flatten.
     * @returns {Element[]} The flattened element list.
     */
    function flattenElements(nodes) {
        return [...nodes].flatMap((node) => node.nodeType === Node.ELEMENT_NODE ?
            [node, ...node.querySelectorAll('*')] :
            [],
        );
    }
    /**
     * Finds the object in a prototype chain that owns a property.
     * @param {object} target The object to inspect.
     * @param {string} property The property name to resolve.
     * @param {object} [options] The lookup options.
     * @param {boolean} [options.includeSelf=true] Whether to start on the target itself.
     * @param {object|null} [options.stopAt=Object.prototype] The prototype at which to stop searching.
     * @returns {object|null} The owning object, or `null` if the property was not found before `stopAt`.
     */
    function findPropertyOwner(target, property, { includeSelf = true, stopAt = Object.prototype } = {}) {
        let owner = includeSelf ?
            target :
            Object.getPrototypeOf(target);

        while (owner && owner !== stopAt) {
            if (Object.prototype.hasOwnProperty.call(owner, property)) {
                return owner;
            }

            owner = Object.getPrototypeOf(owner);
        }

        return null;
    }
    /**
     * Determines whether a value is null or undefined.
     * @param {*} value The value to check.
     * @returns {boolean} True when the value is null or undefined.
     */
    function isEmpty(value) {
        return value === null || value === undefined;
    }
    /**
     * Determines whether a value is a plain object.
     * @param {*} value The value to check.
     * @returns {boolean} True when the value is a plain object.
     */
    function isPlainObject(value) {
        return value?.constructor === Object;
    }
    /**
     * Advances a TreeWalker to the next sibling outside the current subtree.
     * @param {TreeWalker} walker The TreeWalker instance to advance.
     * @returns {Node|null} The next node after the subtree, or null if none exists.
     */
    function skipSubtree(walker) {
        if (walker.nextSibling()) {
            return walker.currentNode;
        }

        while (walker.parentNode()) {
            if (walker.nextSibling()) {
                return walker.currentNode;
            }
        }

        return null;
    }

    /**
     * Binds an element subtree to a component.
     * @param {Component} component The component that owns bindings.
     * @param {Element} element The element subtree to bind.
     */
    function bind(component, element) {
        if (element.component && element.component !== component) {
            return;
        }

        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        );

        const bindElement = (node) => {
            for (const { name, value } of [...node.attributes]) {
                if (name.startsWith('.')) {
                    bindProperty(component, node, name, value);
                } else if (name.startsWith(':')) {
                    bindAttribute(component, node, name, value);
                } else if (name.startsWith('@')) {
                    bindEvent(component, node, name, value);
                } if (name.startsWith('x:bind')) {
                    bindInput(component, node, name, value);
                }
            }
        };

        let node = walker.currentNode;
        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.component && node.component !== component) {
                    // Skip subtrees owned by other components.
                    node = skipSubtree(walker);
                    continue;
                }

                bindElement(node);
            } else if (node.nodeType === Node.TEXT_NODE) {
                bindText(component, node);
            }

            node = walker.nextNode();
        }
    }
    /**
     * Binds a dynamic attribute to a component.
     * @param {Component} component The component that owns the binding.
     * @param {HTMLElement} element The target element.
     * @param {string} name The bound attribute name (including the ":" prefix).
     * @param {string} value The attribute expression string.
     */
    function bindAttribute(component, element, name, value) {
        element.removeAttribute(name);

        if (!value) {
            return;
        }

        const attribute = name.slice(1);
        const callback = evaluator(component, value);

        if (isComponent(element.tagName)) {
            component.effect(() => {
                const result = callback();

                if (element.initialized) {
                    if (attribute === 'state' && isPlainObject(result)) {
                        element.state.set(result);
                    } else {
                        element.state[attribute] = result;
                    }
                } else {
                    if (isEmpty(result)) {
                        element.removeAttribute(attribute);
                    } else {
                        element.setAttribute(attribute, JSON.stringify(result));
                    }
                }
            });
            return;
        }

        let previous;
        switch (attribute) {
            case 'class':
                component.effect(() => {
                    const result = callback();

                    if (previous) {
                        element.classList.remove(...previous);
                    }

                    if (isEmpty(result)) {
                        previous = null;
                    } else if (Array.isArray(result)) {
                        element.classList.add(...result);
                        previous = result;
                    } else if (isPlainObject(result)) {
                        const classes = Object.entries(result)
                            .filter(([_, value]) => !!value)
                            .map(([key, _]) => key);
                        element.classList.add(...classes);
                        previous = classes;
                    } else {
                        element.classList.add(result);
                        previous = [result];
                    }
                });
                break;
            case 'style':
                component.effect(() => {
                    const result = callback();

                    if (previous) {
                        for (const key of Object.keys(previous)) {
                            element.style[key] = '';
                        }
                    }

                    if (isEmpty(result)) {
                        previous = null;
                    } else if (isPlainObject(result)) {
                        for (const [key, value] of Object.entries(result)) {
                            element.style[key] = value;
                        }

                        previous = result;
                    } else {
                        element.style.cssText = result;
                        previous = null;
                    }
                });
                break;
            default:
                component.effect(() => {
                    const result = callback();

                    if (isEmpty(result)) {
                        element.removeAttribute(attribute);
                    } else {
                        element.setAttribute(attribute, result);
                    }
                });
                break;
        }
    }
    /**
     * Binds an event handler to a component.
     * @param {Component} component The component that owns the handler.
     * @param {HTMLElement} element The target element.
     * @param {string} name The event attribute name (including the "@" prefix).
     * @param {string} value The handler attribute value.
     */
    function bindEvent(component, element, name, value) {
        element.removeAttribute(name);

        const params = name.slice(1).split('.');
        const eventName = params.shift();
        const handlerValue = value?.trim();

        let callback;
        if (!handlerValue) {
            callback = () => { };
        } else if (handlerValue in component && typeof component[handlerValue] === 'function' && findPropertyOwner(component, handlerValue, {
            stopAt: HTMLElement.prototype,
        })) {
            callback = component[handlerValue].bind(component);
        } else if (handlerValue.startsWith('{') && handlerValue.endsWith('}')) {
            callback = Function.constructor('event', handlerValue.slice(1, -1)).bind(component);
        } else {
            const factory = Function.constructor(`"use strict"; return (${handlerValue})`);

            try {
                const probe = factory.call(Object.freeze({}));

                if (typeof probe !== 'function') {
                    throw new Error();
                }
            } catch {
                throw new Error(
                    `Event handler "${handlerValue}" must be a component method, function expression, or braced statement body`,
                );
            }

            callback = factory.call(component);

            if (callback.prototype !== undefined) {
                callback = callback.bind(component);
            }
        }

        const handler = (event) => {
            if (params.includes('self') && event.target !== event.currentTarget) {
                return;
            }

            if (params.includes('prevent')) {
                event.preventDefault();
            }

            if (params.includes('stop')) {
                event.stopPropagation();
            }

            callback(event);
        };

        const options = {
            once: params.includes('once'),
            capture: params.includes('capture'),
            passive: params.includes('passive'),
        };

        element.addEventListener(eventName, handler, options);
    }
    /**
     * Binds an input element to component state.
     * @param {Component} component The component that owns the state.
     * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} element The input element.
     * @param {string} name The binding attribute name (including the "x:bind" prefix).
     * @param {string} value The state key to bind.
     */
    function bindInput(component, element, name, value) {
        element.removeAttribute(name);

        if (!value) {
            return;
        }

        if (element.matches('select[multiple]')) {
            component.state(value, []);

            component.effect(() => {
                const values = component.state[value];
                for (const option of element.options) {
                    option.selected = Array.isArray(values) && values.includes(option.value);
                }
            });

            element.addEventListener('change', () => {
                component.state[value] = [...element.selectedOptions].map((option) => option.value);
            });
        } else if (element.matches('input[type="checkbox"]')) {
            component.state(value, false);

            component.effect(() => {
                if (Array.isArray(component.state[value])) {
                    element.checked = component.state[value].includes(element.value);
                } else {
                    element.checked = !!component.state[value];
                }
            });

            element.addEventListener('change', () => {
                if (Array.isArray(component.state[value])) {
                    if (element.checked) {
                        if (!component.state[value].includes(element.value)) {
                            component.state[value] = [...component.state[value], element.value];
                        }
                    } else {
                        component.state[value] = [...component.state[value].filter((value) => value != element.value)];
                    }
                } else {
                    component.state[value] = element.checked;
                }
            });
        } else if (element.matches('input[type="radio"]')) {
            component.effect(() => {
                element.checked = component.state[value] == element.value;
            });

            element.addEventListener('change', () => {
                if (element.checked) {
                    component.state[value] = element.value;
                } else if (component.state[value] == element.value) {
                    component.state[value] = undefined;
                }
            });
        } else if (element.matches('input, select, textarea')) {
            component.effect(() => {
                if (isEmpty(component.state[value])) {
                    element.value = '';
                } else {
                    element.value = component.state[value];
                }
            });

            element.addEventListener('change', () => {
                component.state[value] = element.value;
            });

            element.addEventListener('input', () => {
                component.state[value] = element.value;
            });
        }
    }
    /**
     * Binds a component expression to a DOM property.
     * @param {Component} component The component that owns the binding.
     * @param {HTMLElement} element The target element.
     * @param {string} name The bound property name (including the "." prefix).
     * @param {string} value The property expression string.
     */
    function bindProperty(component, element, name, value) {
        element.removeAttribute(name);

        if (!value) {
            return;
        }

        const property = name.slice(1)
            .replace(/-([a-z])/g, (_, char) => char.toUpperCase());

        if (findPropertyOwner(element, property, { includeSelf: false })) {
            throw new Error(`Property binding ".${property}" only supports custom properties`);
        }

        const callback = evaluator(component, value);

        component.effect(() => {
            const result = callback();
            if (isEmpty(result)) {
                delete element[property];
            } else {
                element[property] = result;
            }
        });
    }
    /**
     * Binds a text node to component expressions.
     * @param {Component} component The component that owns the bindings.
     * @param {Text} node The text node to bind.
     */
    function bindText(component, node) {
        const raw = node.textContent;
        if (!raw || !raw.includes('{')) {
            return;
        }

        const parts = [];
        let index = 0;

        while (index < raw.length) {
            const start = raw.indexOf('{', index);

            if (start === -1) {
                parts.push(raw.slice(index));
                break;
            }

            if (start > index) {
                parts.push(raw.slice(index, start));
            }

            const exprStart = start + 1;

            let stringChar = null;
            let escaped = false;
            let braceDepth = 0;
            let end = null;

            for (let i = exprStart; i < raw.length; i++) {
                const char = raw[i];

                if (stringChar) {
                    if (escaped) {
                        escaped = false;
                    } else if (char === '\\') {
                        escaped = true;
                    } else if (char === stringChar) {
                        stringChar = null;
                    }

                    continue;
                }

                if (char === '"' || char === '\'' || char === '`') {
                    stringChar = char;
                    continue;
                }

                if (char === '{') {
                    braceDepth++;
                    continue;
                }

                if (char === '}' && braceDepth > 0) {
                    braceDepth--;
                    continue;
                }

                if (char === '}' && braceDepth === 0) {
                    end = i;
                    break;
                }
            }

            if (end === null) {
                parts.push(raw.slice(start));
                break;
            }

            const inner = raw.slice(exprStart, end).trim();

            if (inner) {
                parts.push(evaluator(component, inner));
            }

            index = end + 1;
        }

        if (parts.every((part) => typeof part === 'string')) {
            return;
        }

        component.effect(() => {
            node.textContent = parts
                .map((part) => typeof part === 'string' ? part : part())
                .join('');
        });
    }

    /**
     * @typedef {object} ConditionalCase
     * @property {string} condition The condition expression for the case.
     * @property {Element} element The template element for the case.
     * @property {Comment} start The start marker for the case.
     * @property {Comment} end The end marker for the case.
     */

    /**
     * @typedef {object} LoopBlock
     * @property {string} iterable The expression that resolves to the loop items.
     * @property {string} identifier The property name used as the item key.
     * @property {Component} element The component template cloned for each item.
     * @property {Comment} start The start marker for the loop block.
     * @property {Comment} end The end marker for the loop block.
     */

    /**
     * Parses top-level conditional and loop blocks from an element subtree.
     * @param {Element} element The root element to parse.
     * @param {ConditionalCase[][]} [conditionals=[]] The collected conditional blocks.
     * @param {LoopBlock[]} [loops=[]] The collected loop blocks.
     * @returns {[ConditionalCase[][], LoopBlock[]]} The collected conditionals and loops.
     */
    function parseBlocks(element, conditionals = [], loops = []) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode(node) {
                    return (node.hasAttribute('x:if') || node.hasAttribute('x:each')) ?
                        NodeFilter.FILTER_ACCEPT :
                        NodeFilter.FILTER_SKIP;
                },
            },
        );

        let node = walker.nextNode();
        while (node) {
            const hasConditional = node.hasAttribute('x:if');
            const hasLoop = node.hasAttribute('x:each');

            if (hasConditional && hasLoop) {
                throw new Error('Conditional elements cannot be looped');
            }

            if (hasConditional) {
                conditionals.push(parseConditional(node));
            } else if (hasLoop) {
                loops.push(parseLoop(node));
            }

            node = skipSubtree(walker);
        }

        return [conditionals, loops];
    }
    /**
     * Parses a conditional element.
     * @param {Element} element The element to parse.
     * @returns {ConditionalCase[]} The conditional cases for the element.
     */
    function parseConditional(element) {
        const condition = element.getAttribute('x:if');
        element.removeAttribute('x:if');

        const start = document.createComment(`if[${condition}]`);
        const end = document.createComment(`/if[${condition}]`);

        element.parentNode.insertBefore(start, element);
        element.parentNode.insertBefore(end, element);

        const cases = [];
        cases.push({ condition, element, start, end });

        let next = element;
        while (next = next.nextElementSibling) {
            if (next.hasAttribute('x:else-if')) {
                const condition = next.getAttribute('x:else-if');
                next.removeAttribute('x:else-if');

                const start = document.createComment(`else-if[${condition}]`);
                const end = document.createComment(`/else-if[${condition}]`);

                next.parentNode.insertBefore(start, next);
                next.parentNode.insertBefore(end, next);

                cases.push({ condition, element: next, start, end });
                continue;
            }

            if (next.hasAttribute('x:else')) {
                next.removeAttribute('x:else');

                const start = document.createComment(`else`);
                const end = document.createComment(`/else`);

                next.parentNode.insertBefore(start, next);
                next.parentNode.insertBefore(end, next);

                cases.push({ condition: '{true}', element: next, start, end });
            }

            break;
        }

        for (const { element } of cases) {
            element.remove();
        }

        return cases;
    }
    /**
     * Parses a loop element.
     * @param {Element} element The element to parse as a loop block.
     * @returns {LoopBlock} The parsed loop metadata.
     */
    function parseLoop(element) {
        if (!isComponent(element.tagName)) {
            throw new Error('Loop elements must be components');
        }

        const iterable = element.getAttribute('x:each') || 'items';
        const identifier = element.getAttribute('x:id') || 'id';
        element.removeAttribute('x:each');
        element.removeAttribute('x:id');

        const start = document.createComment(`each[${iterable}]`);
        const end = document.createComment(`/each[${iterable}]`);

        element.parentNode.insertBefore(start, element);
        element.parentNode.insertBefore(end, element);
        element.remove();

        return { iterable, identifier, element, start, end };
    }
    /**
     * Processes conditional elements.
     * @param {Component} component The component that owns the conditionals.
     * @param {ConditionalCase[][]} conditionals The conditional cases to evaluate.
     */
    function processConditionals(component, conditionals) {
        for (const cases of conditionals) {
            const conditions = [];
            for (const { condition, element, end } of cases) {
                const data = {
                    attached: false,
                    callback: evaluator(component, condition),
                    element,
                    end,
                };

                conditions.push(data);

                if (isComponent(element.tagName)) {
                    element.addEventListener('initialized', () => {
                        data.element = element.element;
                    }, { once: true });
                }
            }

            component.effect(() => {
                let matched = false;
                for (const condition of conditions) {
                    const result = !matched && condition.callback();

                    if (result) {
                        if (!condition.attached) {
                            const [nestedConditionals, nestedLoops] = parseBlocks(condition.element);

                            bind(component, condition.element);
                            processConditionals(component, nestedConditionals);
                            processLoops(component, nestedLoops);

                            condition.attached = true;
                        }

                        condition.end.parentNode.insertBefore(condition.element, condition.end);

                        matched = true;
                    } else {
                        condition.element.remove();
                    }
                }
            });
        }
    }
    /**
     * Processes loop elements.
     * @param {Component} component The component that owns the loops.
     * @param {LoopBlock[]} loops The loop descriptors to render.
     */
    function processLoops(component, loops) {
        for (const { iterable, identifier, element, end } of loops) {
            let loopComponents = {};
            const callback = evaluator(component, iterable, []);
            component.effect(() => {
                const items = callback();

                if (!Array.isArray(items)) {
                    throw new Error(`Iterable "${iterable}" must be an array`);
                }

                const previousComponents = { ...loopComponents };

                loopComponents = {};

                for (const item of items) {
                    if (!(identifier in item)) {
                        throw new Error(`Item in "${iterable}" must have a "${identifier}" property`);
                    }

                    const id = item[identifier];

                    if (id in loopComponents) {
                        throw new Error(`Duplicate identifier "${id}" in "${iterable}"`);
                    }

                    let loopComponent;
                    if (id in previousComponents && previousComponents[id].initialized) {
                        loopComponent = previousComponents[id];
                        loopComponent.state.set(item);

                        end.parentNode.insertBefore(loopComponent.element, end);
                    } else {
                        loopComponent = element.cloneNode(true);
                        loopComponent.setAttribute('state', JSON.stringify(item));

                        const [nestedConditionals, nestedLoops] = parseBlocks(loopComponent);

                        bind(component, loopComponent);
                        processConditionals(component, nestedConditionals);
                        processLoops(component, nestedLoops);

                        end.parentNode.insertBefore(loopComponent, end);
                    }

                    loopComponents[id] = loopComponent;
                }

                for (const [id, loopComponent] of Object.entries(previousComponents)) {
                    if (id in loopComponents) {
                        continue;
                    }

                    if (loopComponent.initialized) {
                        loopComponent.element.remove();
                    } else {
                        loopComponent.remove();
                    }
                }
            });
        }
    }

    /**
     * Collects elements keyed by `x:key`.
     * @param {Element} element The element to scan for keys.
     * @returns {Object.<string, Element>} The key-to-element map.
     * @throws {Error} When duplicate keys are found.
     */
    function parseElements(element) {
        const elements = [...element.querySelectorAll('[x\\:key]')];

        if (element.matches('[x\\:key]')) {
            elements.unshift(element);
        }

        const result = {};

        for (const element of elements) {
            const key = element.getAttribute('x:key');
            element.removeAttribute('x:key');

            if (!key) {
                continue;
            }

            if (key in result) {
                throw new Error(`Duplicate key element "${key}"`);
            }

            result[key] = element;
        }

        return result;
    }

    /**
     * Replaces descendant `<slot>` elements with comment markers.
     * @param {Element} element The element to scan for slots.
     * @returns {Object.<string, {
     *   start: Comment,
     *   end: Comment,
     *   assign: function(Node): void,
     *   assigned: function(): Node[]
     * }>} The slot map keyed by slot name.
     */
    function parseSlots(element) {
        const slotMarkers = [...element.querySelectorAll('slot')]
            .map((slot) => {
                const name = slot.getAttribute('name') || '';

                const start = document.createComment(`slot[${name}]`);
                const end = document.createComment(`/slot[${name}]`);

                const assign = (node) => {
                    if (!end.parentNode) {
                        return;
                    }

                    end.parentNode.insertBefore(node, end);
                };

                const assigned = () => {
                    let current = start;
                    const nodes = [];
                    while (current = current.nextSibling) {
                        if (current.isSameNode(end)) {
                            break;
                        }

                        nodes.push(current);
                    }

                    return nodes;
                };

                slot.parentNode.insertBefore(start, slot);
                slot.parentNode.insertBefore(end, slot);
                slot.remove();

                return [name, { start, end, assign, assigned }];
            });

        return Object.fromEntries(slotMarkers);
    }
    /**
     * Moves a component's light-DOM children into their matching slot markers.
     * @param {Component} component The component whose children are slotted.
     */
    function processSlots(component) {
        for (const element of [...component.childNodes]) {
            let name = '';
            if (element.nodeType === Node.ELEMENT_NODE) {
                name = element.getAttribute('slot') || '';
                element.removeAttribute('slot');
            }

            const slot = component.slot(name);

            if (!slot) {
                continue;
            }

            slot.assign(element);
        }}

    /**
     * Parses component state from non-framework attributes and removes them from the host.
     * @param {Component} component The component to populate with state.
     */
    function parseState(component) {
        for (const attr of [...component.attributes]) {
            if (attr.name.startsWith('x:')) {
                continue;
            }

            let value;
            try {
                value = Function.constructor(`return ${attr.value};`).call(component);
            } catch {
                value = attr.value;
            }

            if (attr.name === 'state' && isPlainObject(value)) {
                component.state.set(value);
            } else {
                component.state[attr.name] = value;
            }

            component.removeAttribute(attr.name);
        }
    }

    const loaded = {};
    const loadedScripts = {};
    const loadedStylesheets = {};

    const shadowStyleBlocks = new WeakMap();
    const shadowStylesheets = new WeakMap();

    /**
     * Gets the cached shadow style blocks for a component class.
     * @param {typeof import('./component.js').default} ComponentClass The component constructor.
     * @returns {HTMLStyleElement[]} The cached style blocks.
     */
    function getShadowStyleBlocks(ComponentClass) {
        let styleBlocks = shadowStyleBlocks.get(ComponentClass);

        if (!styleBlocks) {
            styleBlocks = [];
            shadowStyleBlocks.set(ComponentClass, styleBlocks);
        }

        return styleBlocks;
    }

    /**
     * Gets the cached shadow stylesheets for a component class.
     * @param {typeof import('./component.js').default} ComponentClass The component constructor.
     * @returns {HTMLLinkElement[]} The cached stylesheet links.
     */
    function getShadowStylesheets(ComponentClass) {
        let stylesheets = shadowStylesheets.get(ComponentClass);

        if (!stylesheets) {
            stylesheets = [];
            shadowStylesheets.set(ComponentClass, stylesheets);
        }

        return stylesheets;
    }

    /**
     * Sets the cached shadow assets for a component class.
     * @param {typeof import('./component.js').default} ComponentClass The component constructor.
     * @param {object} [options] The shadow asset options.
     * @param {HTMLStyleElement[]} [options.styleBlocks=[]] The shadow style blocks.
     * @param {HTMLLinkElement[]} [options.stylesheets=[]] The shadow stylesheet links.
     */
    function setShadowAssets(ComponentClass, { styleBlocks = [], stylesheets = [] } = {}) {
        shadowStyleBlocks.set(ComponentClass, [...styleBlocks]);
        shadowStylesheets.set(ComponentClass, [...stylesheets]);
    }

    /**
     * Base custom element class for Frost components.
     */
    class Component extends HTMLElement {
        static shadowMode = null;

        #connected = false;
        #effects = new Set();
        #initialized = false;
        #loaded = false;
        #loadedGates = new Set();
        #mounted = false;
        #pendingEffects = new Set();
        #rootElement;
        #shadowRoot;
        #slots;
        #state = new StateStore();
        #visible = false;

        /**
         * Gets the template.
         * @returns {string} The component template markup.
         */
        static get template() {
            return '<div><slot></slot></div>';
        }

        /**
         * Creates a new component instance.
         */
        constructor() {
            super();

            if (!isComponent(this.tagName)) {
                throw new Error('Components must begin with "x-"');
            }

            this.#shadowRoot = this.constructor.shadowMode ?
                this.attachShadow({
                    mode: this.constructor.shadowMode,
                }) :
                null;

            this.#rootElement = this.render();
            this.#rootElement.component = this;
            this.#rootElement.setAttribute('x:component', this.tagName.toLowerCase());

            Object.assign(this, parseElements(this.#rootElement));

            this.#slots = this.#shadowRoot ? {} : parseSlots(this.#rootElement);

            if (this.#shadowRoot) {
                const fragment = document.createDocumentFragment();
                const stylesheets = getShadowStylesheets(this.constructor);
                const styleBlocks = getShadowStyleBlocks(this.constructor);

                for (const stylesheet of stylesheets) {
                    fragment.appendChild(stylesheet.cloneNode(true));
                }

                for (const styleBlock of styleBlocks) {
                    fragment.appendChild(styleBlock.cloneNode(true));
                }

                this.#shadowRoot.appendChild(fragment);
            }
        }

        /**
         * Gets the child components.
         * @returns {Component[]} The child components rendered within this component.
         */
        get childComponents() {
            return findChildren(this, this.#rootElement);
        }

        /**
         * Determines whether the component is connected.
         * @returns {boolean} True when the component is connected.
         */
        get connected() {
            return this.#connected;
        }

        /**
         * Gets the element rendered by the component.
         * @returns {Element} The rendered element, or the host element in shadow mode.
         */
        get element() {
            if (this.#shadowRoot) {
                return this;
            }

            let element = this.#rootElement;
            while (isComponent(element.tagName) && element.rootElement && element.renderRoot === element.rootElement) {
                element = element.rootElement;
            }

            return element;
        }

        /**
         * Determines whether the component is initialized.
         * @returns {boolean} True when the component is initialized.
         */
        get initialized() {
            return this.#initialized;
        }

        /**
         * Determines whether the component has fully loaded.
         * @returns {boolean} True when the component has fully loaded.
         */
        get loaded() {
            return this.#loaded;
        }

        /**
         * Determines whether the component is mounted.
         * @returns {boolean} True when the component is mounted.
         */
        get mounted() {
            return this.#mounted;
        }

        /**
         * Gets the parent component.
         * @returns {Component|null} The parent component, or `null` if none exists.
         */
        get parentComponent() {
            return findParent(this);
        }

        /**
         * Gets the node that contains the rendered output.
         * @returns {ShadowRoot|Element} The shadow root in shadow mode, otherwise the root element.
         */
        get renderRoot() {
            return this.#shadowRoot || this.#rootElement;
        }

        /**
         * Gets the rendered root element.
         * @returns {Element} The rendered root element.
         */
        get rootElement() {
            return this.#rootElement;
        }

        /**
         * Gets the state store.
         * @returns {StateStore} The component state store.
         */
        get state() {
            return this.#state;
        }

        /**
         * Determines whether the component is visible.
         * @returns {boolean} True when the component is visible.
         */
        get visible() {
            return this.#visible;
        }

        /**
         * Handles the custom element connection lifecycle.
         */
        connectedCallback() {
            if (this.#initialized && !this.#shadowRoot) {
                throw new Error('A component cannot be reattached after it has been initialized');
            }

            if (this.#initialized) {
                this.onConnected();
                return;
            }

            const parentComponent = this.parentComponent;

            // don't initialize slot components until they have been assigned
            if (parentComponent && parentComponent.contains(this) && parentComponent.renderRoot === parentComponent.rootElement) {
                parentComponent.addEventListener('initialized', () => {
                    if (this.#connected || parentComponent.renderRoot !== parentComponent.rootElement || !parentComponent.contains(this)) {
                        return;
                    }

                    this.connectedCallback();
                }, { once: true });
                return;
            }

            setTimeout(() => {
                if (this.#connected || !this.isConnected || !this.parentNode) {
                    return;
                }

                this.#connected = true;
                this.onConnected();

                const event = new Event('connected');
                this.dispatchEvent(event);

                const parentComponent = this.parentComponent;

                const initializedPromise = parentComponent && !parentComponent.initialized ?
                    new Promise((resolve) => {
                        parentComponent.addEventListener('initialized', resolve, { once: true });
                    }) :
                    Promise.resolve();

                initializedPromise.then(() => {
                    if (!this.isConnected || !this.parentNode) {
                        return;
                    }

                    this.addEventListener('mounted', () => {
                        this.#mounted = true;
                        this.#visible = true;

                        for (const { effect } of this.#pendingEffects) {
                            effect.sync();
                        }

                        this.#pendingEffects.clear();
                    });

                    this.addEventListener('dismounted', () => {
                        this.#mounted = false;
                    });

                    this.addEventListener('visible', () => {
                        this.#visible = true;

                        for (const { effect } of this.#pendingEffects) {
                            effect.sync();
                        }

                        this.#pendingEffects.clear();
                    });

                    this.addEventListener('invisible', () => {
                        this.#visible = false;
                    });

                    // extract outer conditionals/loops
                    const [conditionals, loops] = parseBlocks(this.#rootElement);

                    parseState(this);

                    if (this.#shadowRoot) {
                        this.#shadowRoot.appendChild(this.#rootElement);
                    } else {
                        processSlots(this);

                        // replace element
                        this.parentNode.insertBefore(this.#rootElement, this);
                        this.remove();
                    }

                    this.#initialized = true;

                    // mark component as mounted/visible, so effects will run the first time
                    this.#mounted = true;
                    this.#visible = true;

                    this.initialize();

                    bind(this, this.#rootElement);
                    processConditionals(this, conditionals);
                    processLoops(this, loops);

                    const event = new Event('initialized');
                    this.dispatchEvent(event);

                    const loadedPromises = this.childComponents
                        .filter((component) => !component.loaded)
                        .map((component) =>
                            new Promise((resolve) => {
                                component.addEventListener('loaded', resolve, { once: true });
                            }),
                        );

                    const awaitGates = () => {
                        if (!this.#loadedGates.size) {
                            return Promise.resolve();
                        }

                        const promises = [...this.#loadedGates];
                        return Promise.allSettled(promises).then(awaitGates);
                    };

                    Promise.all(loadedPromises).then(awaitGates).then(() => {
                        this.#loaded = true;

                        const event = new Event('loaded');
                        this.dispatchEvent(event);
                    });
                });
            }, 0);
        }

        /**
         * Registers a promise to defer the loaded event.
         * @param {Promise<*>} promise The promise to await before marking the component as loaded.
         */
        deferLoad(promise) {
            if (this.loaded) {
                throw new Error('Loading cannot be deferred after the component has loaded');
            }

            const guarded = promise.catch(() => { });

            this.#loadedGates.add(guarded);

            guarded.finally(() => {
                this.#loadedGates.delete(guarded);
            });
        }

        /**
         * Dispatches a bubbling composed custom event from the component's public DOM node.
         * @param {string} name The custom event name.
         * @param {*} [detail={}] The event detail payload.
         */
        dispatch(name, detail = {}) {
            const event = new CustomEvent(name, {
                detail,
                bubbles: true,
                composed: true,
            });

            this.element.dispatchEvent(event);
        }

        /**
         * Registers an effect callback.
         * @param {() => void} callback The effect callback to register.
         * @param {object} [options] The effect options.
         * @param {boolean} [options.skipInvisible=true] Whether to skip effects when invisible.
         */
        effect(callback, { skipInvisible = true } = {}) {
            const ref = {};
            const effect = useEffect(() => {
                if (!this.#mounted || (skipInvisible && !this.#visible)) {
                    this.#pendingEffects.add(ref);
                    return;
                }

                callback();
            }, { weak: true });

            ref.effect = effect;

            this.#effects.add(effect);
        }

        /**
         * Lifecycle hook that runs after the component has been rendered and bound.
         */
        initialize() {

        }

        /**
         * Lifecycle hook that runs when the component actually connects.
         * Runs on the initial connection and on later shadow-mode reconnections.
         */
        onConnected() {

        }

        /**
         * Executes a callback when the component has fully loaded.
         * @param {() => void} callback The callback to execute.
         */
        ready(callback) {
            if (this.loaded) {
                callback();
            } else {
                this.addEventListener('loaded', callback, { once: true });
            }
        }

        /**
         * Renders the component element.
         * @returns {Element} The rendered root element.
         * @throws {Error} When the template does not render exactly one non-slot root element.
         */
        render() {
            const fragment = document.createRange()
                .createContextualFragment(this.constructor.template);

            if (this.constructor.shadowMode) {
                const styleBlocks = getShadowStyleBlocks(this.constructor);
                const stylesheets = getShadowStylesheets(this.constructor);

                for (const node of fragment.children) {
                    if (node.matches('style')) {
                        if (!styleBlocks.some((block) => block.isEqualNode(node))) {
                            styleBlocks.push(node);
                        }

                        node.remove();
                    } else if (node.matches('link[rel="stylesheet"]')) {
                        if (!stylesheets.some((sheet) => sheet.isEqualNode(node))) {
                            stylesheets.push(node);
                        }

                        node.remove();
                    }
                }
            }

            if (fragment.childElementCount !== 1) {
                throw new Error('Components must only render a single element');
            }

            if (fragment.firstElementChild.matches('slot')) {
                throw new Error('Components cannot render a root slot element');
            }

            return fragment.firstElementChild;
        }

        /**
         * Gets a slot definition.
         * @param {string} [name=''] The slot name.
         * @returns {{
         *   start: Comment,
         *   end: Comment,
         *   assign: function(Node): void,
         *   assigned: function(): Node[]
         * }|undefined} The slot definition, or `undefined` if the slot is missing.
         */
        slot(name = '') {
            return this.#slots[name];
        }
    }

    /**
     * Parses a shadow mode directive from comment nodes.
     * @param {HTMLElement} container The container element to scan.
     * @returns {'open'|'closed'|null} The parsed shadow mode, or `null` if none was declared.
     */
    function parseShadowMode(container) {
        for (const node of [...container.childNodes]) {
            if (node.nodeType !== Node.COMMENT_NODE) {
                continue;
            }

            const value = node.nodeValue?.trim().toLowerCase();
            if (value === 'shadow' || value === 'shadow:open') {
                node.remove();
                return 'open';
            }

            if (value === 'shadow:closed') {
                node.remove();
                return 'closed';
            }
        }

        return null;
    }

    /**
     * Defines a component class from its HTML template.
     * @param {string} tagName The custom element tag name.
     * @param {string} html The HTML template string.
     * @returns {Promise<void>} A promise that resolves once the component is defined.
     */
    function define(tagName, html) {
        if (!isComponent(tagName)) {
            throw new Error('Components must begin with "x-"');
        }

        if (customElements.get(tagName)) {
            throw new Error('Element has already been defined');
        }

        const container = document.createElement('div');
        container.innerHTML = html;
        const componentShadowMode = parseShadowMode(container);

        const elements = container.querySelectorAll(':scope > :not(script, link[rel="stylesheet"], style)');

        if (elements.length != 1) {
            throw new Error('Components must render a single element');
        }

        const sourceScripts = container.querySelectorAll(':scope > script[src]');
        const connectedScripts = container.querySelectorAll(':scope > script[connected]:not([src])');
        const initializedScripts = container.querySelectorAll(':scope > script:not([connected], [src])');
        const stylesheets = container.querySelectorAll(':scope > link[rel="stylesheet"]');
        const styleBlocks = container.querySelectorAll(':scope > style');

        // load scripts
        const promises = [...sourceScripts]
            .map((node) => {
                const src = node.getAttribute('src');

                if (!(src in loadedScripts)) {
                    const script = document.createElement('script');

                    script.setAttribute('src', src);
                    script.setAttribute('type', 'text/javascript');
                    script.setAttribute('async', 'false');

                    loadedScripts[src] = new Promise((resolve, reject) => {
                        script.onload = resolve;
                        script.onerror = () => {
                            script.remove();
                            reject(new Error(`Failed to load script "${src}"`));
                        };
                    });

                    loadedScripts[src] = loadedScripts[src].catch((error) => {
                        delete loadedScripts[src];
                        throw error;
                    });

                    document.head.appendChild(script);
                }

                return loadedScripts[src];
            });

        // load stylesheets/style blocks
        if (componentShadowMode) ; else {
            for (const stylesheet of stylesheets) {
                const href = stylesheet.getAttribute('href');

                if (loadedStylesheets[href]) {
                    continue;
                }

                loadedStylesheets[href] = true;

                document.head.appendChild(stylesheet);
            }

            for (const styleBlock of styleBlocks) {
                document.head.appendChild(styleBlock);
            }
        }

        return Promise.all(promises).then(() => {
            const ComponentClass = class extends Component {
                static shadowMode = componentShadowMode;

                initialize() {
                    super.initialize();

                    for (const script of initializedScripts) {
                        Function.constructor(script.innerText).call(this);
                    }
                }

                onConnected() {
                    super.onConnected();

                    for (const script of connectedScripts) {
                        Function.constructor(script.innerText).call(this);
                    }
                }

                render() {
                    return elements[0].cloneNode(true);
                }
            };

            setShadowAssets(ComponentClass, {
                stylesheets,
                styleBlocks,
            });

            customElements.define(tagName, ComponentClass);
            loaded[tagName] = true;
        });
    }
    /**
     * Starts loading undefined components found in a node collection.
     * @param {Iterable<Node>} nodes The nodes to scan for components.
     * @param {object} [options] The options for loading components.
     * @param {string|null} [options.baseUrl=null] The base URL to fetch component templates.
     * @param {string|null} [options.extension=null] The file extension to append to component URLs.
     */
    function load(nodes, { baseUrl = null, extension = null } = {}) {
        if (!baseUrl) {
            throw new Error('Base URL for components is not set');
        }

        for (const node of nodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) {
                continue;
            }

            const tagName = node.tagName.toLowerCase();

            if (!isComponent(tagName) || customElements.get(tagName)) {
                continue;
            }

            if (loaded[tagName]) {
                continue;
            }

            loaded[tagName] = true;

            const url = `${baseUrl}/${tagName}${extension ? '.' + extension : ''}`;

            fetch(url)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Failed to load component "${tagName}" (${response.status})`);
                    }

                    return response.text();
                })
                .then((content) => {
                    return define(tagName, content);
                })
                .catch((error) => {
                    delete loaded[tagName];
                    throw error;
                });
        }
    }

    /**
     * Provides fallback content while child components load.
     */
    class Suspense extends Component {
        /**
         * Gets the component template.
         * @returns {string} The component template markup.
         */
        static get template() {
            return `
            <div>
                <div x:key="fallback">
                    <slot name="fallback"></slot>
                </div>
                <div x:key="content" style="display: none;">
                    <slot></slot>
                </div>
            </div>
        `;
        }

        /**
         * Swaps fallback content for the assigned content once child components finish loading.
         */
        initialize() {
            super.initialize();

            for (const template of [...this.fallback.querySelectorAll('template')]) {
                template.replaceWith(template.content.cloneNode(true));
            }

            const pending = findChildren(this, this.content)
                .filter((child) => !child.loaded)
                .map((child) => new Promise((resolve) => {
                    child.addEventListener('loaded', resolve, { once: true });
                }));

            Promise.all(pending).then(() => {
                if (!this.rootElement.parentNode) {
                    return;
                }

                const nodes = this.slot().assigned();
                for (const node of nodes) {
                    this.rootElement.parentNode.insertBefore(node, this.rootElement);
                }
                this.rootElement.remove();
            });
        }
    }

    const observedShadowRoots = new WeakSet();
    let mutationObserver;
    let intersectionObserver;
    let currentBaseUrl = null;
    let currentExtension = null;
    let pendingBootstrapCallback = null;

    /**
     * Loads undefined component elements in a node collection when autoload is enabled.
     * @param {Iterable<Node>} nodes The nodes to scan for components.
     */
    const loadComponents = (nodes) => {
        if (!currentBaseUrl || !nodes.length) {
            return;
        }

        load(nodes, { baseUrl: currentBaseUrl, extension: currentExtension });
    };

    /**
     * Starts observing a shadow-mode component host after it has initialized.
     * @param {Element} node The potential component host to observe.
     */
    const mountShadowHost = (node) => {
        if (!isComponent(node.tagName) || (node.initialized && !(node.renderRoot instanceof ShadowRoot))) {
            return;
        }

        const callback = () => {
            if (!(node.renderRoot instanceof ShadowRoot)) {
                return;
            }

            const renderRoot = node.renderRoot;

            node.dispatchEvent(new Event('mounted'));
            intersectionObserver.observe(node);

            if (!observedShadowRoots.has(renderRoot)) {
                observedShadowRoots.add(renderRoot);
                mutationObserver.observe(renderRoot, {
                    childList: true,
                    subtree: true,
                });
            }

            const elements = renderRoot.querySelectorAll('*');

            loadComponents(elements);

            for (const element of elements) {
                mountShadowHost(element);
            }
        };

        if (node.initialized) {
            callback();
        } else {
            node.addEventListener('initialized', callback, { once: true });
        }
    };

    /**
     * Stops observing a shadow-mode component host and its rendered descendants.
     * @param {Element} node The component host to dismount.
     */
    const dismountShadowHost = (node) => {
        if (!isComponent(node.tagName) || !(node.renderRoot instanceof ShadowRoot)) {
            return;
        }

        const renderRoot = node.renderRoot;

        node.dispatchEvent(new Event('dismounted'));
        intersectionObserver.unobserve(node);

        const elements = renderRoot.querySelectorAll('*');

        for (const element of elements) {
            if (element.component) {
                element.component.dispatchEvent(new Event('dismounted'));
                intersectionObserver.unobserve(element);
            } else {
                dismountShadowHost(element);
            }
        }
    };

    const bootstrapCallback = () => {
        const elements = document.body.querySelectorAll(':not(script, link[rel="stylesheet"], style)');

        for (const script of document.querySelectorAll('script[src]')) {
            const src = script.getAttribute('src');
            loadedScripts[src] = Promise.resolve();
        }

        for (const stylesheet of document.querySelectorAll('link[rel="stylesheet"]')) {
            const href = stylesheet.getAttribute('href');
            loadedStylesheets[href] = true;
        }

        if (!intersectionObserver) {
            intersectionObserver = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (isComponent(entry.target.tagName) && entry.isIntersecting !== entry.target.visible) {
                        const event = new Event(entry.isIntersecting ? 'visible' : 'invisible');
                        entry.target.dispatchEvent(event);
                    }

                    if (entry.target.component && entry.isIntersecting !== entry.target.component.visible) {
                        const event = new Event(entry.isIntersecting ? 'visible' : 'invisible');
                        entry.target.component.dispatchEvent(event);
                    }
                }
            });
        }

        if (!mutationObserver) {
            mutationObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type !== 'childList') {
                        continue;
                    }

                    const addedNodes = flattenElements(mutation.addedNodes);
                    const removedNodes = flattenElements(mutation.removedNodes);

                    loadComponents(addedNodes);

                    for (const node of addedNodes) {
                        if (!node.isConnected) {
                            continue;
                        }

                        if (isComponent(node.tagName)) {
                            mountShadowHost(node);
                        }

                        if (node.component) {
                            node.component.dispatchEvent(new Event('mounted'));
                            intersectionObserver.observe(node);
                        }
                    }

                    for (const node of removedNodes) {
                        if (node.isConnected) {
                            continue;
                        }

                        dismountShadowHost(node);

                        if (node.component) {
                            node.component.dispatchEvent(new Event('dismounted'));
                            intersectionObserver.unobserve(node);
                        }
                    }
                }
            });

            for (const element of elements) {
                mountShadowHost(element);
            }

            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
            });
        }

        loadComponents(elements);
    };

    /**
     * Bootstraps DOM observation, built-in components, and optional autoloading.
     * @param {object} [options] The bootstrap options.
     * @param {string|null} [options.baseUrl] The base URL to fetch component templates. Omit to preserve the current setting.
     * @param {string|null} [options.extension] The file extension to append to component URLs. Omit to preserve the current setting.
     */
    function bootstrap(options = {}) {
        if (!customElements.get('x-suspense')) {
            customElements.define('x-suspense', Suspense);
        }

        if (Object.hasOwn(options, 'baseUrl')) {
            currentBaseUrl = options.baseUrl;
        }

        if (Object.hasOwn(options, 'extension')) {
            currentExtension = options.extension;
        }

        if (document.body) {
            if (pendingBootstrapCallback) {
                document.removeEventListener('DOMContentLoaded', pendingBootstrapCallback);
                pendingBootstrapCallback = null;
            }

            bootstrapCallback();
        } else if (!pendingBootstrapCallback) {
            pendingBootstrapCallback = () => {
                pendingBootstrapCallback = null;
                bootstrapCallback();
            };

            document.addEventListener('DOMContentLoaded', pendingBootstrapCallback, { once: true });
        }
    }

    Component.bootstrap = bootstrap;

    return Component;

}));
//# sourceMappingURL=frost-component.js.map
