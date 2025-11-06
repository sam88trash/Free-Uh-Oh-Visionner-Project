const MANIFEST_URL = './videos.json';

const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const tpl = document.getElementById('cardTpl');
const searchInput = document.getElementById('search');
const sortSelect = document.getElementById('sort');

const modal = document.getElementById('modal');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const videoPlayer = document.getElementById('videoPlayer');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');

let videos = [];

// Utility: SHA-256 fingerprint
async function sha256Hex(str){
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Load manifest, force refresh if requested
async function loadManifest(force=false){
  try{
    const res = await fetch(MANIFEST_URL, { cache:'no-store' });
    if(!res.ok) throw new Error('Manifest not found');
    const text = await res.text();
    const parsed = JSON.parse(text);
    const newHash = await sha256Hex(text);
    const storedHash = localStorage.getItem('videos_manifest_hash');

    if(!force && storedHash && storedHash===newHash){
      if(!videos.length) { videos=parsed; renderGrid(); }
      return;
    }

    localStorage.setItem('videos_manifest_hash', newHash);
    videos = parsed;
    renderGrid();
  } catch(e){
    console.warn('Could not load manifest:', e);
    grid.innerHTML='';
    empty.style.display='block';
  }
}

// Render video cards (local or remote URLs)
function renderGrid(){
  const q = searchInput.value.trim().toLowerCase();
  let list = [...videos];
  if(sortSelect.value==='title') list.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
  if(q) list = list.filter(v => ((v.title||'')+' '+(v.description||'')).toLowerCase().includes(q));

  grid.innerHTML='';
  empty.style.display = list.length===0 ? 'block' : 'none';
  if(list.length===0) return;

  for(const v of list){
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector('.card');
    const img = node.querySelector('.thumb');
    const title = node.querySelector('.title');
    const desc = node.querySelector('.desc');

    card.dataset.file = v.file || v.embed || '';
    img.src = v.thumb || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="%23081223"/><text x="50%" y="50%" fill="%239aa4b2" font-size="24" text-anchor="middle" dominant-baseline="central">No+thumb</text></svg>';
    img.alt = v.title || 'video thumb';
    title.textContent = v.title || v.file || '';
    desc.textContent = v.description || '';

    // Clicking the card opens video player (works with any remote URL)
    card.addEventListener('click', ()=> openPlayer(v));
    grid.appendChild(node);
  }
}

// Open player (local or remote video)
function openPlayer(v){
  modal.style.display='flex';
  modal.setAttribute('aria-hidden','false');
  videoPlayer.src = v.file || '';
  videoPlayer.poster = v.thumb || '';
  videoPlayer.style.display='';
  videoPlayer.play().catch(()=>{});

  modalTitle.textContent = v.title || '';
  modalDesc.textContent = v.description || '';
  downloadBtn.onclick = ()=> { if(v.file) window.open(v.file,'_blank'); };
  document.body.style.overflow='hidden';
}

function closePlayer(){
  modal.style.display='none';
  modal.setAttribute('aria-hidden','true');
  try{ videoPlayer.pause(); videoPlayer.removeAttribute('src'); videoPlayer.load(); }catch(e){}
  document.body.style.overflow='';
}

closeBtn.addEventListener('click', closePlayer);
modal.addEventListener('click', e=>{ if(e.target===modal) closePlayer(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closePlayer(); });
searchInput.addEventListener('input', debounce(renderGrid,180));
sortSelect.addEventListener('change', renderGrid);
function debounce(fn, wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }}

loadManifest();
