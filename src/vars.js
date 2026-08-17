/**
 * Boolean attributes defined by the HTML standard.
 * @type {Set<string>}
 */
export const booleanAttributes = new Set([
    'allowfullscreen',
    'alpha',
    'async',
    'autofocus',
    'autoplay',
    'checked',
    'controls',
    'default',
    'defer',
    'disabled',
    'formnovalidate',
    'headingreset',
    'inert',
    'ismap',
    'itemscope',
    'loop',
    'multiple',
    'muted',
    'nomodule',
    'novalidate',
    'open',
    'playsinline',
    'readonly',
    'required',
    'reversed',
    'selected',
    'shadowrootclonable',
    'shadowrootcustomelementregistry',
    'shadowrootdelegatesfocus',
    'shadowrootserializable',
]);

export const loaded = {};
export const loadedScripts = {};
export const loadedStylesheets = {};

const initialStates = new WeakMap();
const shadowStyleBlocks = new WeakMap();
const shadowStylesheets = new WeakMap();

/**
 * Adds initial state values for a component before it has initialized.
 * @param {Element} component The component element.
 * @param {object} values The state values to apply.
 */
export function setInitialState(component, values) {
    const state = initialStates.get(component) || {};

    Object.assign(state, values);
    initialStates.set(component, state);
}

/**
 * Takes and removes initial state values waiting for a component.
 * @param {Element} component The component element.
 * @returns {object|undefined} The pending state values, if any.
 */
export function takeInitialState(component) {
    const state = initialStates.get(component);

    initialStates.delete(component);
    return state;
}

/**
 * Gets the cached shadow style blocks for a component class.
 * @param {typeof import('./component.js').default} ComponentClass The component constructor.
 * @returns {HTMLStyleElement[]} The cached style blocks.
 */
export function getShadowStyleBlocks(ComponentClass) {
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
export function getShadowStylesheets(ComponentClass) {
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
export function setShadowAssets(ComponentClass, { styleBlocks = [], stylesheets = [] } = {}) {
    shadowStyleBlocks.set(ComponentClass, [...styleBlocks]);
    shadowStylesheets.set(ComponentClass, [...stylesheets]);
}
