import { test, expect } from '@playwright/test';
import { defineComponent, initializePage, attachMethod } from './support/utils.js';

test.describe('Suspense component', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('shows fallback until child components load, then unwraps', async ({ page }) => {
        await defineComponent(page, 'x-delay', 'XDelay', '<div id="child">ready</div>');
        await attachMethod(page, 'XDelay', 'initialize', function() {
            this.deferLoad(window._loadPromise);
        });

        await page.evaluate(() => {
            window._resolveLoad = null;
            window._loadPromise = new Promise((resolve) => {
                window._resolveLoad = resolve;
            });

            window.Component.bootstrap();
            document.body.innerHTML = `
                <x-suspense>
                    <template slot="fallback">
                        <div id="fallback">loading</div>
                    </template>
                    <x-delay></x-delay>
                </x-suspense>
            `;
        });

        await expect(page.locator('#fallback')).toHaveText('loading');
        await expect(page.locator('#child')).toHaveCount(1);
        await expect(page.locator('#child')).toBeHidden();

        await page.evaluate(() => window._resolveLoad());

        await page.waitForFunction(() => {
            return !document.querySelector('x-suspense') && !!document.querySelector('#child');
        });

        await expect(page.locator('#fallback')).toHaveCount(0);
        await expect(page.locator('#child')).toHaveText('ready');
    });

    test('skips fallback when there are no child components', async ({ page }) => {
        await page.evaluate(() => {
            window.Component.bootstrap();
            document.body.innerHTML = `
                <x-suspense>
                    <template slot="fallback">
                        <div id="fallback">loading</div>
                    </template>
                    <div id="content">content</div>
                </x-suspense>
            `;
        });

        await page.waitForFunction(() => {
            return !document.querySelector('x-suspense') && !!document.querySelector('#content');
        });

        await expect(page.locator('#fallback')).toHaveCount(0);
        await expect(page.locator('#content')).toHaveText('content');
    });

    test('waits for shadow child components before removing fallback', async ({ page }) => {
        await page.route('**/components/*', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/x-shadow-child')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: `
                        <script>
                            this.deferLoad(window._shadowLoadPromise);
                        </script>
                        <!-- shadow -->
                        <div id="child">ready</div>
                    `,
                });
                return;
            }

            await route.fulfill({ status: 404 });
        });

        await page.evaluate(() => {
            window._resolveShadowLoad = null;
            window._shadowLoadPromise = new Promise((resolve) => {
                window._resolveShadowLoad = resolve;
            });

            window.Component.bootstrap({ baseUrl: 'http://test.local/components' });
            document.body.innerHTML = `
                <x-suspense>
                    <template slot="fallback">
                        <div id="fallback">loading</div>
                    </template>
                    <x-shadow-child></x-shadow-child>
                </x-suspense>
            `;
        });

        await expect(page.locator('#fallback')).toHaveText('loading');
        await expect(page.locator('#child')).toHaveCount(1);
        await expect(page.locator('#child')).toBeHidden();

        await page.evaluate(() => window._resolveShadowLoad());

        await page.waitForFunction(() => {
            return !document.querySelector('#fallback');
        });

        await expect(page.locator('#fallback')).toHaveCount(0);
        await expect(page.locator('#child')).toHaveText('ready');
    });
});
