import path from 'node:path';

const distPath = path.resolve('dist/frost-component.js');

export async function initializePage(page) {
    await page.addScriptTag({ path: distPath });
}

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
