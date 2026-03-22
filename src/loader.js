import Component from './component.js';
import { isComponent } from './helpers.js';
import { loaded, loadedScripts, loadedStylesheets, setShadowAssets } from './vars.js';

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
    const shadowMode = parseShadowMode(container);

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
    if (shadowMode) {
        // handled per instance inside the shadow root
    } else {
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
            connectedCallback() {
                super.connectedCallback();

                for (const script of connectedScripts) {
                    Function.constructor(script.innerText).call(this);
                }
            }

            initialize() {
                super.initialize();

                for (const script of initializedScripts) {
                    Function.constructor(script.innerText).call(this);
                }
            }

            render() {
                return elements[0].cloneNode(true);
            }
        };

        ComponentClass.shadowMode = shadowMode;
        setShadowAssets(ComponentClass, {
            stylesheets,
            styleBlocks,
        });

        customElements.define(tagName, ComponentClass);
        loaded[tagName] = true;
    });
};

/**
 * Starts loading undefined components found in a node collection.
 * @param {Iterable<Node>} nodes The nodes to scan for components.
 * @param {object} [options] The options for loading components.
 * @param {string|null} [options.baseUrl=null] The base URL to fetch component templates.
 * @param {string|null} [options.extension=null] The file extension to append to component URLs.
 */
export function load(nodes, { baseUrl = null, extension = null } = {}) {
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
};
