export const loaded = {};
export const loadedScripts = {};
export const loadedStylesheets = {};

const shadowModes = new WeakMap();
const shadowStyleBlocks = new WeakMap();
const shadowStylesheets = new WeakMap();

/**
 * Gets the configured shadow mode for a component class.
 * @param {typeof import('./component.js').default} ComponentClass The component constructor.
 * @returns {'open'|'closed'|null} The configured shadow mode.
 */
export function getShadowMode(ComponentClass) {
    return shadowModes.get(ComponentClass) ?? null;
}

/**
 * Sets the configured shadow mode for a component class.
 * @param {typeof import('./component.js').default} ComponentClass The component constructor.
 * @param {'open'|'closed'|null} shadowMode The shadow mode to store.
 */
export function setShadowMode(ComponentClass, shadowMode) {
    shadowModes.set(ComponentClass, shadowMode);
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
