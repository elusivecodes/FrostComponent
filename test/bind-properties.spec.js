import { test, expect } from '@playwright/test';
import { defineComponent, initializePage, attachMethod } from './support/utils.js';

test.describe('Component property bindings', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('binds state expressions to element properties', async ({ page }) => {
        await defineComponent(page, 'x-parent', 'XParent', '<div><button id="target" .service="service"></button></div>');
        await attachMethod(page, 'XParent', 'initialize', function() {
            this.state.service = { name: 'api' };
        });

        await page.setContent('<x-parent></x-parent>');

        const serviceName = await page.evaluate(() => {
            const target = document.querySelector('[x\\:component="x-parent"] #target');
            return target?.service?.name ?? null;
        });

        expect(serviceName).toBe('api');
    });

    test('clears element properties when expression becomes empty', async ({ page }) => {
        await defineComponent(page, 'x-parent', 'XParent', '<div><button id="target" .token="token"></button></div>');

        await page.setContent('<x-parent token="abc"></x-parent>');

        const initial = await page.evaluate(() => {
            const target = document.querySelector('[x\\:component="x-parent"] #target');
            return target?.token;
        });

        expect(initial).toBe('abc');

        await page.evaluate(() => {
            const parent = document.querySelector('[x\\:component="x-parent"]');
            parent.component.state.token = null;
        });

        await page.waitForFunction(() => {
            const target = document.querySelector('[x\\:component="x-parent"] #target');
            return target && !('token' in target);
        });
    });

    test('throws when binding built-in DOM properties', async ({ page }) => {
        await defineComponent(page, 'x-parent', 'XParent', '<div><input .value="token"></div>');
        const errorPromise = page.waitForEvent('pageerror');
        await page.setContent('<x-parent token="abc"></x-parent>');
        const error = await errorPromise;
        expect(error.message).toContain('only supports custom properties');
    });
});
