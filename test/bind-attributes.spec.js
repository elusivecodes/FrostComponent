import { test, expect } from '@playwright/test';
import { defineComponent, initializePage, updateState } from './support/utils.js';

test.describe('Component attribute bindings', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('binds attribute expressions', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :title="title"></div></div>');
        await page.setContent('<x-component title="hello"></x-component>');

        const box = page.locator('[x\\:component="x-component"] #box');
        await expect(box).toHaveAttribute('title', 'hello');

        await updateState(page, 'x-component', { title: 'world' });
        await expect(box).toHaveAttribute('title', 'world');
    });

    test('supports attribute expressions wrapped in braces', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :title="{ this.state.title }"></div></div>');
        await page.setContent('<x-component title="hello"></x-component>');

        const box = page.locator('[x\\:component="x-component"] #box');
        await expect(box).toHaveAttribute('title', 'hello');

        await updateState(page, 'x-component', { title: 'world' });
        await expect(box).toHaveAttribute('title', 'world');
    });

    test('removes bound attributes when value is null', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :title="title"></div></div>');
        await page.setContent('<x-component title="hello"></x-component>');

        const box = page.locator('[x\\:component="x-component"] #box');
        await expect(box).toHaveAttribute('title', 'hello');

        await updateState(page, 'x-component', { title: null });
        await expect(box).not.toHaveAttribute('title', 'hello');
    });

    test('binds class attributes with object values', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :class="({ active: this.state.active })"></div></div>');
        await page.setContent('<x-component active="true"></x-component>');

        const box = page.locator('[x\\:component="x-component"] #box');
        await expect(box).toHaveClass('active');

        await updateState(page, 'x-component', { active: false });
        await expect(box).toHaveClass('');
    });

    test('binds class with array values', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :class="classes"></div></div>');
        await page.setContent(`<x-component classes="['a', 'b']"></x-component>`);

        const box = page.locator('[x\\:component="x-component"] #box');
        await expect(box).toHaveClass('a b');
    });

    test('binds class with string values and replaces previous classes', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :class="classes"></div></div>');
        await page.setContent(`<x-component classes="['a', 'b']"></x-component>`);

        const box = page.locator('[x\\:component="x-component"] #box');
        await updateState(page, 'x-component', { classes: 'c' });
        await expect(box).toHaveClass('c');
    });

    test('updates class bindings across array, object, and string values', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :class="classes"></div></div>');
        await page.setContent(`<x-component classes="['a', 'b']"></x-component>`);

        const box = page.locator('[x\\:component="x-component"] #box');
        await expect(box).toHaveClass('a b');

        await updateState(page, 'x-component', { classes: { c: true, d: false } });
        await expect(box).toHaveClass('c');

        await updateState(page, 'x-component', { classes: 'e' });
        await expect(box).toHaveClass('e');
    });

    test('binds style attributes with object values', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :style="({ color: this.state.color })"></div></div>');
        await page.setContent('<x-component color="red"></x-component>');

        const box = page.locator('[x\\:component="x-component"] #box');
        await expect(box).toHaveCSS('color', 'rgb(255, 0, 0)');

        await updateState(page, 'x-component', { color: 'blue' });
        await expect(box).toHaveCSS('color', 'rgb(0, 0, 255)');
    });

    test('clears removed keys from style object bindings', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :style="styles"></div></div>');
        await page.setContent('<x-component styles="{ color: \'red\', backgroundColor: \'blue\' }"></x-component>');

        const box = page.locator('[x\\:component="x-component"] #box');
        await expect(box).toHaveCSS('color', 'rgb(255, 0, 0)');
        await expect(box).toHaveCSS('background-color', 'rgb(0, 0, 255)');

        await updateState(page, 'x-component', { styles: { color: 'green' } });
        await expect(box).toHaveCSS('color', 'rgb(0, 128, 0)');
        await expect(box).not.toHaveCSS('background-color', 'rgb(0, 0, 255)');
    });

    test('binds style with string values and clears previous styles', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :style="style"></div></div>');
        await page.setContent('<x-component style="color: red;"></x-component>');

        const box = page.locator('[x\\:component="x-component"] #box');
        await expect(box).toHaveCSS('color', 'rgb(255, 0, 0)');

        await updateState(page, 'x-component', { style: 'color: blue;' });
        await expect(box).toHaveCSS('color', 'rgb(0, 0, 255)');
    });

    test('updates style bindings across object and string values', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><div id="box" :style="styles"></div></div>');
        await page.setContent('<x-component styles="{ color: \'red\', backgroundColor: \'blue\' }"></x-component>');

        const box = page.locator('[x\\:component="x-component"] #box');
        await expect(box).toHaveCSS('color', 'rgb(255, 0, 0)');
        await expect(box).toHaveCSS('background-color', 'rgb(0, 0, 255)');

        await updateState(page, 'x-component', { styles: 'color: green;' });
        await expect(box).toHaveCSS('color', 'rgb(0, 128, 0)');
        await expect(box).not.toHaveCSS('background-color', 'rgb(0, 0, 255)');

        await updateState(page, 'x-component', { styles: { color: 'black' } });
        await expect(box).toHaveCSS('color', 'rgb(0, 0, 0)');
    });

    test('binds :state to child component before initialization', async ({ page }) => {
        await defineComponent(page, 'x-parent', 'XParent', '<div><x-child :state="({ value: 1 })"></x-child></div>');
        await defineComponent(page, 'x-child', 'XChild', '<div></div>');

        const stateValue = await page.evaluate(() => new Promise((resolve) => {
            const el = document.createElement('x-parent');
            el.addEventListener('initialized', () => {
                const child = document.querySelector('[x\\:component="x-parent"] x-child');
                resolve(child?.getAttribute('state'));
            }, { once: true });
            document.body.appendChild(el);
        }));

        expect(stateValue).toBe(JSON.stringify({ value: 1 }));
    });

    test('binds :state to child component after initialization', async ({ page }) => {
        await defineComponent(page, 'x-parent', 'XParent', '<div><x-child :state="({ value: this.state.count })"></x-child></div>');
        await defineComponent(page, 'x-child', 'XChild', '<div></div>');
        await page.setContent('<x-parent count="1"></x-parent>');

        await page.waitForFunction(() => {
            const root = document.querySelector('[x\\:component="x-child"]');
            return root && root.component && root.component.initialized;
        });

        const initialValue = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-child"]');
            return root.component.state.value;
        });

        expect(initialValue).toBe(1);

        await updateState(page, 'x-parent', { count: 2 });

        const updatedValue = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-child"]');
            return root.component.state.value;
        });

        expect(updatedValue).toBe(2);
    });
});
