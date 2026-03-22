/**
 * Collects elements keyed by `x:key`.
 * @param {Element} element The element to scan for keys.
 * @returns {Object.<string, Element>} The key-to-element map.
 * @throws {Error} When duplicate keys are found.
 */
export function parseElements(element) {
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
};
