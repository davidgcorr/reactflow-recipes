export function runtimeDocument(workerSource: string, token: string): string {
  const encode = (s: string) => JSON.stringify(s).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob: 'wasm-unsafe-eval'; worker-src blob:; connect-src https: http:;"></head><body><script>
const token=${encode(token)};let worker;
const send=data=>parent.postMessage({...data,token},'*');
try{
 const url=URL.createObjectURL(new Blob([${encode(workerSource)}],{type:'text/javascript'}));
 worker=new Worker(url);URL.revokeObjectURL(url);
 worker.onmessage=e=>send(e.data);
 worker.onerror=e=>send({type:'fatal',error:e.message||'Project worker failed.'});
 addEventListener('message',e=>{if(e.source!==parent||e.data?.token!==token)return;if(e.data.type==='stop'){worker.terminate();send({type:'stopped'});}else if(e.data.type==='execute')worker.postMessage(e.data);});
 addEventListener('pagehide',()=>worker.terminate());
}catch(e){send({type:'fatal',error:e.message});}
</script></body></html>`;
}
