import { test, expect } from '@playwright/test';
import { initializePage } from '../support/utils.js';

test.describe('Shadow mode', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('waits for shadow children to load before parent is loaded', async ({ page }) => {
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
                        <script>
                            this.deferLoad(window._childLoadPromise);
                        </script>
                        <!-- shadow -->
                        <div id="child">child</div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window._resolveChildLoad = null;
            window._childLoadPromise = new Promise((resolve) => {
                window._resolveChildLoad = resolve;
            });

            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent></x-parent>';
        });

        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            return parent && parent.renderRoot instanceof ShadowRoot;
        });

        const parentLoadedBefore = await page.evaluate(() => {
            const parent = document.querySelector('x-parent');
            return parent?.loaded === true;
        });

        expect(parentLoadedBefore).toBe(false);

        await page.evaluate(() => window._resolveChildLoad());

        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            return parent && parent.loaded === true;
        });
    });


    test('waits for mixed shadow and light children before parent is loaded', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div>
                            <x-a></x-a>
                            <x-b></x-b>
                        </div>
                    `,
                });
                return;
            }
            if (url.endsWith('/x-a')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <script>
                            this.deferLoad(window._aPromise);
                        </script>
                        <!-- shadow -->
                        <div id="a">a</div>
                    `,
                });
                return;
            }
            if (url.endsWith('/x-b')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <script>
                            this.deferLoad(window._bPromise);
                        </script>
                        <div id="b">b</div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window._resolveA = null;
            window._resolveB = null;
            window._aPromise = new Promise((resolve) => {
                window._resolveA = resolve;
            });
            window._bPromise = new Promise((resolve) => {
                window._resolveB = resolve;
            });

            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent></x-parent>';
        });

        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            return parent && parent.renderRoot instanceof ShadowRoot;
        });

        const loadedBefore = await page.evaluate(() => {
            const parent = document.querySelector('x-parent');
            return parent?.loaded === true;
        });
        expect(loadedBefore).toBe(false);

        await page.evaluate(() => window._resolveA());
        await page.waitForTimeout(20);

        const loadedAfterA = await page.evaluate(() => {
            const parent = document.querySelector('x-parent');
            return parent?.loaded === true;
        });
        expect(loadedAfterA).toBe(false);

        await page.evaluate(() => window._resolveB());
        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            return parent && parent.loaded === true;
        });
    });


    test('bubbles events from closed shadow children to the host', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-closed-bubble-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow:closed -->
                        <div>
                            <x-closed-bubble-child></x-closed-bubble-child>
                        </div>
                        <script>
                            window._bubbleReceived = false;
                            this.addEventListener('child-event', () => {
                                window._bubbleReceived = true;
                            });
                        </script>
                    `,
                });
                return;
            }
            if (url.endsWith('/x-closed-bubble-child')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow:closed -->
                        <div id="child">child</div>
                        <script>
                            this.addEventListener('loaded', () => {
                                this.dispatchEvent(new CustomEvent('child-event', { bubbles: true, composed: true }));
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
            document.body.innerHTML = '<x-closed-bubble-parent></x-closed-bubble-parent>';
        });

        await page.waitForFunction(() => window._bubbleReceived === true);
    });

    test('fires lifecycle events in order for shadow parent and child', async ({ page }) => {
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
                        <script>
                            this.addEventListener('initialized', () => window._events.push('parent:initialized'));
                            this.addEventListener('mounted', () => window._events.push('parent:mounted'));
                            this.addEventListener('loaded', () => window._events.push('parent:loaded'));
                        </script>
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
                        <script>
                            this.addEventListener('initialized', () => window._events.push('child:initialized'));
                            this.addEventListener('mounted', () => window._events.push('child:mounted'));
                            this.addEventListener('loaded', () => window._events.push('child:loaded'));
                        </script>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window._events = [];

            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent></x-parent>';
        });

        await page.waitForFunction(() => {
            const parent = document.querySelector('x-parent');
            return parent?.loaded;
        });

        const events = await page.evaluate(() => {
            return window._events || [];
        });

        expect(events).toEqual(['parent:mounted', 'parent:initialized', 'child:mounted', 'child:initialized', 'child:loaded', 'parent:loaded']);
    });
});
