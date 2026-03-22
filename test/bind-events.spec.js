import { test, expect } from '@playwright/test';
import { attachMethod, defineComponent, initializePage } from './support/utils.js';

test.describe('Component event bindings', () => {
    test.beforeEach(async ({ page }) => {
        await initializePage(page);
    });

    test('binds events to component methods', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<button @click="onClick"></button>');
        await attachMethod(page, 'XComponent', 'onClick', function() {
            this.state.clicked = true;
        });

        await page.setContent('<x-component></x-component>');

        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            root.dispatchEvent(new Event('click'));
        });

        const clicked = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.clicked;
        });

        expect(clicked).toBe(true);
    });

    test('binds anonymous function handlers', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<button @click="() => { this.state.count = (this.state.count || 0) + 1; }"></button>');

        await page.setContent('<x-component></x-component>');

        const count = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            root.dispatchEvent(new Event('click'));
            return root.component.state.count;
        });

        expect(count).toBe(1);
    });

    test('throws when event handler is a bare expression', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<button @click="this.state.count = 1"></button>');
        const errorPromise = page.waitForEvent('pageerror');
        await page.setContent('<x-component></x-component>');
        const error = await errorPromise;
        expect(error.message).toContain('must be a component method, function expression, or braced statement body');
    });

    test('throws when event handler resolves to a non-function component property', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div><button x:key="button" @click="button"></button></div>');
        const errorPromise = page.waitForEvent('pageerror');
        await page.setContent('<x-component></x-component>');
        const error = await errorPromise;
        expect(error.message).toContain('must be a component method, function expression, or braced statement body');
    });

    test('throws when event handler resolves to an inherited DOM method', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<button @click="remove"></button>');
        const errorPromise = page.waitForEvent('pageerror');
        await page.setContent('<x-component></x-component>');
        const error = await errorPromise;
        expect(error.message).toContain('must be a component method, function expression, or braced statement body');
    });

    test('handles empty event handlers as no-ops', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<button @click></button>');

        await page.setContent('<x-component></x-component>');

        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            root.dispatchEvent(new Event('click', { bubbles: true }));
        });

        await expect(page.locator('[x\\:component="x-component"]')).toHaveCount(1);
    });

    test('applies @click.prevent modifier', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<button @click.prevent="onClick"></button>');
        await attachMethod(page, 'XComponent', 'onClick', function(event) {
            this.state.defaultPrevented = event.defaultPrevented;
        });

        await page.setContent('<x-component></x-component>');

        const defaultPrevented = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            const clickEvent = new Event('click', { bubbles: true, cancelable: true });
            root.dispatchEvent(clickEvent);
            return root.component.state.defaultPrevented;
        });

        expect(defaultPrevented).toBe(true);
    });

    test('applies @click.stop modifier', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<button @click.stop="onClick"></button>');
        await attachMethod(page, 'XComponent', 'onClick', function() {
            this.state.clicked = true;
        });

        await page.setContent('<div id="wrap"><x-component></x-component></div>');

        const result = await page.evaluate(() => {
            const wrap = document.querySelector('#wrap');
            const root = document.querySelector('[x\\:component="x-component"]');
            let bubbled = false;
            wrap.addEventListener('click', () => {
                bubbled = true;
            });

            root.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

            return {
                bubbled,
                clicked: root.component.state.clicked,
            };
        });

        expect(result.clicked).toBe(true);
        expect(result.bubbled).toBe(false);
    });

    test('applies @click.once modifier', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<button @click.once="onClick"></button>');
        await attachMethod(page, 'XComponent', 'onClick', function() {
            this.state.clicked = (this.state.clicked || 0) + 1;
        });

        await page.setContent('<x-component></x-component>');

        const clicked = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            root.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
            root.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
            return root.component.state.clicked;
        });

        expect(clicked).toBe(1);
    });

    test('applies @click.self modifier', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div id="outer" @click.self="onClick"><span id="inner"></span></div>');
        await attachMethod(page, 'XComponent', 'onClick', function() {
            this.state.clicked = (this.state.clicked || 0) + 1;
        });

        await page.setContent('<x-component></x-component>');

        await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            const inner = root.querySelector('#inner');
            inner.dispatchEvent(new Event('click', { bubbles: true }));
            root.dispatchEvent(new Event('click', { bubbles: true }));
        });

        const clicked = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            return root.component.state.clicked;
        });

        expect(clicked).toBe(1);
    });

    test('applies @click.capture modifier', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<div id="outer" @click.capture="onClick"><button id="inner"></button></div>');
        await attachMethod(page, 'XComponent', 'onClick', function() {
            this.state.clicked = true;
        });

        await page.setContent('<x-component></x-component>');

        const clicked = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            const inner = root.querySelector('#inner');
            inner.dispatchEvent(new Event('click', { bubbles: true }));
            return root.component.state.clicked;
        });

        expect(clicked).toBe(true);
    });

    test('applies @click.passive modifier', async ({ page }) => {
        await defineComponent(page, 'x-component', 'XComponent', '<button @click.passive="onClick"></button>');
        await attachMethod(page, 'XComponent', 'onClick', function(event) {
            this.state.defaultPrevented = event.defaultPrevented;
            event.preventDefault();
        });

        await page.setContent('<x-component></x-component>');

        const defaultPrevented = await page.evaluate(() => {
            const root = document.querySelector('[x\\:component="x-component"]');
            const clickEvent = new Event('click', { bubbles: true, cancelable: true });
            root.dispatchEvent(clickEvent);
            return root.component.state.defaultPrevented;
        });

        expect(defaultPrevented).toBe(false);
    });

    test('binds custom events dispatched by shadow child components', async ({ page }) => {
        await defineComponent(page, 'x-child', 'XChild', '<button id="save" @click="{ this.dispatch(\'save\') }">save</button>');
        await defineComponent(page, 'x-parent', 'XParent', '<div><x-child @save="onSave"></x-child></div>');
        await page.evaluate(() => {
            window.XChild.shadowMode = 'open';
        });
        await attachMethod(page, 'XParent', 'onSave', function(event) {
            this.state.currentTargetTag = event.currentTarget.tagName.toLowerCase();
            this.state.targetTag = event.target.tagName.toLowerCase();
        });

        await page.setContent('<x-parent></x-parent>');

        await page.waitForFunction(() => {
            const child = document.querySelector('[x\\:component="x-parent"] x-child');
            return !!child?.renderRoot?.querySelector('#save');
        });

        await page.evaluate(() => {
            const child = document.querySelector('[x\\:component="x-parent"] x-child');
            child.renderRoot.querySelector('#save').click();
        });

        const result = await page.evaluate(() => {
            const parent = document.querySelector('[x\\:component="x-parent"]');
            return {
                currentTargetTag: parent.component.state.currentTargetTag,
                targetTag: parent.component.state.targetTag,
            };
        });

        expect(result).toEqual({
            currentTargetTag: 'x-child',
            targetTag: 'x-child',
        });
    });

    test('binds bubbled custom events on child component hosts', async ({ page }) => {
        await defineComponent(page, 'x-item', 'XItem', '<button id="remove" @click="{ this.dispatch(\'remove\') }">remove</button>');
        await defineComponent(page, 'x-list', 'XList', '<ul><slot></slot></ul>');
        await defineComponent(page, 'x-parent', 'XParent', '<div><x-list @remove="onRemove"><x-item state="({ id: 1 })"></x-item></x-list></div>');
        await page.evaluate(() => {
            window.XItem.shadowMode = 'open';
            window.XList.shadowMode = 'open';
        });
        await attachMethod(page, 'XParent', 'onRemove', function(event) {
            this.state.currentTargetTag = event.currentTarget.tagName.toLowerCase();
            this.state.targetTag = event.target.tagName.toLowerCase();
            this.state.itemId = event.target.state.id;
        });

        await page.setContent('<x-parent></x-parent>');

        await page.waitForFunction(() => {
            const item = document.querySelector('[x\\:component="x-parent"] x-list x-item');
            return !!item?.renderRoot?.querySelector('#remove');
        });

        await page.evaluate(() => {
            const item = document.querySelector('[x\\:component="x-parent"] x-list x-item');
            item.renderRoot.querySelector('#remove').click();
        });

        const result = await page.evaluate(() => {
            const parent = document.querySelector('[x\\:component="x-parent"]');
            return {
                currentTargetTag: parent.component.state.currentTargetTag,
                targetTag: parent.component.state.targetTag,
                itemId: parent.component.state.itemId,
            };
        });

        expect(result).toEqual({
            currentTargetTag: 'x-list',
            targetTag: 'x-item',
            itemId: 1,
        });
    });
});
