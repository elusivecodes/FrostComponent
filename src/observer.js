import { load } from './loader.js';
import { flattenElements, isComponent } from './helpers.js';
import Suspense from './suspense.js';
import { loadedScripts, loadedStylesheets } from './vars.js';

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
export function bootstrap(options = {}) {
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
