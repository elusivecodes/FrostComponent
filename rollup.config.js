'use strict';

import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/frost-component.js',
        format: 'umd',
        name: 'Component',
        sourcemap: true,
    },
    plugins: [nodeResolve()],
};
