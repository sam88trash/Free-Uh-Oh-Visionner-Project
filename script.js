// script.js - smarter/faster manifest cache-bypass + refresh button + optional auto-poll

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

// Create a refresh button in header
const header = document.querySelector('header .controls');
const refreshBtn = document.createElement('button');
refreshBtn.textContent = 'Refresh Videos';
refreshBtn.style.cursor = 'pointer';
refreshBtn.style.padding = '6px 10px';
refreshBtn.style.borderRadius = '8px';
refreshBtn.style.border = '1px solid rgba(255,255,255,0.06)';
refreshBtn.style.background = 'transparent';
refreshBtn.onclick = () => loadManifest(true); // force reload
header.appendChild(refreshBtn);

let videos = [];

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loadManifest(force=false) {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Manifest not found: ' + res.status);

    const text = await res.text();
    const parsed = JSON.parse(text);
    const newHash = await sha256Hex(text);
    const storedHash = localStorage.getItem('videos_manifest_hash');

    if(!force && storedHash && storedHash === newHash){
      if(!videos || videos.length === 0){
        videos = parsed;
        renderGrid();
      }
      return;
    }

    localStorage.setItem('videos_manifest_hash', newHash);
    videos = parsed;
    renderGrid();
  } catch (e) {
    console.warn('Could not load manifest:', e);
    grid.innerHTML = '';
    empty.style.display = 'block';
  }
}

function renderGrid(){
  const q = searchInput.value.trim().toLowerCase();
  let list = (videos || []).slice();
  if(sortSelect.value === 'title') list.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
  if(q) list = list.filter(v => ((v.title||'') + ' ' + (v.description||'')).toLowerCase().includes(q));

  grid.innerHTML = '';
  empty.style.display = list.length === 0 ? 'block' : 'none';
  if(list.length === 0) return;

  for(const v of list){
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector('.card');
    const img = node.querySelector('.thumb');
    const title = node.querySelector('.title');
    const desc = node.querySelector('.desc');

    card.dataset.file = v.file || v.embed || '';
    img.src = v.thumb || v.poster || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="%23081223"/><text x="50%" y="50%" fill="%239aa4b2" font-size="24" text-anchor="middle" dominant-baseline="central">No+thumb</text></svg>';
    img.alt = v.title || 'video thumb';
    title.textContent = v.title || v.file || v.embed || '';
    desc.textContent = v.description || '';

    card.addEventListener('click', ()=> openPlayer(v));
    grid.appendChild(node);
  }
}

function openPlayer(v){
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden','false');

  if(v.embed){
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.position = 'relative';
    wrapper.style.paddingTop = '56.25%';
    const iframe = document.createElement('iframe');
    iframe.src = v.embed;
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    wrapper.appendChild(iframe);

    const player = videoPlayer.parentElement;
    const existing = player.querySelector('.embed-wrapper');
    if(existing) existing.remove();
    videoPlayer.style.display = 'none';
    wrapper.className = 'embed-wrapper';
    player.insertBefore(wrapper, modalDesc);
  } else {
    const player = videoPlayer.parentElement;
    const existing = player.querySelector('.embed-wrapper');
    if(existing) existing.remove();
    videoPlayer.style.display = '';
    videoPlayer.src = v.file;
    videoPlayer.poster = v.thumb || '';
    videoPlayer.play().catch(()=>{});
  }

  modalTitle.textContent = v.title || v.file || v.embed || '';
  modalDesc.textContent = v.description || '';
  downloadBtn.onclick = ()=> {
    const target = v.file || v.embed;
    if(target) window.open(target, '_blank');
  };
  document.body.style.overflow = 'hidden';
}

function closePlayer(){
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden','true');
  try { videoPlayer.pause(); videoPlayer.removeAttribute('src'); videoPlayer.load(); } catch(e){}
  const player = videoPlayer.parentElement;
  const existing = player.querySelector('.embed-wrapper');
  if(existing) existing.remove();
  document.body.style.overflow = '';
}

closeBtn.addEventListener('click', closePlayer);
modal.addEventListener('click', (e)=>{ if(e.target===modal) closePlayer(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closePlayer(); });
searchInput.addEventListener('input', debounce(renderGrid, 180));
sortSelect.addEventListener('change', renderGrid);
function debounce(fn, wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }}

loadManifest();

// Optional: automatic polling every 60s
setInterval(loadManifest, 60*1000);
