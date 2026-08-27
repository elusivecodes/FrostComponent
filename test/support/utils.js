/** @import { Page } from '@playwright/test'; */

import path from 'node:path';

const distPath = path.resolve('dist/frost-component.js');

/**
 * Loads the component bundle into a browser page.
 * @param {Page} page The Playwright page.
 * @returns {Promise<void>} A promise that resolves once the bundle is loaded.
 */
export async function initializePage(page) {
    await page.addScriptTag({ path: distPath });
}

/**
 * Waits for queued browser tasks to complete.
 * @param {Page} page The Playwright page.
 * @returns {Promise<void>} A promise that resolves after queued tasks run.
 */
export async function flushTasks(page) {
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

/**
 * Waits for a component to finish loading.
 * @param {Page} page The Playwright page.
 * @param {string} tagName The component tag name.
 * @returns {Promise<void>} A promise that resolves when the component is loaded.
 */
export async function waitForComponent(page, tagName) {
    await page.waitForFunction((tagName) => {
        const root = document.querySelector(`[x\\:component="${tagName}"]`);
        return root?.component?.loaded === true;
    }, tagName);
}

/**
 * Defines a component class in a browser page.
 * @param {Page} page The Playwright page.
 * @param {string} tagName The component tag name.
 * @param {string} className The component class name.
 * @param {string} template The component template markup.
 * @returns {Promise<void>} A promise that resolves once the component is defined.
 */
export async function defineComponent(page, tagName, className, template) {
    await page.addScriptTag({
        content: `
            class ${className} extends window.Component {
                static get template() {
                    return ${JSON.stringify(template)};
                }
            }
            window.${className} = ${className};
            customElements.define('${tagName}', ${className});
        `,
    });
}

/**
 * Updates state on a component in a browser page.
 * @param {Page} page The Playwright page.
 * @param {string} tagName The component tag name.
 * @param {Record<string, *>} newState The state values to apply.
 * @returns {Promise<void>} A promise that resolves once the state is updated.
 */
export async function updateState(page, tagName, newState) {
    await page.waitForFunction((tagName) => {
        const el = document.querySelector(`[x\\:component="${tagName}"]`);
        return el && el.component && el.component.initialized === true;
    }, tagName);

    return await page.evaluate(({ tagName, newState }) => {
        const el = document.querySelector(`[x\\:component="${tagName}"]`);
        const component = el.component;

        for (const [key, value] of Object.entries(newState)) {
            component.state[key] = value;
        }
    }, { tagName, newState });
}

/**
 * Attaches a method to a component class in a browser page.
 * @param {Page} page The Playwright page.
 * @param {string} className The component class name.
 * @param {string} methodName The method name.
 * @param {Function} fn The method implementation.
 * @returns {Promise<void>} A promise that resolves once the method is attached.
 */
export async function attachMethod(page, className, methodName, fn) {
    const source = fn.toString();
    await page.evaluate(({ className, methodName, source }) => {
        const targetClass = window[className];
        if (!targetClass) {
            throw new Error(`Class not found: ${className}`);
        }
        const method = new Function(`return (${source});`)();
        targetClass.prototype[methodName] = method;
    }, { className, methodName, source });
}
