import Component from './component.js';
import { findChildren } from './helpers.js';

/**
 * Provides fallback content while child components load.
 */
export default class Suspense extends Component {
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
