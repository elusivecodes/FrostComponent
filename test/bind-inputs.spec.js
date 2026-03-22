import { test, expect } from '@playwright/test';
import { defineComponent, initializePage } from './support/utils.js';

test.describe('Component input bindings', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('binds input values with x:bind', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><input id="name" x:bind="name"></div>');
        await page.setContent('<x-component name="alice"></x-component>');

        const input = page.locator('[x\\:component="x-component"] #name');
        await expect(input).toHaveValue('alice');

        await input.fill('bob');
        await input.dispatchEvent('input');

        const name = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.name;
        });

        expect(name).toBe('bob');
    });

    test('updates bound input on change event', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><input id="name" x:bind="name"></div>');
        await page.setContent('<x-component name="alice"></x-component>');

        const input = page.locator('[x\\:component="x-component"] #name');
        await input.fill('bob');
        await input.dispatchEvent('change');

        const name = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.name;
        });

        expect(name).toBe('bob');
    });

    test('updates input UI when bound state changes', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><input id="name" x:bind="name"></div>');
        await page.setContent('<x-component name="alice"></x-component>');

        const input = page.locator('[x\\:component="x-component"] #name');
        await expect(input).toHaveValue('alice');

        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            root.component.state.name = 'bob';
        });

        await expect(input).toHaveValue('bob');
    });

    test('binds checkbox array values with x:bind', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><input id="a" type="checkbox" value="a" x:bind="tags"><input id="b" type="checkbox" value="b" x:bind="tags"></div>');
        await page.setContent(`<x-component tags="['a']"></x-component>`);

        const a = page.locator('[x\\:component="x-component"] #a');
        const b = page.locator('[x\\:component="x-component"] #b');

        await expect(a).toBeChecked();
        await expect(b).not.toBeChecked();

        await b.check();
        await b.dispatchEvent('change');

        const tags = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.tags;
        });

        expect(tags).toEqual(['a', 'b']);
    });

    test('removes unchecked checkbox values from bound array', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><input id="a" type="checkbox" value="a" x:bind="tags"><input id="b" type="checkbox" value="b" x:bind="tags"></div>');
        await page.setContent(`<x-component tags="['a', 'b']"></x-component>`);

        const a = page.locator('[x\\:component="x-component"] #a');
        const b = page.locator('[x\\:component="x-component"] #b');

        await expect(a).toBeChecked();
        await expect(b).toBeChecked();

        await a.uncheck();
        await a.dispatchEvent('change');

        const tags = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.tags;
        });

        expect(tags).toEqual(['b']);
    });

    test('binds checkbox boolean values with x:bind', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><input id="flag" type="checkbox" x:bind="enabled"></div>');
        await page.setContent('<x-component enabled="false"></x-component>');

        const checkbox = page.locator('[x\\:component="x-component"] #flag');
        await expect(checkbox).not.toBeChecked();

        await checkbox.check();
        await checkbox.dispatchEvent('change');

        const enabled = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.enabled;
        });

        expect(enabled).toBe(true);
    });

    test('updates checkbox UI when bound boolean state changes', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><input id="flag" type="checkbox" x:bind="enabled"></div>');
        await page.setContent('<x-component enabled="false"></x-component>');

        const checkbox = page.locator('[x\\:component="x-component"] #flag');
        await expect(checkbox).not.toBeChecked();

        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            root.component.state.enabled = true;
        });

        await expect(checkbox).toBeChecked();
    });

    test('binds select multiple values with x:bind', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><select id="sel" multiple x:bind="items"><option value="a">a</option><option value="b">b</option></select></div>');
        await page.setContent(`<x-component items="['b']"></x-component>`);

        const select = page.locator('[x\\:component="x-component"] #sel');
        await expect(select).toHaveValues(['b']);

        await select.selectOption([{ value: 'a' }, { value: 'b' }]);
        await select.dispatchEvent('change');

        const items = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.items.slice().sort();
        });

        expect(items).toEqual(['a', 'b']);
    });

    test('binds select single values with x:bind', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><select id="sel" x:bind="choice"><option value="a">a</option><option value="b">b</option></select></div>');
        await page.setContent('<x-component choice="b"></x-component>');

        const select = page.locator('[x\\:component="x-component"] #sel');
        await expect(select).toHaveValue('b');

        await select.selectOption({ value: 'a' });
        await select.dispatchEvent('change');

        const choice = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.choice;
        });

        expect(choice).toBe('a');
    });

    test('updates select single UI when bound state changes', async ({ page }) => {
        await defineComponent(
            page,
            'x-component',
            'XComponent',
            '<div><select id="single" x:bind="choice"><option value="a">a</option><option value="b">b</option></select></div>',
        );
        await page.setContent('<x-component choice="a"></x-component>');

        const single = page.locator('[x\\:component="x-component"] #single');
        await expect(single).toHaveValue('a');

        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            root.component.state.choice = 'b';
        });

        await expect(single).toHaveValue('b');
    });

    test('updates select multiple UI when bound state changes', async ({ page }) => {
        await defineComponent(
            page,
            'x-component',
            'XComponent',
            '<div><select id="multi" multiple x:bind="items"><option value="a">a</option><option value="b">b</option></select></div>',
        );
        await page.setContent('<x-component items="[\'a\']"></x-component>');

        const multi = page.locator('[x\\:component="x-component"] #multi');
        await expect(multi).toHaveValues(['a']);

        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            root.component.state.items = ['a', 'b'];
        });

        await expect(multi).toHaveValues(['a', 'b']);
    });

    test('binds radio inputs with x:bind', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><input id="a" type="radio" name="r" value="a" x:bind="choice"><input id="b" type="radio" name="r" value="b" x:bind="choice"></div>');
        await page.setContent('<x-component choice="a"></x-component>');

        const a = page.locator('[x\\:component="x-component"] #a');
        const b = page.locator('[x\\:component="x-component"] #b');

        await expect(a).toBeChecked();
        await expect(b).not.toBeChecked();

        await b.check();
        await b.dispatchEvent('change');

        const choice = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.choice;
        });

        expect(choice).toBe('b');
    });

    test('clears radio state when unchecked', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><input id="a" type="radio" name="r" value="a" x:bind="choice"></div>');
        await page.setContent('<x-component choice="a"></x-component>');

        const radio = page.locator('[x\\:component="x-component"] #a');
        await expect(radio).toBeChecked();

        await radio.evaluate((node) => {
            node.checked = false;
            node.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const choice = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.choice;
        });

        expect(choice).toBeUndefined();
    });

    test('updates radio UI when bound state changes', async ({ page }) => {
        await defineComponent(
            page,
            'x-component',
            'XComponent',
            '<div>' +
                '<input id="r-a" type="radio" name="r" value="a" x:bind="pick">' +
                '<input id="r-b" type="radio" name="r" value="b" x:bind="pick">' +
            '</div>',
        );
        await page.setContent('<x-component pick="a"></x-component>');

        const rA = page.locator('[x\\:component="x-component"] #r-a');
        const rB = page.locator('[x\\:component="x-component"] #r-b');

        await expect(rA).toBeChecked();
        await expect(rB).not.toBeChecked();

        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            root.component.state.pick = 'b';
        });

        await expect(rA).not.toBeChecked();
        await expect(rB).toBeChecked();
    });
});
