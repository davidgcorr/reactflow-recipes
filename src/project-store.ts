import { parseDiagram, serializeDiagram, type Diagram } from './model';
export const projectsKey = 'milver.projects.v1';
export type StoredProject = { id: string; name: string; updatedAt: string; json: string };
export function readProjects(storage: Pick<Storage, 'getItem'>): StoredProject[] {
  const raw = storage.getItem(projectsKey);
  if (!raw) return [];
  const records = JSON.parse(raw);
  if (!Array.isArray(records)) throw new Error('Could not read stored projects.');
  const ids = new Set<string>();
  return records.map(record => {
    if (!record || typeof record.id !== 'string' || ids.has(record.id) || typeof record.name !== 'string' || typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt)) || typeof record.json !== 'string') throw new Error('Invalid stored project.');
    ids.add(record.id); const diagram = parseDiagram(record.json);
    return { id: record.id, name: diagram.name, updatedAt: record.updatedAt, json: record.json };
  });
}
export function writeProjects(storage: Pick<Storage, 'setItem'>, projects: StoredProject[]) {
  // A failed/quota-limited write leaves both the previous store and UI intact.
  storage.setItem(projectsKey, JSON.stringify(projects));
}
export function storeProject(diagram: Diagram, id = crypto.randomUUID()): StoredProject {
  const json = serializeDiagram(diagram);parseDiagram(json);
  return { id, name: diagram.name, updatedAt: new Date().toISOString(), json };
}
export function renameProject(project: StoredProject, name: string): StoredProject {
  if (!name.trim()) throw new Error('Enter a project name.');
  return storeProject({ ...parseDiagram(project.json), name: name.trim() }, project.id);
}
