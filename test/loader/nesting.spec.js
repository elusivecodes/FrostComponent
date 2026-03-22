import { test, expect } from '@playwright/test';
import { initializePage } from '../support/utils.js';

test.describe('Component autoload', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('autoloads nested components from a parent template', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <script>
                            this.addEventListener('initialized', () => {
                                window._events.push('parent:initialized');
                            });
                        </script>

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
                            this.addEventListener('initialized', () => {
                                window._events.push('child:initialized');
                            });
                        </script>

                        <div></div>
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

        await expect(page.locator('[x\\:component="x-child"]')).toHaveCount(1);

        const events = await page.evaluate(() => window._events || []);
        expect(events).toEqual(['parent:initialized', 'child:initialized']);
    });

    test('autoloads nested root components from parent template', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <x-child></x-child>
                    `,
                });
                return;
            }
            if (url.endsWith('/x-child')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <div></div>
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

        await expect(page.locator('[x\\:component="x-child"]')).toHaveCount(1);
    });

    test('autoloads slotted child after parent initializes', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <script>
                            this.addEventListener('initialized', () => {
                                window._events.push('parent:initialized');
                            });
                        </script>
    
                        <div>
                            <slot name="body"></slot>
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
                            this.addEventListener('initialized', () => {
                                window._events.push('child:initialized');
                            });
                        </script>
    
                        <div id="child"></div>
                    `,
                });
                return;
            }
            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window._events = [];
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent><x-child slot="body"></x-child></x-parent>';
        });

        await expect(page.locator('[x\\:component="x-parent"] #child')).toHaveCount(1);

        const events = await page.evaluate(() => window._events || []);
        expect(events).toEqual(['parent:initialized', 'child:initialized']);
    });

    test('autoloads loop components from x:each blocks', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <div>
                            <x-child x:each="items" x:id="id"></x-child>
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
                        <div class="child"></div>
                    `,
                });
                return;
            }
            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent items="[{ id: 1 }, { id: 2 }]"></x-parent>';
        });

        await expect(page.locator('[x\\:component="x-parent"] .child')).toHaveCount(2);
    });

    test('autoloads conditional components from x:if blocks', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <div>
                            <x-child x:if="show"></x-child>
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
                        <div id="child"></div>
                    `,
                });
                return;
            }
            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent show="true"></x-parent>';
        });

        await expect(page.locator('[x\\:component="x-parent"] #child')).toHaveCount(1);
    });

    test('does not initialize conditional child when not shown initially', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <div>
                            <x-child x:if="show"></x-child>
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
                            this.addEventListener('initialized', () => {
                                window._events.push('child:initialized');
                            });
                        </script>

                        <div id="child"></div>
                    `,
                });
                return;
            }
            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window._events = [];
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent show="false"></x-parent>';
        });

        await page.waitForFunction(() => {
            const root = document.querySelector('[x\\:component="x-parent"]');
            return root && root.component && root.component.loaded === true;
        });

        const events = await page.evaluate(() => window._events || []);
        expect(events).toEqual([]);
        await expect(page.locator('[x\\:component="x-child"]')).toHaveCount(0);
    });

    test('fires parent loaded after child components load (template)', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <script>
                            this.addEventListener('loaded', () => {
                                window._events.push('parent:loaded');
                            });
                        </script>

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
                            this.addEventListener('loaded', () => {
                                window._events.push('child:loaded');
                            });
                        </script>

                        <div id="child"></div>
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
            const root = document.querySelector('[x\\:component="x-parent"]');
            return root && root.component && root.component.loaded === true;
        });

        const events = await page.evaluate(() => window._events || []);
        expect(events).toEqual(['child:loaded', 'parent:loaded']);
    });

    test('fires parent loaded after slotted child components load', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-parent')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <script>
                            this.addEventListener('loaded', () => {
                                window._events.push('parent:loaded');
                            });
                        </script>

                        <div>
                            <slot name="body"></slot>
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
                            this.addEventListener('loaded', () => {
                                window._events.push('child:loaded');
                            });
                        </script>

                        <div id="child"></div>
                    `,
                });
                return;
            }
            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window._events = [];
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-parent><x-child slot="body"></x-child></x-parent>';
        });

        await page.waitForFunction(() => {
            const root = document.querySelector('[x\\:component="x-parent"]');
            return root && root.component && root.component.loaded === true;
        });

        const events = await page.evaluate(() => window._events || []);
        expect(events).toEqual(['child:loaded', 'parent:loaded']);
    });
});
