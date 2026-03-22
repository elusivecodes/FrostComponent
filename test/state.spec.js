import { test, expect } from '@playwright/test';
import { defineComponent, initializePage, updateState } from './support/utils.js';

test.describe('Component state', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('parses state from attributes', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div>');
        await page.setContent('<x-component count="3" state="{ value: 10, label: \'ok\' }"></x-component>');

        const state = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return {
                count: root.component.state.count,
                value: root.component.state.value,
                label: root.component.state.label,
            };
        });

        expect(state).toEqual({ count: 3, value: 10, label: 'ok' });
    });

    test('creates nested state stores from object values', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div>');
        await page.setContent('<x-component state="{ user: { name: \'Ada\' } }"></x-component>');

        await updateState(page, 'x-component', { user: { name: 'Grace' } });

        const name = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.user.name;
        });

        expect(name).toBe('Grace');
    });

    test('falls back to string values when state parsing fails', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div>');
        await page.setContent('<x-component broken="{ invalid" ></x-component>');

        const value = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.broken;
        });

        expect(value).toBe('{ invalid');
    });

    test('treats non-object state attribute values as raw state', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div></div>');
        await page.setContent('<x-component state="3"></x-component>');

        const value = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.state;
        });

        expect(value).toBe(3);
    });
});
