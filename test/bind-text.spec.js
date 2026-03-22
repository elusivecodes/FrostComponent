import { test, expect } from '@playwright/test';
import { defineComponent, initializePage, updateState } from './support/utils.js';

test.describe('Component text bindings', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('binds text interpolation', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span id="label">{count}</span></div>');
        await page.setContent('<x-component count="1"></x-component>');

        const label = page.locator('[x\\:component="x-component"] #label');
        await expect(label).toHaveText('1');

        await updateState(page, 'x-component', { count: 2 });
        await expect(label).toHaveText('2');
    });

    test('binds interpolation to state expression', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span id="label">Count: {{ this.state.count }}</span></div>');
        await page.setContent('<x-component count="1"></x-component>');

        const label = page.locator('[x\\:component="x-component"] #label');
        await expect(label).toHaveText('Count: 1');

        await updateState(page, 'x-component', { count: 2 });
        await expect(label).toHaveText('Count: 2');
    });

    test('binds interpolation to template literal', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span id="label">{{ `Count: ${this.state.count}` }}</span></div>');
        await page.setContent('<x-component count="1"></x-component>');

        const label = page.locator('[x\\:component="x-component"] #label');
        await expect(label).toHaveText('Count: 1 ');

        await updateState(page, 'x-component', { count: 2 });
        await expect(label).toHaveText('Count: 2 ');
    });

    test('leaves unmatched braces as literal text', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span id="label">Count: {count</span></div>');
        await page.setContent('<x-component count="1"></x-component>');

        const label = page.locator('[x\\:component="x-component"] #label');
        await expect(label).toHaveText('Count: {count');
    });

    test('supports nested braces in expressions', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span id="label">{{ ({ value: this.state.count }).value }}</span></div>');
        await page.setContent('<x-component count="2"></x-component>');

        const label = page.locator('[x\\:component="x-component"] #label');
        await expect(label).toHaveText('2');
    });

    test('supports interpolation with escaped quotes', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span id="label">{{ `He said: \'${this.state.word}\'` }}</span></div>');
        await page.setContent('<x-component word="hi"></x-component>');

        const label = page.locator('[x\\:component="x-component"] #label');
        await expect(label).toHaveText('He said: \'hi\'');
    });

    test('binds multiple interpolations within the same text node', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span id="label">A:{count} B:{{ this.state.count + 1 }}</span></div>');
        await page.setContent('<x-component count="1"></x-component>');

        const label = page.locator('[x\\:component="x-component"] #label');
        await expect(label).toHaveText('A:1 B:2');

        await updateState(page, 'x-component', { count: 2 });
        await expect(label).toHaveText('A:2 B:3');
    });

    test('decodes HTML entities in expressions', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><span id="label">{{ this.state.count &gt; 1 ? "yes" : "no" }}</span></div>');
        await page.setContent('<x-component count="1"></x-component>');

        const label = page.locator('[x\\:component="x-component"] #label');
        await expect(label).toHaveText('no');

        await updateState(page, 'x-component', { count: 2 });
        await expect(label).toHaveText('yes');
    });
});
