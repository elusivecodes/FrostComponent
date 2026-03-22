import { test, expect } from '@playwright/test';
import { defineComponent, initializePage } from '../support/utils.js';

test.describe('Shadow mode', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('creates an open shadow root when directive is present', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-shadow')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div id="root">
                            <span id="msg">hello</span>
                        </div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-shadow></x-shadow>';
        });

        await page.waitForFunction(() => {
            const host = document.querySelector('x-shadow');
            return host && host.loaded === true;
        });

        const result = await page.evaluate(() => {
            const host = document.querySelector('x-shadow');
            return {
                hasHost: !!host,
                hasShadow: !!host.shadowRoot,
                hasRoot: !!host.shadowRoot?.querySelector('#root'),
                inLightDom: !!document.querySelector('#root'),
            };
        });

        expect(result.hasHost).toBe(true);
        expect(result.hasShadow).toBe(true);
        expect(result.hasRoot).toBe(true);
        expect(result.inLightDom).toBe(false);
    });

    test('creates a closed shadow root when directive is shadow:closed', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-closed')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow:closed -->
                        <div id="root"></div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-closed></x-closed>';
        });

        await page.waitForFunction(() => {
            const host = document.querySelector('x-closed');
            return host && host.loaded === true;
        });

        const result = await page.evaluate(() => {
            const host = document.querySelector('x-closed');
            return {
                hasHost: !!host,
                shadowRoot: host.shadowRoot,
                lightChildren: host.childNodes.length,
            };
        });

        expect(result.hasHost).toBe(true);
        expect(result.shadowRoot).toBe(null);
        expect(result.lightChildren).toBe(0);
    });

    test('ignores nested shadow comments', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-nested')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <div id="root">
                            <!-- shadow -->
                            <span id="inner">text</span>
                        </div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-nested></x-nested>';
        });

        await page.waitForFunction(() => {
            const root = document.querySelector('[x\\:component="x-nested"]');
            return root && root.component && root.component.loaded === true;
        });

        await expect(page.locator('x-nested')).toHaveCount(0);
        await expect(page.locator('[x\\:component="x-nested"]')).toHaveCount(1);
    });


    test('updates x:if inside shadow root', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-shadow-if')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div>
                            <span id="flag" x:if="show">on</span>
                        </div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-shadow-if show="true"></x-shadow-if>';
        });

        await page.waitForFunction(() => {
            const host = document.querySelector('x-shadow-if');
            return host && host.loaded === true;
        });

        const initial = await page.evaluate(() => {
            const host = document.querySelector('x-shadow-if');
            const root = host.renderRoot;
            return !!root.querySelector('#flag');
        });

        expect(initial).toBe(true);

        await page.evaluate(() => {
            const host = document.querySelector('x-shadow-if');
            host.state.show = false;
        });

        await page.waitForFunction(() => {
            const host = document.querySelector('x-shadow-if');
            const root = host.renderRoot;
            return !root.querySelector('#flag');
        });
    });

    test('updates x:each inside shadow root', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-shadow-each')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <div>
                            <x-item x:each="items" x:id="id"></x-item>
                        </div>
                    `,
                });
                return;
            }
            if (url.endsWith('/x-item')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <div class="item">{id}</div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-shadow-each items="[{ id: 1 }, { id: 2 }]"></x-shadow-each>';
        });

        await page.waitForFunction(() => {
            const host = document.querySelector('x-shadow-each');
            return host && host.loaded === true;
        });

        await page.waitForFunction(() => {
            const host = document.querySelector('x-shadow-each');
            const root = host.renderRoot;
            return root.querySelectorAll('.item').length === 2;
        });

        await page.evaluate(() => {
            const host = document.querySelector('x-shadow-each');
            host.state.items = [{ id: 3 }];
        });

        await page.waitForFunction(() => {
            const host = document.querySelector('x-shadow-each');
            const root = host.renderRoot;
            return root.querySelectorAll('.item').length === 1;
        });

        const updated = await page.evaluate(() => {
            const host = document.querySelector('x-shadow-each');
            const root = host.renderRoot;
            return {
                items: root.querySelectorAll('.item').length,
                text: root.querySelector('.item')?.textContent ?? null,
            };
        });

        expect(updated.items).toBe(1);
        expect(updated.text).toBe('3');
    });


    test('mounts style blocks and stylesheets in shadow root', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-style')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <link rel="stylesheet" href="test.css">
                        <style>#root { color: red; }</style>
                        <div id="root">text</div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-style></x-style>';
        });

        await page.waitForFunction(() => {
            const host = document.querySelector('x-style');
            return host && host.loaded === true;
        });

        const result = await page.evaluate(() => {
            const host = document.querySelector('x-style');
            return {
                shadowStyleCount: host.renderRoot.querySelectorAll('style').length,
                shadowLinkCount: host.renderRoot.querySelectorAll('link[rel="stylesheet"]').length,
                headStyleCount: document.head.querySelectorAll('style').length,
                headLinkCount: document.head.querySelectorAll('link[rel="stylesheet"]').length,
            };
        });

        expect(result.shadowStyleCount).toBe(1);
        expect(result.shadowLinkCount).toBe(1);
        expect(result.headStyleCount).toBe(0);
        expect(result.headLinkCount).toBe(0);
    });

    test('clones shadow styles per instance without leaking to head', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-style')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <!-- shadow -->
                        <link rel="stylesheet" href="test.css">
                        <style>#root { color: red; }</style>
                        <div id="root">text</div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = '<x-style></x-style><x-style></x-style>';
        });

        await page.waitForFunction(() => {
            const hosts = document.querySelectorAll('x-style');
            return hosts.length === 2 && [...hosts].every((h) => h.loaded === true);
        });

        const result = await page.evaluate(() => {
            const hosts = [...document.querySelectorAll('x-style')];
            return {
                shadowStyles: hosts.map((host) => host.renderRoot.querySelectorAll('style').length),
                shadowLinks: hosts.map((host) => host.renderRoot.querySelectorAll('link[rel="stylesheet"]').length),
                headStyleCount: document.head.querySelectorAll('style').length,
                headLinkCount: document.head.querySelectorAll('link[rel="stylesheet"]').length,
            };
        });

        expect(result.shadowStyles).toEqual([1, 1]);
        expect(result.shadowLinks).toEqual([1, 1]);
        expect(result.headStyleCount).toBe(0);
        expect(result.headLinkCount).toBe(0);
    });

    test('keeps shadow asset caches isolated between JS-defined component classes', async ({ page }) => {
        await defineComponent(page, 'x-style-a', 'XStyleA', `
            <style data-style="a">#a { color: red; }</style>
            <div id="a">A</div>
        `);
        await defineComponent(page, 'x-style-b', 'XStyleB', `
            <style data-style="b">#b { color: blue; }</style>
            <div id="b">B</div>
        `);

        await page.evaluate(() => {
            window.XStyleA.shadowMode = 'open';
            window.XStyleB.shadowMode = 'open';
            document.body.innerHTML = '<x-style-a></x-style-a><x-style-b></x-style-b>';
        });

        await page.waitForFunction(() => {
            const a = document.querySelector('x-style-a');
            const b = document.querySelector('x-style-b');
            return a?.loaded && b?.loaded;
        });

        const result = await page.evaluate(() => {
            const a = document.querySelector('x-style-a').renderRoot;
            const b = document.querySelector('x-style-b').renderRoot;

            return {
                aStyles: [...a.querySelectorAll('style')].map((style) => style.dataset.style),
                bStyles: [...b.querySelectorAll('style')].map((style) => style.dataset.style),
            };
        });

        expect(result).toEqual({
            aStyles: ['a'],
            bStyles: ['b'],
        });
    });
});
