import type { ProjectModule } from './project/schema';
export const mathLibrary: ProjectModule = { id: 'builtin-math', alias: 'math', builtin: 'tensorflow', referenceUrl: 'https://www.tensorflow.org/js' };
export function withMath(modules: ProjectModule[] = []): ProjectModule[] {
  if (modules.some(m => m.builtin === 'tensorflow')) return modules;
  const legacy = modules.find(m => m.id.startsWith('builtin-math') && m.source?.startsWith('// Small, dependency-free numeric kernels'));
  if (legacy) return modules.map(m => m === legacy ? { ...mathLibrary, id: m.id, alias: m.alias } : m);
  let id = mathLibrary.id; while (modules.some(m => m.id === id)) id += '-math';
  let alias = 'math'; while (modules.some(m => m.alias === alias)) alias = alias === 'math' ? 'tensorMath' : alias + '_';
  return [...modules, { ...mathLibrary, id, alias }];
}
