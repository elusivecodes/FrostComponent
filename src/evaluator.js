const textarea = document.createElement('textarea');

/**
 * Builds an evaluator for a binding expression.
 * @param {Component} component The component that owns the expression.
 * @param {string} expression The expression string to evaluate.
 * @param {*} [defaultValue] The fallback value to use when resolving a state path.
 * @returns {() => *} A callback that resolves the current expression value.
 */
export function evaluator(component, expression, defaultValue) {
    textarea.innerHTML = expression;
    expression = textarea.value.trim();

    if (!expression) {
        return () => null;
    }

    if (
        (expression.startsWith('{') && expression.endsWith('}')) ||
        (expression.startsWith('({') && expression.endsWith('})'))
    ) {
        expression = expression.slice(1, -1).trim();

        return Function.constructor(`return ${expression};`).bind(component);
    }

    return () => component.state(expression, defaultValue).value;
};
