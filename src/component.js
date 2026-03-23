import { StateStore, useEffect } from '@fr0st/state';
import { bind } from './bind.js';
import { parseBlocks, processConditionals, processLoops } from './blocks.js';
import { parseElements } from './element.js';
import { findChildren, findParent, isComponent } from './helpers.js';
import { parseSlots, processSlots } from './slots.js';
import { parseState } from './state.js';
import { getShadowStyleBlocks, getShadowStylesheets } from './vars.js';

/**
 * Base custom element class for Frost components.
 */
export default class Component extends HTMLElement {
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
