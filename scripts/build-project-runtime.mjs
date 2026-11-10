import { build } from 'vite';
await build({ configFile: false, publicDir: false, build: { lib: { entry: 'src/project/worker.ts', name: 'MilverProjectRuntime', formats: ['iife'], fileName: () => 'project-runtime.js' }, outDir: 'public', emptyOutDir: false, minify: true, sourcemap: false } });
