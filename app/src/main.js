// The editor owns state; the painter receives snapshots and never changes them.
document.addEventListener('DOMContentLoaded', async () => {
  const catalog=window.FrameCatalog, painter=window.FramePainter;
  const el=id=>document.getElementById(id);
  const photos=new Map(), back=[], forward=[];
  const fresh=photo=>({photo,x:.5,y:.5,zoom:1});
  let model={layout:'hero',mood:'sunset',format:'square',caption:'VICE SUMMER',subtitle:'one last ride',strength:72,texture:true,panels:[],uploads:[]};
  let chosen=0, moving=null, pending=false, highlight=false, highlightTimer, messageTimer;
  let exportURL=null, busy=false, serial=0;
  const canvas=el('canvas');
  const serialize=()=>JSON.stringify(model);
  const selected=()=>model.panels[chosen];
  const layout=()=>catalog.layouts.find(item=>item.id===model.layout);
  const format=()=>catalog.formats.find(item=>item.id===model.format);

  function tell(text) {
    clearTimeout(messageTimer);
    el('message').textContent=text;
    el('message').hidden=false;
    messageTimer=setTimeout(()=>el('message').hidden=true,4200);
  }

  function remember(value=serialize()) {
    if(back.at(-1)!==value) back.push(value);
    if(back.length>50) back.shift();
    forward.length=0;
  }

  function edit(operation) {
    remember(); operation(); refresh();
  }

  function travel(from,to) {
    if(!from.length || moving) return;
    to.push(serialize()); model=JSON.parse(from.pop());
    chosen=Math.min(chosen,model.panels.length-1); refresh();
  }

  function draw() {
    if(pending) return;
    pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      const area=el('stage'), target=format();
      const width=Math.max(80,Math.min(area.clientWidth-54,(area.clientHeight-70)*target.w/target.h));
      const height=width*target.h/target.w;
      el('paper').style.width=`${width}px`; el('paper').style.height=`${height}px`;
      const density=Math.min(devicePixelRatio||1,2);
      painter.render(canvas,model,photos,width*density,height*density,highlight?chosen:-1);
    });
  }

  function flashSelection() {
    highlight=true; clearTimeout(highlightTimer); draw();
    highlightTimer=setTimeout(()=>{highlight=false;draw();},1300);
  }

  function button(text,action) {
    const node=document.createElement('button'); node.type='button';
    node.textContent=text; node.addEventListener('click',action); return node;
  }

  function thumbnail(photo) {
    const node=button('',()=>{edit(()=>model.panels[chosen]=fresh(photo.id));flashSelection();});
    node.className='photo'; node.dataset.photo=photo.id;
    node.title=`Use ${photo.label} in selected panel`;
    node.setAttribute('aria-label',node.title);
    const image=new Image(); image.src=photo.src; image.alt=photo.label; image.draggable=false;
    const name=document.createElement('span'); name.textContent=photo.label;
    node.append(image,name);
    if(!photo.id.startsWith('upload-')) return node;
    const card=document.createElement('div');card.className='upload-card';
    const remove=button('×',()=>edit(()=>{
      model.uploads=model.uploads.filter(id=>id!==photo.id);
      const replacement=model.uploads[0]||'portrait';
      model.panels=model.panels.map(panel=>panel.photo===photo.id?fresh(replacement):panel);
    }));
    remove.className='remove-photo';remove.setAttribute('aria-label',`Remove ${photo.label}`);
    card.append(node,remove);return card;
  }

  function refresh() {
    chosen=catalog.limit(chosen,0,Math.max(0,model.panels.length-1));
    for(const [container,key] of [['layouts','layout'],['moods','mood'],['formats','format']]) {
      el(container).querySelectorAll('button').forEach(node=>{
        const active=node.dataset.value===model[key];
        node.classList.toggle('active',active); node.setAttribute('aria-pressed',String(active));
      });
    }
    for(const key of ['caption','subtitle','strength']) el(key).value=model[key];
    el('texture').checked=model.texture;
    el('caption-count').textContent=`${model.caption.length} / 36`;
    el('strength-label').textContent=`${model.strength}%`;
    el('strength').disabled=model.mood==='clean';
    el('zoom').value=selected()?.zoom||1;
    el('zoom-label').textContent=`${Math.round((selected()?.zoom||1)*100)}%`;
    el('ratio').textContent=format().ratio;
    el('dimensions').textContent=`${format().w} × ${format().h} px`;
    el('layout-note').textContent=layout().note;
    el('undo').disabled=!back.length; el('redo').disabled=!forward.length;
    el('export').disabled=busy||!model.panels.some(panel=>photos.has(panel.photo));
    el('expand').disabled=el('export').disabled;
    el('repeat').disabled=!photos.has(selected()?.photo);
    el('zoom').disabled=el('reset').disabled=el('repeat').disabled;
    el('panels').replaceChildren(...model.panels.map((_,index)=>{
      const node=button(`${String(index+1).padStart(2,'0')}  ${index===0&&model.layout==='hero'?'Hero':'Scene'}`,()=>{chosen=index;refresh();flashSelection();});
      node.classList.toggle('active',index===chosen);
      node.setAttribute('aria-label',`Select panel ${index+1}`);
      node.setAttribute('aria-pressed',String(index===chosen)); return node;
    }));
    if(el('uploads').dataset.ids!==model.uploads.join(',')) {
      el('uploads').replaceChildren(...model.uploads.map(id=>thumbnail(photos.get(id))));
      el('uploads').dataset.ids=model.uploads.join(',');
    }
    el('personal').hidden=!model.uploads.length;
    el('count').textContent=model.uploads.length;
    document.querySelectorAll('[data-photo]').forEach(node=>{
      node.classList.toggle('active',node.dataset.photo===selected()?.photo);
      node.setAttribute('aria-pressed',String(node.dataset.photo===selected()?.photo));
      node.disabled=!photos.has(node.dataset.photo);
    });
    draw();
  }

  function buildChoices() {
    catalog.layouts.forEach(item=>{
      const node=button('',()=>edit(()=>{
        const old=model.panels;
        model.layout=item.id;
        model.panels=item.shapes.map((_,i)=>({...old[i%old.length]}));
      }));
      // The miniatures use the actual layout polygons rather than a separate icon set.
      node.innerHTML='<svg viewBox="0 0 44 32">'+item.shapes.map(shape=>
        '<path d="'+shape.map(([x,y],i)=>`${i?'L':'M'}${2+x*40} ${2+y*28}`).join(' ')+'Z"/>').join('')+'</svg>';
      const svg=node.firstElementChild;
      const label=document.createElement('span'); label.textContent=item.label;
      node.append(svg,label); node.dataset.value=item.id; node.title=item.note; el('layouts').append(node);
    });
    catalog.moods.forEach(item=>{
      const node=button('',()=>edit(()=>model.mood=item.id));
      const swatch=document.createElement('span'); swatch.className='swatch';
      swatch.style.background=`linear-gradient(135deg,${item.colors[0]},${item.colors.at(-1)})`;
      node.append(swatch,document.createTextNode(item.label)); node.dataset.value=item.id; el('moods').append(node);
    });
    catalog.formats.forEach(item=>{
      const node=button(item.label,()=>edit(()=>model.format=item.id));
      const ratio=document.createElement('small'); ratio.textContent=item.ratio;
      node.append(ratio); node.dataset.value=item.id; node.title=`${item.w} × ${item.h} pixels`; el('formats').append(node);
    });
  }

  function openPhoto(src) {
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error('Could not open that image. Try a JPG, PNG or WEBP.'));
      image.src=src;
    });
  }

  async function importPhotos(files) {
    const added=[];
    for(const file of files) {
      if(!file.type.startsWith('image/')) {tell('Choose an image file.');continue;}
      const src=URL.createObjectURL(file);
      try {
        const image=await openPhoto(src), id=`upload-${++serial}`;
        photos.set(id,{id,label:file.name,src,image}); added.push(id);
      } catch(error) {URL.revokeObjectURL(src);tell(error.message);}
    }
    if(added.length) {
      edit(()=>{
        model.uploads.push(...added);
        model.panels=layout().shapes.map((_,i)=>fresh(added[i%added.length])); chosen=0;
      });
      tell(`${added.length} photo${added.length===1?'':'s'} ready. Drag each panel to find your angle.`);
    }
  }

  function demo(record=true) {
    if(record) remember();
    model={...model,layout:'hero',mood:'sunset',format:'square',caption:'VICE SUMMER',subtitle:'one last ride',strength:72,texture:true,
      panels:['portrait','car','beach'].map(fresh)};
    chosen=0; refresh();
  }

  async function showResult(download) {
    if(busy) return;
    busy=true; refresh();
    try {
      const snapshot=structuredClone(model), blob=await painter.exportPNG(snapshot,photos);
      if(exportURL) URL.revokeObjectURL(exportURL);
      exportURL=URL.createObjectURL(blob);
      const dimensions=catalog.formats.find(item=>item.id===snapshot.format);
      const slug=snapshot.caption.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'cover';
      const name=`vice-frame-${slug}-${dimensions.w}x${dimensions.h}.png`;
      el('finished-image').src=exportURL;
      el('finished-image').alt=`${snapshot.caption} — ${catalog.moods.find(item=>item.id===snapshot.mood).label} cover`;
      await el('finished-image').decode();
      el('save').href=exportURL; el('save').download=name;
      el('export-dimensions').textContent=`${dimensions.w} × ${dimensions.h}`;
      if(download) {const link=document.createElement('a');link.href=exportURL;link.download=name;link.click();}
      el('result').showModal();
    } catch(error) {tell(error.message);}
    finally {busy=false;refresh();}
  }

  function canvasPoint(event) {
    const box=canvas.getBoundingClientRect();
    return {x:(event.clientX-box.left)*canvas.width/box.width,y:(event.clientY-box.top)*canvas.height/box.height};
  }
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0 || moving) return;
    const point=canvasPoint(event);
    const box=catalog.geometry(model.layout,canvas.width,canvas.height).find(item=>catalog.contains(item.vertices,point.x,point.y));
    if(!box) return;
    chosen=box.index;refresh();flashSelection();canvas.focus({preventScroll:true});
    const photo=photos.get(selected().photo); if(!photo) return;
    moving={pointer:event.pointerId,point,before:serialize(),placement:{...selected()},crop:painter.crop(photo.image,box,selected())};
    canvas.setPointerCapture(event.pointerId);event.preventDefault();
  });
  canvas.addEventListener('pointermove',event=>{
    if(!moving || event.pointerId!==moving.pointer) return;
    const point=canvasPoint(event), {crop,placement}=moving;
    if(crop.extraX>.1) selected().x=catalog.limit(placement.x-(point.x-moving.point.x)/crop.extraX,0,1);
    if(crop.extraY>.1) selected().y=catalog.limit(placement.y-(point.y-moving.point.y)/crop.extraY,0,1);
    flashSelection();draw();
  });
  function endDrag(event) {
    if(!moving || moving.pointer!==event.pointerId) return;
    if(moving.before!==serialize()) remember(moving.before);
    moving=null; refresh();flashSelection();
  }
  for(const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name,endDrag);

  for(const id of ['caption','subtitle','strength','zoom']) {
    let saved=false;
    el(id).addEventListener('input',()=>{
      if(!saved) {remember();saved=true;}
      if(id==='zoom') selected().zoom=Number(el(id).value);
      else model[id]=id==='strength'?Number(el(id).value):el(id).value;
      refresh();
    });
    for(const name of ['change','blur']) el(id).addEventListener(name,()=>saved=false);
  }
  el('texture').onchange=()=>edit(()=>model.texture=el('texture').checked);
  el('reset').onclick=()=>edit(()=>model.panels[chosen]=fresh(selected().photo));
  el('repeat').onclick=()=>edit(()=>model.panels=model.panels.map(()=>fresh(selected().photo)));
  el('undo').onclick=()=>travel(back,forward); el('redo').onclick=()=>travel(forward,back);
  el('browse').onclick=()=>el('files').click();
  el('files').onchange=event=>{importPhotos(event.target.files);event.target.value='';};
  document.addEventListener('dragover',event=>{if([...event.dataTransfer.types].includes('Files'))event.preventDefault();});
  document.addEventListener('drop',event=>{if(event.dataTransfer.files.length){event.preventDefault();importPhotos(event.dataTransfer.files);}});
  document.addEventListener('paste',event=>{if(event.clipboardData.files.length){event.preventDefault();importPhotos(event.clipboardData.files);}});
  document.addEventListener('keydown',event=>{
    if(event.target.matches('input,textarea,[contenteditable]')) return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z') {
      event.preventDefault();event.shiftKey?travel(forward,back):travel(back,forward);return;
    }
    if(event.target!==canvas || !selected()) return;
      const directions={ArrowLeft:[1,0],ArrowRight:[-1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};
    if(directions[event.key]) {
      event.preventDefault();const [x,y]=directions[event.key], step=event.shiftKey?.08:.02;
      edit(()=>{selected().x=catalog.limit(selected().x+x*step,0,1);selected().y=catalog.limit(selected().y+y*step,0,1);});flashSelection();
    } else if(['+','=','-'].includes(event.key)) {
      event.preventDefault();edit(()=>selected().zoom=catalog.limit(selected().zoom+(event.key==='-'?-.1:.1),1,3));
    } else if(/^[1-4]$/.test(event.key)) {chosen=Math.min(Number(event.key)-1,model.panels.length-1);refresh();flashSelection();}
  });
  el('demo').onclick=()=>demo();
  el('export').onclick=()=>showResult(true); el('expand').onclick=()=>showResult(false);
  el('help').onclick=()=>el('instructions').showModal();
  el('help-demo').onclick=()=>{el('instructions').close();demo();};
  document.querySelectorAll('[data-dismiss]').forEach(node=>node.onclick=()=>node.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{
    const box=dialog.getBoundingClientRect();
    if(event.target===dialog && (event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)) dialog.close();
  }));
  buildChoices();
  catalog.scenes.forEach(scene=>el('samples').append(thumbnail(scene)));
  model.panels=layout().shapes.map(()=>fresh(null));refresh();
  new ResizeObserver(draw).observe(el('stage'));
  const results=await Promise.allSettled(catalog.scenes.map(async scene=>{
    const image=await openPhoto(scene.src);photos.set(scene.id,{...scene,image});
  }));
  if(results.some(item=>item.status==='rejected')) tell('Some samples could not load. Serve app/ locally or import your own photos.');
  await document.fonts.load('700 32px FrameHeadline');
  demo(false);
  window.addEventListener('beforeunload',()=>{
    for(const photo of photos.values()) if(photo.src.startsWith('blob:')) URL.revokeObjectURL(photo.src);
    if(exportURL) URL.revokeObjectURL(exportURL);
  });
});
