import { expect, test } from '#test';
import { defineComponent, initializePage, updateState } from '../support/utils.js';

test.describe('Component slots', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('assigns named slots', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><slot name="title"></slot></div>');
        await page.setContent('<x-component><h1 slot="title">Title</h1></x-component>');

        const root = page.locator('[x\\:component="x-component"]');
        await expect(root.locator('h1')).toHaveText('Title');
        await expect(root.locator('h1')).toHaveAttribute('slot', 'title');
    });

    test('exposes slot definitions without overriding the native slot property', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><slot name="title"></slot></div>');
        await page.setContent('<x-component slot="outer"><h1 slot="title">Title</h1></x-component>');

        const result = await page.locator('[x\\:component="x-component"]').evaluate((element) => ({
            assignedCount: element.component.getSlot('title').assigned().length,
            componentSlot: element.component.slot,
            elementSlot: element.slot,
        }));

        expect(result).toEqual({
            assignedCount: 1,
            componentSlot: 'outer',
            elementSlot: 'outer',
        });
    });

    test('assigns default slots', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><slot></slot></div>');
        await page.setContent('<x-component><p>Body</p></x-component>');

        const root = page.locator('[x\\:component="x-component"]');
        await expect(root.locator('p')).toHaveText('Body');
    });

    test('renders fallback content until a node is assigned', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><slot><span class="fallback">Fallback</span></slot></div>');
        await page.setContent('<x-component></x-component><x-component><span class="assigned">Assigned</span></x-component>');

        const roots = page.locator('[x\\:component="x-component"]');
        await expect(roots.nth(0).locator('.fallback')).toHaveText('Fallback');
        await expect(roots.nth(1).locator('.fallback')).toHaveCount(0);
        await expect(roots.nth(1).locator('.assigned')).toHaveText('Assigned');
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
