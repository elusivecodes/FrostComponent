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
export function parseSlots(element) {
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
};

/**
 * Moves a component's light-DOM children into their matching slot markers.
 * @param {Component} component The component whose children are slotted.
 */
export function processSlots(component) {
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
    };
};
