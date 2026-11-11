import { useRef, useState } from 'react';
import { Download, FolderOpen, Plus, Save, Trash2, Upload } from 'lucide-react';
import { parseDiagram, type Diagram } from '@/model';
import { readProjects, renameProject, storeProject, writeProjects, type StoredProject } from '@/project-store';
import { downloadBlob } from '@/export/download';
import { exportFilename } from '@/export/scene';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { IconButton } from './editor-ui';

export function ProjectsDialog({ diagram, close, openProject }: { diagram: Diagram; close: () => void; openProject: (diagram: Diagram) => void }) {
  const [initial] = useState(() => { try { return { projects: readProjects(localStorage), error: '' }; } catch (error) { return { projects: [], error: String(error) }; } });
  const [projects, setProjects] = useState(initial.projects), [error, setError] = useState(initial.error);
  const file = useRef<HTMLInputElement>(null);
  const run = (action: () => void) => { try { action(); setError(''); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } };
  const commit = (next: StoredProject[]) => { if (initial.error) throw new Error('Stored projects could not be read. Download the current project to keep a copy.'); writeProjects(localStorage, next); setProjects(next); };
  const download = (project: StoredProject) => downloadBlob(new Blob([project.json], { type: 'application/json' }), exportFilename(project.name, 'json'));
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="projects-dialog"><DialogHeader><DialogTitle>Projects</DialogTitle><DialogDescription>Store projects in this browser. Import or download JSON to move them between devices.</DialogDescription></DialogHeader>
    <div className="project-store-actions"><Button size="sm" onClick={() => run(() => commit([storeProject(diagram), ...projects]))}><Plus/>Save current project</Button><Button size="sm" variant="outline" onClick={() => file.current?.click()}><Upload/>Import JSON</Button><Button size="sm" variant="outline" onClick={() => run(() => download(storeProject(diagram)))}><Download/>Download current</Button></div>
    {error && <p role="alert" className="code-error">{error}</p>}
    <div className="project-store-list">{!projects.length && <p className="field-help">No stored projects yet.</p>}{projects.map(project => <div className="project-store-row" key={project.id}><div className="project-store-name"><Input key={project.name} aria-label={`Name of ${project.name}`} defaultValue={project.name} onBlur={event => { const name = event.target.value; if (name !== project.name) run(() => commit(projects.map(p => p.id === project.id ? renameProject(p, name) : p))); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/><small>{new Date(project.updatedAt).toLocaleString()}</small></div><div className="project-store-row-actions"><Button size="sm" variant="secondary" onClick={() => run(() => { openProject(parseDiagram(project.json)); close(); })}><FolderOpen/>Open</Button><IconButton label={`Update ${project.name} from canvas`} onClick={() => run(() => commit(projects.map(p => p.id === project.id ? storeProject({ ...diagram, name: project.name }, p.id) : p)))}><Save/></IconButton><IconButton label={`Download ${project.name}`} onClick={() => run(() => download(project))}><Download/></IconButton><IconButton label={`Delete stored ${project.name}`} onClick={() => run(() => commit(projects.filter(p => p.id !== project.id)))}><Trash2/></IconButton></div></div>)}</div>
    <input className="sr-only" type="file" multiple accept=".json,application/json" aria-label="Import stored projects" ref={file} onChange={async event => { const files = [...(event.target.files ?? [])]; event.target.value = ''; try { const imported = await Promise.all(files.map(async file => storeProject(parseDiagram(await file.text())))); commit([...imported, ...projects]); setError(''); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } }}/>
  </DialogContent></Dialog>;
}
