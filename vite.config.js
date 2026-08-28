import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
    const isUmd = mode === 'umd';

    return {
        build: {
            emptyOutDir: !isUmd,
            lib: {
                entry: 'src/index.js',
                name: 'Component',
            },
            minify: false,
            outDir: 'dist',
            rolldownOptions: {
                external: isUmd ? [] : ['@fr0st/state'],
                output: isUmd ? [
                    {
                        entryFileNames: 'frost-component.js',
                        format: 'umd',
                        minify: false,
                        name: 'Component',
                    },
                    {
                        entryFileNames: 'frost-component.min.js',
                        format: 'umd',
                        minify: true,
                        name: 'Component',
                    },
                ] : [
                    {
                        entryFileNames: 'frost-component.esm.js',
                        format: 'es',
                        minify: false,
                    },
                    {
                        entryFileNames: 'frost-component.esm.min.js',
                        format: 'es',
                        minify: true,
                    },
                ],
            },
            sourcemap: true,
            target: 'baseline-widely-available',
        },
    };
});
