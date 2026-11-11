import { useContext } from 'react';
import { ProjectContext } from '@/project/context';
import { jsRecipes } from '@/js-recipes';
import { Button } from './ui/button';
import { IconButton } from './editor-ui';
import { Trash2, Plus, Bookmark } from 'lucide-react';
export function MyBlocks({ addExample }: { addExample: (recipe: string) => void }) {
  const { loadExample, myBlocks, insertSavedBlock, removeSavedBlock } = useContext(ProjectContext);
  return <div className="my-blocks"><div className="library-intro"><h3>My Blocks</h3><p>Save a JavaScript block from the inspector to reuse its code, rendering, ports and libraries.</p></div>
    {!myBlocks.length && <div className="library-empty"><Bookmark size={18}/><p>Your reusable blocks will appear here.</p></div>}
    {myBlocks.map(block => <div className="saved-block" key={block.id}><Button variant="ghost" className="saved-block-insert" onClick={() => insertSavedBlock(block)}><span className="saved-block-symbol">{block.data.ports.some(p => p.type === 'input') && <i className="palette-input"/>}JS{block.data.ports.some(p => p.type === 'output') && <i className="palette-output"/>}</span><span><strong>{block.name}</strong><small>{block.data.ports.filter(p => p.type === 'input').length} inputs · {block.data.ports.filter(p => p.type === 'output').length} outputs</small></span><Plus/></Button><IconButton label={`Delete saved block ${block.name}`} onClick={() => removeSavedBlock(block.id)}><Trash2/></IconButton></div>)}
    <div className="library-list-heading">Examples</div><Button variant="outline" size="sm" className="forward-example-button" onClick={loadExample}>Open transformer forward model</Button><div className="palette-grid">{['Three.js', 'LaTeX'].map(name => <Button key={name} variant="ghost" className="palette-tile" onClick={() => addExample(name)}><span className="palette-glyph"><i className="palette-input"/>{jsRecipes[name].symbol}<i className="palette-output"/></span><span>{name} example</span></Button>)}</div>
  </div>;
}
