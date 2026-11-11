import mathSource from './math-library.js?raw';
import type { ProjectModule } from './project/schema';
export const mathLibrary: ProjectModule = { id: 'builtin-math', alias: 'math', filename: 'math.js', source: mathSource };
export function withMath(modules: ProjectModule[] = []): ProjectModule[] { if (modules.some(m => m.alias === 'math')) return modules; let id = mathLibrary.id; while (modules.some(m => m.id === id)) id += '-math'; return [...modules, { ...mathLibrary, id }]; }
