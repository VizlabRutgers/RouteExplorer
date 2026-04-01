import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
    input: 'src/main.js',
    output: {
        dir: 'static/js'
    },
    plugins: [
    	commonjs(),
        nodeResolve()
    ]
};
