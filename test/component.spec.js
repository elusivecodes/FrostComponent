import { test, expect } from '@playwright/test';
import { defineComponent, initializePage } from './support/utils.js';

test.describe('Component constraints', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('assigns x:key elements to component properties', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span id="title" x:key="a"></span></div>');
        await page.setContent('<x-component></x-component>');

        const match = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.a === root.querySelector('#title');
        });

        expect(match).toBe(true);
    });

    test('assigns root x:key elements to component properties', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div id="root" x:key="root"></div>');
        await page.setContent('<x-component></x-component>');

        const result = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return {
                matches: root.component.root === root,
                hasKeyAttribute: root.hasAttribute('x:key'),
            };
        });

        expect(result).toEqual({
            matches: true,
            hasKeyAttribute: false,
        });
    });

    test('ignores empty x:key values and removes x:key attributes', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span id="a" x:key=""></span><span id="b" x:key="b"></span></div>');
        await page.setContent('<x-component></x-component>');

        const keys = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return {
                hasKeyA: root.querySelector('#a').hasAttribute('x:key'),
                hasKeyB: root.querySelector('#b').hasAttribute('x:key'),
            };
        });

        expect(keys).toEqual({ hasKeyA: false, hasKeyB: false });
    });

    test('throws when x:key duplicates are present', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span x:key="dup"></span><span x:key="dup"></span></div>');
        const errorPromise = page.waitForEvent('pageerror');
        await page.setContent('<x-component></x-component>');
        const error = await errorPromise;
        expect(error.message).toContain('Duplicate key element "dup"');
    });

    test('throws when a component renders multiple root elements', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div><div></div>');
        const errorPromise = page.waitForEvent('pageerror');
        await page.setContent('<x-component></x-component>');
        const error = await errorPromise;
        expect(error.message).toContain('Components must only render a single element');
    });

    test('throws when a component renders no root elements', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '');
        const errorPromise = page.waitForEvent('pageerror');
        await page.setContent('<x-component></x-component>');
        const error = await errorPromise;
        expect(error.message).toContain('Components must only render a single element');
    });

    test('throws when a component renders a root slot element', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<slot></slot>');
        const errorPromise = page.waitForEvent('pageerror');
        await page.setContent('<x-component><span>body</span></x-component>');
        const error = await errorPromise;
        expect(error.message).toContain('Components cannot render a root slot element');
    });
});
