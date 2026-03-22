import { isPlainObject } from './helpers.js';

/**
 * Parses component state from non-framework attributes and removes them from the host.
 * @param {Component} component The component to populate with state.
 */
export function parseState(component) {
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
};
