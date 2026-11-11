import { createContext } from 'react';
import type { BlockNode, SavedBlock } from '../model';
import type { ModuleInfo, NodeResult } from './engine';
import type { ProjectModule } from './schema';
export const ProjectContext = createContext<{
  myBlocks: SavedBlock[]; saveBlock: (block: BlockNode) => void; removeSavedBlock: (id: string) => void; insertSavedBlock: (block: SavedBlock) => void;
  modules: ProjectModule[]; catalog: ModuleInfo[]; values: Record<string, NodeResult>;
  loadExample: () => void;
  createModule: (source?: string, filename?: string, url?: string) => void;
  updateModule: (module: ProjectModule) => void; removeModule: (id: string) => void; addBlock: (block: BlockNode) => void;
}>({ myBlocks: [], saveBlock() {}, removeSavedBlock() {}, insertSavedBlock() {}, modules: [], catalog: [], values: {}, loadExample() {}, createModule() {}, updateModule() {}, removeModule() {}, addBlock() {} });
