import { createFunction, isPlainObject } from './helpers.js';
import { takeInitialState } from './vars.js';

/** @typedef {import('./component.js').default} Component */

/**
 * Parses component state from non-framework attributes and removes them from the host.
 * @param {Component} component The component to populate with state.
 */
export function parseState(component) {
    for (const attr of [...component.attributes]) {
        if (attr.name === 'slot' || attr.name.startsWith('x:')) {
            continue;
        }

        let value;
        try {
            value = createFunction(
                component,
                ['state', attr.name],
                `return ${attr.value};`,
            ).call(component);
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

    const initialState = takeInitialState(component);
    if (initialState) {
        component.state.set(initialState);
    }
};
