window.FramePainter = (() => {
  const C = window.FrameCatalog;
  const cream = '#fff0d6';
  let textureTile;

  function trace(ctx, vertices) {
    ctx.beginPath();
    for (let i=0;i<vertices.length;i++) {
      const [x,y]=vertices[i];
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
  }

  function crop(image, box, placement) {
    const scale=Math.max(box.w/image.naturalWidth,box.h/image.naturalHeight)*placement.zoom;
    const w=image.naturalWidth*scale, h=image.naturalHeight*scale;
    const extraX=w-box.w, extraY=h-box.h;
    return {x:box.x-extraX*placement.x,y:box.y-extraY*placement.y,w,h,extraX,extraY};
  }

  function grain() {
    if(textureTile) return textureTile;
    textureTile=document.createElement('canvas');
    textureTile.width=textureTile.height=160;
    const brush=textureTile.getContext('2d');
    const pixels=brush.createImageData(160,160);
    let random=15931;
    for(let offset=0;offset<pixels.data.length;offset+=4) {
      random=random*16807%2147483647;
      pixels.data.fill(64+random%128,offset,offset+3);
      pixels.data[offset+3]=255;
    }
    brush.putImageData(pixels,0,0);
    return textureTile;
  }

  function wash(ctx,mood,amount,w,h) {
    if(!mood.opacity || !amount) return;
    ctx.save();
    const tint=ctx.createLinearGradient(0,0,w*.22,h);
    mood.colors.forEach((color,i)=>tint.addColorStop(i/(mood.colors.length-1),color));
    ctx.fillStyle=tint;
    ctx.globalCompositeOperation=mood.mode;
    ctx.globalAlpha=mood.opacity*amount;
    ctx.fillRect(0,0,w,h);
    const light=ctx.createRadialGradient(w*.13,h*.12,0,w*.13,h*.12,w*.8);
    light.addColorStop(0,mood.colors[0]);
    light.addColorStop(1,'#00000000');
    ctx.globalCompositeOperation='screen';
    ctx.globalAlpha=amount*(mood.id==='golden'?.23:.16);
    ctx.fillStyle=light;
    ctx.fillRect(0,0,w,h);
    const edge=ctx.createRadialGradient(w*.5,h*.45,Math.min(w,h)*.18,w*.5,h*.48,Math.max(w,h)*.72);
    edge.addColorStop(0,'#160f2300');
    edge.addColorStop(.58,'#160f2314');
    edge.addColorStop(1,'#170e25');
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=amount*(mood.id==='neon'?.45:.3);
    ctx.fillStyle=edge;
    ctx.fillRect(0,0,w,h);
    ctx.restore();
  }

  function balanceTitle(text) {
    const title=text.trim().replace(/\s+/g,' ').toUpperCase();
    if(!title) return [];
    if(title.length<=18 || !title.includes(' ')) return [title];
    const words=title.split(' ');
    let split=1, best=Infinity;
    for(let index=1;index<words.length;index++) {
      const gap=Math.abs(words.slice(0,index).join(' ').length-words.slice(index).join(' ').length);
      if(gap<best) { best=gap; split=index; }
    }
    return [words.slice(0,split).join(' '),words.slice(split).join(' ')];
  }

  function measureLetters(ctx,text,spacing) {
    let width=0;
    const letters=[...text].map(char=>{
      const item={char,x:width};
      width+=ctx.measureText(char).width+spacing;
      return item;
    });
    return {letters,width:Math.max(0,width-spacing)};
  }

  function smallType(ctx,text,x,y,size,spacing,maxWidth) {
    ctx.save();
    ctx.font=`700 ${size}px Arial`;
    const line=measureLetters(ctx,text,spacing);
    const scale=Math.min(1,maxWidth/Math.max(1,line.width));
    ctx.translate(x-line.width*scale/2,y);
    ctx.scale(scale,1);
    ctx.fillStyle=cream;
    for(const {char,x:offset} of line.letters) ctx.fillText(char,offset,0);
    ctx.restore();
  }

  function headline(ctx,model,w,h) {
    const lines=balanceTitle(model.caption), unit=Math.min(w,h);
    const compress=.64;
    let size=Math.min(unit*(lines.length>1?.215:.26),h*.24);
    ctx.save();
    ctx.font=`700 ${size}px FrameHeadline`;
    const maximum=Math.max(1,...lines.map(line=>measureLetters(ctx,line,-size*.024).width*compress));
    size*=Math.min(1,(w*.88-size*.12)/maximum);
    const first=unit*.069+size*.73;
    let baseline=first;
    lines.forEach((text,index)=>{
      baseline=first+index*size*.82;
      ctx.save();
      ctx.font=`700 ${size}px FrameHeadline`;
      const line=measureLetters(ctx,text,-size*.024);
      ctx.translate(w/2-line.width*compress/2-size*.035,baseline);
      ctx.transform(compress,0,-.13,1,0,0);
      ctx.lineJoin='round';
      ctx.strokeStyle='#221925';
      ctx.lineWidth=size*.082;
      ctx.shadowColor='#100716cc';
      ctx.shadowBlur=unit*.015;
      ctx.shadowOffsetX=unit*.003;
      ctx.shadowOffsetY=unit*.009;
      for(const letter of line.letters) ctx.strokeText(letter.char,letter.x,0);
      ctx.shadowColor='transparent';
      ctx.shadowBlur=ctx.shadowOffsetX=ctx.shadowOffsetY=0;
      const fill=ctx.createLinearGradient(0,-size*.8,0,size*.04);
      fill.addColorStop(0,'#fff7e8');
      fill.addColorStop(.5,'#ffefd6');
      fill.addColorStop(1,model.mood==='neon'?'#ecc0da':'#ffba96');
      ctx.fillStyle=fill;
      for(const letter of line.letters) ctx.fillText(letter.char,letter.x,0);
      ctx.restore();
    });
    if(lines.length) smallType(ctx,'A VICE FRAME ORIGINAL',w/2,unit*.042,unit*.0115,unit*.0029,w*.75);
    if(model.subtitle.trim()) {
      ctx.shadowColor='#120b1cf2';
      ctx.shadowBlur=unit*.006;
      smallType(ctx,model.subtitle.trim().toUpperCase(),w/2,lines.length?baseline+size*.19:unit*.12,unit*.017,unit*.0042,w*.8);
    }
    ctx.restore();
  }

  function render(canvas,model,photos,w,h,selected=-1) {
    canvas.width=Math.round(w); canvas.height=Math.round(h);
    const ctx=canvas.getContext('2d',{alpha:false});
    w=canvas.width; h=canvas.height;
    const unit=Math.min(w,h), margin=unit*.014;
    const panels=C.geometry(model.layout,w,h);
    const mood=C.moods.find(item=>item.id===model.mood);
    const amount=model.strength/100;
    ctx.fillStyle=cream;
    ctx.fillRect(0,0,w,h);
    for(const panel of panels) {
      ctx.save();
      trace(ctx,panel.vertices); ctx.clip();
      const placement=model.panels[panel.index], photo=photos.get(placement.photo);
      if(photo) {
        const position=crop(photo.image,panel,placement);
        ctx.filter=`contrast(${1+(mood.contrast-1)*amount}) saturate(${1+(mood.saturation-1)*amount}) grayscale(${mood.gray*amount})`;
        ctx.imageSmoothingQuality='high';
        ctx.drawImage(photo.image,position.x,position.y,position.w,position.h);
      } else {
        const empty=ctx.createLinearGradient(panel.x,panel.y,panel.x+panel.w,panel.y+panel.h);
        empty.addColorStop(0,'#34324d'); empty.addColorStop(1,'#e39672');
        ctx.fillStyle=empty; ctx.fillRect(panel.x,panel.y,panel.w,panel.h);
      }
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(margin,margin,w-2*margin,h-2*margin); ctx.clip();
    wash(ctx,mood,amount,w,h);
    if(model.texture) {
      ctx.save(); ctx.globalAlpha=.11; ctx.globalCompositeOperation='soft-light';
      ctx.fillStyle=ctx.createPattern(grain(),'repeat'); ctx.fillRect(0,0,w,h); ctx.restore();
    }
    const shade=ctx.createLinearGradient(0,0,0,h*.45);
    shade.addColorStop(0,'#190e1fa6'); shade.addColorStop(.48,'#190e1f3d'); shade.addColorStop(1,'#190e1f00');
    ctx.fillStyle=shade; ctx.fillRect(0,0,w,h*.45);
    const bottom=ctx.createLinearGradient(0,h*.78,0,h);
    bottom.addColorStop(0,'#160c1c00'); bottom.addColorStop(1,'#160c1cb3');
    ctx.fillStyle=bottom; ctx.fillRect(0,h*.78,w,h*.22);
    ctx.restore();
    ctx.strokeStyle=cream; ctx.lineWidth=unit*.0065; ctx.lineJoin='round';
    for(const panel of panels) { trace(ctx,panel.vertices); ctx.stroke(); }
    headline(ctx,model,w,h);
    ctx.fillStyle=cream; ctx.font=`700 ${unit*.013}px Arial`;
    ctx.fillText('VICE FRAME',unit*.043,h-unit*.043);
    ctx.textAlign='right'; ctx.font=`700 ${unit*.0105}px Arial`;
    ctx.fillText('MADE FOR THE MOMENT',w-unit*.043,h-unit*.043);
    ctx.fillStyle='#f9ac91'; ctx.fillRect(unit*.043,h-unit*.035,unit*.067,unit*.003);
    if(selected>=0 && panels[selected]) {
      ctx.strokeStyle='#ffc1a5'; ctx.lineWidth=unit*.005;
      ctx.setLineDash([unit*.016,unit*.012]);
      trace(ctx,panels[selected].vertices); ctx.stroke();
    }
    return canvas;
  }

  async function exportPNG(model,photos) {
    await document.fonts.ready;
    const format=C.formats.find(item=>item.id===model.format);
    const canvas=render(document.createElement('canvas'),model,photos,format.w,format.h);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG creation failed. Please try again.')),'image/png'));
  }
  return {render,crop,exportPNG};
})();
