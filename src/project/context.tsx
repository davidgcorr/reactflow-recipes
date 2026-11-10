import { createContext } from 'react';
import type { BlockNode } from '../model';
import type { ModuleInfo, NodeResult } from './engine';
import type { ProjectModule } from './schema';
export const ProjectContext = createContext<{
  modules: ProjectModule[]; catalog: ModuleInfo[]; values: Record<string, NodeResult>;
  loadExample: () => void;
  createModule: (source?: string, filename?: string, url?: string) => void;
  updateModule: (module: ProjectModule) => void; removeModule: (id: string) => void; addBlock: (block: BlockNode) => void;
}>({ modules: [], catalog: [], values: {}, loadExample() {}, createModule() {}, updateModule() {}, removeModule() {}, addBlock() {} });
