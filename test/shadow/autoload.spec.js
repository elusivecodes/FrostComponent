import { test, expect } from '@playwright/test';
import { initializePage } from '../support/utils.js';

test.describe('Shadow mode', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('autoloads nested shadow components inside a shadow root', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div>
                            <x-child></x-child>
                        </div>
                    `,
                });
                return;
            }
            if (url.endsWith('/x-child')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div id="child">child</div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent></x-parent>';
        });

        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            return parent && parent.loaded;
        });


        const childText = await page.evaluate(() => {
            const parent = document.querySelector('x-parent');
            const child = parent?.renderRoot?.querySelector('x-child');
            return child?.renderRoot?.querySelector('#child')?.textContent ?? null;
        });

        expect(childText).toBe('child');
    });

    test('upgrades nested shadow components defined after insertion', async ({ page }) => {
        let resolveChild;
        const childGate = new Promise((resolve) => {
            resolveChild = resolve;
        });

        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div>
                            <x-child></x-child>
                        </div>
                    `,
                });
                return;
            }
            if (url.endsWith('/x-child')) {
                await childGate;
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div id="child">late</div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent></x-parent>';
        });

        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            return parent && parent.renderRoot instanceof ShadowRoot;
        });

        resolveChild();

        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            const child = parent?.renderRoot?.querySelector('x-child');
            return !!child?.renderRoot?.querySelector('#child');
        });

        const childText = await page.evaluate(() => {
            const parent = document.querySelector('x-parent');
            const child = parent?.renderRoot?.querySelector('x-child');
            return child?.renderRoot?.querySelector('#child')?.textContent ?? null;
        });

        expect(childText).toBe('late');
    });


    test('autoloads components added to a shadow root after mount', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div id="root"></div>
                    `,
                });
                return;
            }
            if (url.endsWith('/x-late')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div id="late">late</div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent></x-parent>';
        });

        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            return parent && parent.loaded === true;
        });

        await page.evaluate(() => {
            const parent = document.querySelector('x-parent');
            const root = parent.renderRoot.querySelector('#root');
            const el = document.createElement('x-late');
            root.appendChild(el);
        });

        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            const late = parent?.renderRoot?.querySelector('x-late');
            return !!late?.renderRoot?.querySelector('#late');
        });

        const text = await page.evaluate(() => {
            const parent = document.querySelector('x-parent');
            const late = parent?.renderRoot?.querySelector('x-late');
            return late?.renderRoot?.querySelector('#late')?.textContent ?? null;
        });

        expect(text).toBe('late');
    });

    test('autoloads shadow root components when observe runs before mount', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div>
                            <x-child></x-child>
                        </div>
                    `,
                });
                return;
            }
            if (url.endsWith('/x-child')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div id="child">child</div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
        });

        await page.evaluate(() => {
            document.body.innerHTML = '<x-parent></x-parent>';
        });

        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            const child = parent?.renderRoot?.querySelector('x-child');
            return !!child?.renderRoot?.querySelector('#child');
        });

        const childText = await page.evaluate(() => {
            const parent = document.querySelector('x-parent');
            const child = parent?.renderRoot?.querySelector('x-child');
            return child?.renderRoot?.querySelector('#child')?.textContent ?? null;
        });

        expect(childText).toBe('child');
    });


    test('upgrades nested components inside closed shadow root', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-closed-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow:closed -->
                        <div>
                            <x-closed-child></x-closed-child>
                        </div>
                        <script>
                            this._childReady = new Promise((resolve) => {
                                this.addEventListener('child-ready', resolve, { once: true });
                            });
                        </script>
                    `,
                });
                return;
            }
            if (url.endsWith('/x-closed-child')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow:closed -->
                        <div id="child">child</div>
                        <script>
                            this.addEventListener('loaded', () => {
                                this.dispatchEvent(new CustomEvent('child-ready', { bubbles: true }));
                            }, { once: true });
                        </script>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-closed-parent></x-closed-parent>';
        });

        await page.waitForFunction(async () => {
            const parent = document.querySelector('x-closed-parent');
            if (!parent) {
                return false;
            }
            await parent._childReady;
            return true;
        });
    });
});
