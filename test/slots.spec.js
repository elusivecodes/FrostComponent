import { test, expect } from '@playwright/test';
import { defineComponent, initializePage, updateState } from './support/utils.js';

test.describe('Component slots', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('assigns named slots', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><slot name="title"></slot></div>');
        await page.setContent('<x-component><h1 slot="title">Title</h1></x-component>');

        const root = page.locator('[x\\:component="x-component"]');
        await expect(root.locator('h1')).toHaveText('Title');
    });

    test('assigns default slots', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><slot></slot></div>');
        await page.setContent('<x-component><p>Body</p></x-component>');

        const root = page.locator('[x\\:component="x-component"]');
        await expect(root.locator('p')).toHaveText('Body');
    });

    test('keeps nested component bindings in their own scope when slotted', async ({ page }) => {
        await defineComponent(page, 'x-child', 'XChild', '<div>{count}</div>');
        await defineComponent(page, 'x-parent', 'XParent', '<div><slot name="body"></slot></div>');
        await page.setContent('<x-parent count="1"><x-child slot="body" count="2"></x-child></x-parent>');

        const child = page.locator('[x\\:component="x-parent"] [x\\:component="x-child"]');
        await expect(child).toHaveText('2');

        await updateState(page, 'x-parent', { count: 3 });
        await expect(child).toHaveText('2');

        await updateState(page, 'x-child', { count: 4 });
        await expect(child).toHaveText('4');
    });

    test('binds parent-authored slotted content to the parent scope', async ({ page }) => {
        await defineComponent(page, 'x-child', 'XChild', '<div><slot name="body"></slot></div>');
        await defineComponent(page, 'x-parent', 'XParent', '<div><x-child><span id="slot" slot="body">{count}</span></x-child></div>');
        await page.setContent('<x-parent count="1"></x-parent>');

        const slot = page.locator('[x\\:component="x-parent"] [x\\:component="x-child"] #slot');
        await expect(slot).toHaveText('1');

        await updateState(page, 'x-parent', { count: 2 });
        await expect(slot).toHaveText('2');

        await updateState(page, 'x-child', { count: 5 });
        await expect(slot).toHaveText('2');
    });

    test('binds parent-authored default slot content to the parent scope', async ({ page }) => {
        await defineComponent(page, 'x-child', 'XChild', '<div><slot></slot></div>');
        await defineComponent(page, 'x-parent', 'XParent', '<div><slot name="body"></slot></div>');
        await page.setContent('<x-parent count="1"><x-child slot="body" count="2"><span id="slot">{count}</span></x-child></x-parent>');

        const slot = page.locator('[x\\:component="x-parent"] [x\\:component="x-child"] #slot');
        await expect(slot).toHaveText('1');

        await updateState(page, 'x-parent', { count: 3 });
        await expect(slot).toHaveText('3');

        await updateState(page, 'x-child', { count: 7 });
        await expect(slot).toHaveText('3');
    });
});
