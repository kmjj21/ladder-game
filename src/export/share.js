export function canShareFile(file, nav=globalThis.navigator) {
  try {return !!file && typeof nav?.share==='function' && typeof nav?.canShare==='function' && nav.canShare({files:[file]});}
  catch {return false;}
}

// Generation can outlast transient activation. Keep the file for a fresh tap.
export async function shareFile(file,{gesture=false,nav=globalThis.navigator}={}) {
  if(!canShareFile(file,nav)) return 'unsupported';
  if(!gesture && !nav.userActivation?.isActive) return 'ready';
  try {await nav.share({files:[file],title:'사다리 타기 결과'});return 'shared';}
  catch(error) {
    if(error.name==='AbortError') return 'cancelled';
    if(error.name==='NotAllowedError') return 'ready';
    return 'failed';
  }
}
