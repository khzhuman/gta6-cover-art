import { arrangements, treatments, dimensions, stock, bounded, findByKey, panelShapes, pointInPanel } from './templates.js';
import { paintCover, photoBounds, makePNG } from './cover.js';

const node = id => document.getElementById(id);
const library = new Map();
const history = { past:[], future:[] };
const pose = asset => ({ asset, horizontal:.5, vertical:.5, scale:1 });
let design = {
  template:'hero', grade:'sunset', size:'square', headline:'VICE SUMMER',
  tagline:'one last ride', intensity:72, grain:true,
  frames:[pose('portrait'),pose('car'),pose('beach')], personal:[]
};
let activeFrame=0, drag=null, queued=false, temporaryMark=false, markTimer, noticeTimer;
let outputLink=null, exporting=false, uploadSerial=0;
const canvas=node('preview');
const snapshot=()=>JSON.stringify(design);
const currentPose=()=>design.frames[activeFrame];
const currentSize=()=>findByKey(dimensions,design.size);

function notify(message) {
  clearTimeout(noticeTimer);
  node('notice').textContent=message;
  node('notice').hidden=false;
  noticeTimer=setTimeout(()=>node('notice').hidden=true,4000);
}

function checkpoint() {
  const before=snapshot();
  if (history.past.at(-1)!==before) history.past.push(before);
  if (history.past.length>60) history.past.shift();
  history.future=[];
}

function change(callback) { checkpoint(); callback(); synchronize(); }

function restore(source, target) {
  if (!source.length || drag) return;
  target.push(snapshot());
  design=JSON.parse(source.pop());
  activeFrame=Math.min(activeFrame,design.frames.length-1);
  synchronize();
}

function schedulePaint() {
  if (queued) return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    const area=node('stage'), size=currentSize();
    const width=Math.max(60,Math.min(area.clientWidth-52,(area.clientHeight-66)*size.width/size.height));
    const height=width*size.height/size.width;
    node('sheet').style.width=width+'px';
    node('sheet').style.height=height+'px';
    const density=Math.min(2,window.devicePixelRatio||1);
    paintCover(canvas,design,library,width*density,height*density,temporaryMark?activeFrame:-1);
  });
}

function markPanel() {
  temporaryMark=true;
  clearTimeout(markTimer);
  schedulePaint();
  markTimer=setTimeout(()=>{ temporaryMark=false; schedulePaint(); },1100);
}

function control(text, action) {
  const button=document.createElement('button');
  button.type='button'; button.textContent=text;
  button.addEventListener('click',action);
  return button;
}

function photoCard(asset) {
  const button=control('',()=>{
    change(()=>design.frames[activeFrame]=pose(asset.key)); markPanel();
  });
  button.className='photo-card'; button.dataset.asset=asset.key;
  button.setAttribute('aria-label',`Use ${asset.name} in selected panel`);
  const picture=new Image(); picture.src=asset.url; picture.alt=asset.name; picture.draggable=false;
  const caption=document.createElement('span'); caption.textContent=asset.name;
  button.append(picture,caption);
  if (!asset.personal) return button;
  const wrapper=document.createElement('div'); wrapper.className='personal-card';
  const remove=control('×',()=>change(()=>{
    design.personal=design.personal.filter(key=>key!==asset.key);
    design.frames=design.frames.map(frame=>frame.asset===asset.key?pose('portrait'):frame);
  }));
  remove.className='remove'; remove.setAttribute('aria-label',`Remove ${asset.name}`);
  wrapper.append(button,remove);
  return wrapper;
}

function synchronize() {
  activeFrame=bounded(activeFrame,0,design.frames.length-1);
  for (const [id,key] of [['templates','template'],['grades','grade'],['sizes','size']]) {
    node(id).querySelectorAll('button').forEach(button=>{
      const selected=button.dataset.key===design[key];
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  for (const id of ['headline','tagline','intensity']) node(id).value=design[id];
  node('grain').checked=design.grain;
  node('letters').textContent=design.headline.length+' / 36';
  node('intensity-readout').textContent=design.intensity+'%';
  node('intensity').disabled=design.grade==='clean';
  node('scale').value=currentPose().scale;
  node('scale-readout').textContent=Math.round(currentPose().scale*100)+'%';
  node('aspect').textContent=currentSize().ratio;
  node('pixels').textContent=`${currentSize().width} × ${currentSize().height} px`;
  node('template-note').textContent=findByKey(arrangements,design.template).detail;
  node('undo').disabled=!history.past.length;
  node('redo').disabled=!history.future.length;
  node('export').disabled=exporting||!design.frames.some(frame=>library.has(frame.asset));
  node('enlarge').disabled=node('export').disabled;
  node('frame-picks').replaceChildren(...design.frames.map((frame,index)=>{
    const button=control(`${String(index+1).padStart(2,'0')} ${index===0&&design.template==='hero'?'Hero':'Scene'}`,()=>{
      activeFrame=index; synchronize(); markPanel();
    });
    button.classList.toggle('selected',index===activeFrame);
    button.setAttribute('aria-label',`Select panel ${index+1}`);
    button.setAttribute('aria-pressed',String(index===activeFrame));
    return button;
  }));
  const personalSignature=design.personal.join('|');
  if (node('uploads').dataset.signature!==personalSignature) {
    node('uploads').replaceChildren(...design.personal.map(key=>photoCard(library.get(key))));
    node('uploads').dataset.signature=personalSignature;
  }
  node('personal').hidden=!design.personal.length;
  node('upload-count').textContent=design.personal.length;
  document.querySelectorAll('[data-asset]').forEach(button=>{
    const selected=button.dataset.asset===currentPose().asset;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
    button.disabled=!library.has(button.dataset.asset);
  });
  schedulePaint();
}

function installChoices() {
  arrangements.forEach(layout=>{
    const button=control('',()=>change(()=>{
      const previous=design.frames;
      design.template=layout.key;
      design.frames=layout.paths.map((_,index)=>({...previous[index%previous.length]}));
    }));
    // Parsing an inline miniature supplies the SVG namespace without an external reference.
    const fragment=document.createElement('template');
    fragment.innerHTML='<svg viewBox="0 0 48 34">'+layout.paths.map(vertices=>
      '<polygon points="'+vertices.map(([x,y])=>`${3+x*42},${3+y*28}`).join(' ')+'"/>').join('')+'</svg>';
    const mini=fragment.content.firstElementChild;
    const label=document.createElement('span'); label.textContent=layout.name;
    button.append(mini,label); button.dataset.key=layout.key; button.title=layout.detail;
    node('templates').append(button);
  });
  treatments.forEach(grade=>{
    const button=control('',()=>change(()=>design.grade=grade.key));
    const swatch=document.createElement('i'); swatch.style.background=`linear-gradient(135deg,${grade.palette.join(',')})`;
    button.append(swatch,document.createTextNode(grade.name));
    button.dataset.key=grade.key; node('grades').append(button);
  });
  dimensions.forEach(size=>{
    const button=control(size.name,()=>change(()=>design.size=size.key));
    const ratio=document.createElement('small'); ratio.textContent=size.ratio;
    button.append(ratio); button.dataset.key=size.key; node('sizes').append(button);
  });
}

async function decode(url) {
  const bitmap=new Image(); bitmap.src=url;
  await bitmap.decode();
  return bitmap;
}

async function importPhotos(files) {
  const accepted=[];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url=URL.createObjectURL(file);
    try {
      const bitmap=await decode(url), key='personal-'+(++uploadSerial);
      library.set(key,{key,name:file.name,url,bitmap,personal:true}); accepted.push(key);
    } catch { URL.revokeObjectURL(url); notify(`Could not open ${file.name}. Try a JPG, PNG or WebP.`); }
  }
  if (!accepted.length) return;
  change(()=>{
    design.personal.push(...accepted);
    if (accepted.length===1) design.frames=design.frames.map(()=>pose(accepted[0]));
    else design.frames=design.frames.map((_,index)=>pose(accepted[index%accepted.length]));
  });
  notify(`${accepted.length} photo${accepted.length===1?'':'s'} added. Drag to reframe.`);
}

function loadDemo() {
  change(()=>{
    design.headline='VICE SUMMER'; design.tagline='one last ride';
    const sequence=design.template==='duo'?['portrait','car']:['portrait','car','beach','man'];
    design.frames=findByKey(arrangements,design.template).paths.map((_,i)=>pose(sequence[i%sequence.length]));
  });
}

async function showExport() {
  if (exporting) return;
  exporting=true; synchronize();
  node('export').textContent='Rendering your cover…';
  try {
    const png=await makePNG(design,library);
    if (outputLink) URL.revokeObjectURL(outputLink);
    outputLink=URL.createObjectURL(png);
    node('output-image').src=outputLink;
    await node('output-image').decode();
    node('download').href=outputLink;
    node('download').download=`vice-frame-${design.size}.png`;
    node('output-size').textContent=`${currentSize().width} × ${currentSize().height}`;
    node('result').showModal();
  } catch (error) { notify(error.message); }
  finally {
    exporting=false;
    node('export').innerHTML='↧ &nbsp; Export cover <span>→</span>';
    synchronize();
  }
}

installChoices();
node('demo').onclick=loadDemo;
node('guide-demo').onclick=()=>{node('guide').close();loadDemo();};
node('help').onclick=()=>node('guide').showModal();
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
node('export').onclick=showExport;
node('enlarge').onclick=showExport;
node('drop').onclick=()=>node('files').click();
node('files').onchange=event=>{importPhotos(event.target.files);event.target.value='';};
node('fill-all').onclick=()=>change(()=>design.frames=design.frames.map(()=>pose(currentPose().asset)));
node('recenter').onclick=()=>change(()=>Object.assign(currentPose(),pose(currentPose().asset)));
node('undo').onclick=()=>restore(history.past,history.future);
node('redo').onclick=()=>restore(history.future,history.past);
for (const id of ['headline','tagline','intensity']) {
  node(id).addEventListener('input',()=>change(()=>design[id]=id==='intensity'?Number(node(id).value):node(id).value));
}
node('grain').onchange=()=>change(()=>design.grain=node('grain').checked);
node('scale').oninput=()=>change(()=>currentPose().scale=Number(node('scale').value));

canvas.onpointerdown=event=>{
  const rect=canvas.getBoundingClientRect();
  const x=(event.clientX-rect.left)*canvas.width/rect.width;
  const y=(event.clientY-rect.top)*canvas.height/rect.height;
  const hit=panelShapes(design.template,canvas.width,canvas.height).find(frame=>pointInPanel(frame.polygon,x,y));
  if (!hit) return;
  activeFrame=hit.slot; checkpoint();
  drag={x:event.clientX,y:event.clientY,initial:{...currentPose()},frame:hit,ratio:canvas.width/rect.width};
  canvas.setPointerCapture(event.pointerId); canvas.focus(); synchronize(); markPanel();
};
canvas.onpointermove=event=>{
  if (!drag) return;
  const asset=library.get(currentPose().asset);
  if (!asset) return;
  const bounds=photoBounds(asset.bitmap,drag.frame,drag.initial);
  currentPose().horizontal=bounded(drag.initial.horizontal-(event.clientX-drag.x)*drag.ratio/Math.max(1,bounds.overflowX),0,1);
  currentPose().vertical=bounded(drag.initial.vertical-(event.clientY-drag.y)*drag.ratio/Math.max(1,bounds.overflowY),0,1);
  schedulePaint();
};
canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;synchronize();};
canvas.onkeydown=event=>{
  const deltas={ArrowLeft:[.025,0],ArrowRight:[-.025,0],ArrowUp:[0,.025],ArrowDown:[0,-.025]};
  if (deltas[event.key]) {
    event.preventDefault();
    change(()=>{
      currentPose().horizontal=bounded(currentPose().horizontal+deltas[event.key][0],0,1);
      currentPose().vertical=bounded(currentPose().vertical+deltas[event.key][1],0,1);
    });
  } else if (['+','=','-'].includes(event.key)) {
    event.preventDefault(); change(()=>currentPose().scale=bounded(currentPose().scale+(event.key==='-'?-.1:.1),1,3));
  }
};
document.addEventListener('keydown',event=>{
  if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='z' && !event.target.matches('input')) {
    event.preventDefault();
    if (event.shiftKey) restore(history.future,history.past); else restore(history.past,history.future);
  }
});
for (const eventName of ['dragover','drop']) document.addEventListener(eventName,event=>event.preventDefault());
document.addEventListener('drop',event=>importPhotos(event.dataTransfer.files));
document.addEventListener('paste',event=>{
  if (event.clipboardData.files.length) importPhotos(event.clipboardData.files);
});
new ResizeObserver(schedulePaint).observe(node('stage'));
synchronize();
await Promise.all(stock.map(async scene=>{
  const url='samples/'+scene.file;
  try {
    library.set(scene.key,{...scene,url,bitmap:await decode(url)});
  } catch { notify(`Sample unavailable: ${scene.name}`); }
}));
// Display sample cards in catalog order even when image decoding finishes out of order.
node('samples').replaceChildren(...stock.filter(scene=>library.has(scene.key)).map(scene=>photoCard(library.get(scene.key))));
await document.fonts.ready;
synchronize();
