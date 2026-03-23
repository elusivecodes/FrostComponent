import { test, expect } from '@playwright/test';
import { defineComponent, initializePage, attachMethod } from './support/utils.js';

test.describe('Component lifecycle', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('initializes and replaces the custom element with its template', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div>');
        await page.setContent('<x-component></x-component>');

        await expect(page.locator('x-component')).toHaveCount(0);
        await expect(page.locator('[x\\:component="x-component"]')).toHaveCount(1);
    });

    test('fires connected -> initialized -> loaded events in order', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div>');

        const events = await page.evaluate(async () => {
            return await new Promise((resolve) => {
                const el = document.createElement('x-component');
                const list = [];
                el.addEventListener('connected', () => list.push('connected'));
                el.addEventListener('initialized', () => list.push('initialized'));
                el.addEventListener('loaded', () => {
                    list.push('loaded');
                    resolve(list);
                });
                document.body.appendChild(el);
            });
        });

        expect(events).toEqual(['connected', 'initialized', 'loaded']);
    });

    test('runs effects when state changes and component is mounted', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div>');
        await page.setContent('<x-component></x-component>');

        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            const component = root.component;
            component.state.count = 0;
            component._runs = 0;
            component.effect(() => {
                void component.state.count;
                component._runs++;
            });
            component.state.count = 1;
        });

        const runs = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component._runs;
        });

        expect(runs).toBe(2);
    });

    test('runs effects when waitForVisible is false', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div>');
        await page.setContent('<x-component></x-component>');

        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            const component = root.component;
            component.dispatchEvent(new Event('invisible'));
            component.effect(() => {
                component._ran = true;
            }, { waitForVisible: false });
        });

        const ran = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component._ran;
        });

        expect(ran).toBe(true);
    });

    test('ready runs immediately when already loaded and waits otherwise', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div>');

        const immediate = await page.evaluate(async () => {
            return await new Promise((resolve) => {
                const el = document.createElement('x-component');
                el.addEventListener('loaded', () => {
                    let ran = false;
                    el.ready(() => {
                        ran = true;
                    });
                    resolve(ran);
                }, { once: true });
                document.body.appendChild(el);
            });
        });

        expect(immediate).toBe(true);

        const delayed = await page.evaluate(async () => {
            return await new Promise((resolve) => {
                const el = document.createElement('x-component');
                let ran = false;
                el.ready(() => {
                    ran = true;
                });
                el.addEventListener('loaded', () => resolve(ran), { once: true });
                document.body.appendChild(el);
            });
        });

        expect(delayed).toBe(true);
    });

    test('defers loaded until all deferLoad promises resolve', async ({ page }) => {
        await defineComponent(page, 'x-defer', 'XDefer', '<div></div>');
        await attachMethod(page, 'XDefer', 'initialize', function() {
            this.deferLoad(window._deferOne);
            this.deferLoad(window._deferTwo);
        });

        await page.evaluate(() => {
            window._resolveOne = null;
            window._resolveTwo = null;
            window._deferOne = new Promise((resolve) => {
                window._resolveOne = resolve;
            });
            window._deferTwo = new Promise((resolve) => {
                window._resolveTwo = resolve;
            });

            window._loaded = false;
            const el = document.createElement('x-defer');
            el.addEventListener('loaded', () => {
                window._loaded = true;
            }, { once: true });
            document.body.appendChild(el);
        });

        await page.waitForFunction(() => window._loaded === false);

        await page.evaluate(() => window._resolveOne());
        await page.waitForTimeout(20);

        const loadedAfterFirst = await page.evaluate(() => window._loaded);
        expect(loadedAfterFirst).toBe(false);

        await page.evaluate(() => window._resolveTwo());
        await page.waitForFunction(() => window._loaded === true);
    });

    test('throws when deferLoad is called after loaded', async ({ page }) => {
        await defineComponent(page, 'x-after', 'XAfter', '<div></div>');

        await page.evaluate(async () => {
            window._afterError = null;
            const el = document.createElement('x-after');
            el.addEventListener('loaded', () => {
                try {
                    el.deferLoad(Promise.resolve());
                } catch (err) {
                    window._afterError = err?.message || String(err);
                }
            }, { once: true });
            document.body.appendChild(el);
        });

        await page.waitForFunction(() => window._afterError !== null);

        const afterError = await page.evaluate(() => window._afterError);
        expect(afterError).toContain('deferred');
    });

    test('loads even when a deferred promise rejects', async ({ page }) => {
        await defineComponent(page, 'x-reject', 'XReject', '<div></div>');
        await attachMethod(page, 'XReject', 'initialize', function() {
            this.deferLoad(window._rejectPromise);
        });

        await page.evaluate(() => {
            window._loaded = false;
            window._unhandled = null;

            window.addEventListener('unhandledrejection', (event) => {
                window._unhandled = event.reason?.message || String(event.reason);
                event.preventDefault();
            });

            window._rejectPromise = new Promise((_, reject) => {
                window._reject = reject;
            });

            const el = document.createElement('x-reject');
            el.addEventListener('loaded', () => {
                window._loaded = true;
            }, { once: true });
            document.body.appendChild(el);
        });

        await page.evaluate(() => window._reject(new Error('boom')));

        await page.waitForFunction(() => window._loaded === true);

        const unhandled = await page.evaluate(() => window._unhandled);
        expect(unhandled).toBe(null);
    });

    test('initializes when template root is another component', async ({ page }) => {
        await defineComponent(page, 'x-child', 'XChild', '<div></div>');
        await defineComponent(page, 'x-parent', 'XParent', '<x-child></x-child>');

        await page.evaluate(() => {
            window._events = [];

            const parent = document.createElement('x-parent');
            parent.addEventListener('initialized', () => {
                window._events.push('parent:initialized');

                parent.rootElement.addEventListener('initialized', () => {
                    window._events.push('child:initialized');
                }, { once: true });

                parent.rootElement.addEventListener('loaded', () => {
                    window._events.push('child:loaded');
                }, { once: true });
            }, { once: true });
            parent.addEventListener('loaded', () => {
                window._events.push('parent:loaded');
            }, { once: true });

            document.body.appendChild(parent);
        });

        await page.waitForFunction(() => {
            const child = document.querySelector('[x\\:component="x-child"]');
            return child && child.component && child.component.loaded === true;
        });

        const events = await page.evaluate(() => window._events || []);
        expect(events).toEqual(['parent:initialized', 'child:initialized', 'child:loaded', 'parent:loaded']);
    });

    test('throws when a component is reattached after initialization', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div>');

        await page.evaluate(() => {
            const el = document.createElement('x-component');
            document.body.appendChild(el);
        });

        await page.waitForFunction(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root && root.component && root.component.initialized === true;
        });

        const errorPromise = page.waitForEvent('pageerror');
        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            const host = root.component;
            const container = document.createElement('div');
            document.body.appendChild(container);
            container.appendChild(root);
            document.body.removeChild(container);
            document.body.appendChild(host);
        });
        const error = await errorPromise;
        expect(error.message).toContain('cannot be reattached after it has been initialized');
    });
});
