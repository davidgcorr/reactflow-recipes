import type { ModuleDependency } from '../code-config';
import { parseCodeFields, validVariable } from '../code-config';
export type ProjectModule = { id: string; alias: string; builtin?: 'tensorflow'; referenceUrl?: string; filename?: string; source?: string; url?: string; dependencies?: ModuleDependency[] };
export type Operation = { type: 'function' | 'construct' | 'method' | 'property' | 'export' | 'code'; moduleId?: string; exportName?: string; member?: string; uses?: string[]; effect: 'pure' | 'step' | 'event' };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseModules(value: unknown): ProjectModule[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error('Expected up to 64 project modules.');
  const ids = new Set(), aliases = new Set();
  return value.map(m => {
    if (!object(m) || typeof m.id !== 'string' || !m.id || m.id.length > 128 || ids.has(m.id) || typeof m.alias !== 'string' || !validVariable(m.alias) || aliases.has(m.alias)) throw new Error('Project modules need unique IDs and JavaScript aliases.');
    ids.add(m.id); aliases.add(m.alias);
    if (m.filename !== undefined && (typeof m.filename !== 'string' || !m.filename || m.filename.length > 255 || /[\\/]/.test(m.filename))) throw new Error('Invalid module filename.');
    if (m.builtin !== undefined) {
      if (m.builtin !== 'tensorflow' || m.source !== undefined || m.url !== undefined || m.dependencies !== undefined || m.referenceUrl !== 'https://www.tensorflow.org/js') throw new Error('Invalid bundled TensorFlow.js library.');
      return { id: m.id, alias: m.alias, builtin: 'tensorflow' as const, referenceUrl: m.referenceUrl };
    }
    const fields = parseCodeFields({ dependencies: [{ specifier: m.alias, ...(m.url !== undefined ? { url: m.url } : {}), ...(m.source !== undefined ? { source: m.source } : {}) }] }, []);
    const dependencies = m.dependencies === undefined ? undefined : parseCodeFields({ dependencies: m.dependencies }, []).dependencies;
    return { id: m.id, alias: m.alias, ...(m.filename !== undefined ? { filename: m.filename as string } : {}), ...(fields.dependencies![0].url !== undefined ? { url: fields.dependencies![0].url } : { source: fields.dependencies![0].source }), ...(dependencies ? { dependencies } : {}) };
  });
}
export function parseOperation(value: unknown): Operation {
  if (!object(value) || !['function', 'construct', 'method', 'property', 'export', 'code'].includes(String(value.type)) || !['pure', 'step', 'event'].includes(String(value.effect))) throw new Error('Invalid computation operation.');
  for (const key of ['moduleId', 'exportName', 'member']) if (value[key] !== undefined && (typeof value[key] !== 'string' || !value[key] || (value[key] as string).length > 128 || ['__proto__', 'constructor', 'prototype'].includes(value[key] as string))) throw new Error(`Invalid operation ${key}.`);
  if (['function', 'construct', 'export'].includes(String(value.type)) && (!value.moduleId || !value.exportName)) throw new Error('Choose a project module and export.');
  if (['method', 'property'].includes(String(value.type)) && !value.member) throw new Error('Choose an instance member.');
  if (value.uses !== undefined && (!Array.isArray(value.uses) || value.uses.length > 64 || value.uses.some(v => typeof v !== 'string' || !validVariable(v)) || new Set(value.uses).size !== value.uses.length)) throw new Error('Invalid module uses list.');
  return { type: value.type as Operation['type'], effect: value.effect as Operation['effect'], ...Object.fromEntries(['moduleId', 'exportName', 'member', 'uses'].filter(k => value[k] !== undefined).map(k => [k, value[k]])) };
}
export const defaultComputeSource = `export function run({ inputs, modules, state, parameters, tick }) {
  // Project modules are available by alias, e.g. modules.linalg.matmul(a, b).
  return { result: inputs.input1 ?? parameters };
}`;
export const exampleModuleSource = `export const EPSILON = 1e-6;
export function add(a, b) { return a + b; }
export function matmul(a, b) {
  if (!a.length || !b.length || a[0].length !== b.length || a.some(r => r.length !== a[0].length) || b.some(r => r.length !== b[0].length)) throw new Error('Incompatible matrix shapes');
  return a.map(row => b[0].map((_, j) => row.reduce((sum, x, k) => sum + x * b[k][j], 0)));
}
export class Accumulator {
  constructor(initial = 0) { this.value = initial; }
  add(amount) { this.value += amount; return this.value; }
  read() { return this.value; }
  reset() { this.value = 0; }
}
// Optional hints for visual ports; arbitrary APIs can also be configured in Properties.
export const milver = { add: { args: ['a', 'b'] }, matmul: { args: ['a', 'b'] }, Accumulator: { args: ['initial'], methods: { add: { args: ['amount'] }, read: { args: [] }, reset: { args: [] } } } };
`;
