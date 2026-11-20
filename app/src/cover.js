import { panelShapes, treatments, findByKey, dimensions } from './templates.js';

const ivory = '#fff0d9';

function outline(brush, polygon) {
  brush.beginPath();
  polygon.forEach(([x,y], index) => index ? brush.lineTo(x,y) : brush.moveTo(x,y));
  brush.closePath();
}

export function photoBounds(image, frame, pose) {
  const factor = Math.max(frame.width/image.width, frame.height/image.height) * pose.scale;
  const width = image.width*factor, height = image.height*factor;
  return {
    left:frame.left-(width-frame.width)*pose.horizontal,
    top:frame.top-(height-frame.height)*pose.vertical,
    width, height, overflowX:width-frame.width, overflowY:height-frame.height
  };
}

function titleRows(caption) {
  const words = caption.trim().toUpperCase().split(/\s+/);
  if (caption.length < 19 || words.length < 2) return caption.trim() ? [words.join(' ')] : [];
  let cut = 1, distance = Infinity;
  for (let n=1; n<words.length; n++) {
    const difference = Math.abs(words.slice(0,n).join(' ').length - words.slice(n).join(' ').length);
    if (difference < distance) { cut=n; distance=difference; }
  }
  return [words.slice(0,cut).join(' '), words.slice(cut).join(' ')];
}

function label(brush, text, center, baseline, size, tracking, maxWidth) {
  brush.save();
  brush.font = `700 ${size}px Arial`;
  const glyphs = [...text];
  const span = glyphs.reduce((sum, letter) => sum+brush.measureText(letter).width+tracking, -tracking);
  const squeeze = Math.min(1,maxWidth/Math.max(1,span));
  brush.translate(center-span*squeeze/2, baseline);
  brush.scale(squeeze,1);
  brush.fillStyle = ivory;
  let cursor = 0;
  glyphs.forEach(letter => { brush.fillText(letter,cursor,0); cursor+=brush.measureText(letter).width+tracking; });
  brush.restore();
}

function lettering(brush, design, width, height) {
  const unit = Math.min(width,height), rows = titleRows(design.headline);
  let size = Math.min(unit*(rows.length>1?.22:.265),height*.25);
  brush.save();
  brush.font = `700 ${size}px PosterFace`;
  const widest = Math.max(1,...rows.map(row => brush.measureText(row).width*.66));
  size *= Math.min(1,width*.87/widest);
  let baseline = unit*.07+size*.75;
  rows.forEach((row,index) => {
    baseline = unit*.07+size*.75+index*size*.84;
    brush.save();
    brush.font = `700 ${size}px PosterFace`;
    brush.translate(width/2-brush.measureText(row).width*.33,baseline);
    brush.transform(.66,0,-.12,1,0,0);
    brush.lineJoin = 'round';
    brush.lineWidth = size*.09;
    brush.strokeStyle = '#251929';
    brush.shadowColor = '#100819dd';
    brush.shadowBlur = unit*.012;
    brush.shadowOffsetY = unit*.008;
    brush.strokeText(row,0,0);
    brush.shadowColor = 'transparent';
    const fill = brush.createLinearGradient(0,-size*.8,0,0);
    fill.addColorStop(0,'#fff9eb');
    fill.addColorStop(.55,'#fff0d9');
    fill.addColorStop(1,design.grade==='neon'?'#efbedf':'#ffb493');
    brush.fillStyle = fill;
    brush.fillText(row,0,0);
    brush.restore();
  });
  if (rows.length) label(brush,'A VICE FRAME ORIGINAL',width/2,unit*.043,unit*.011,unit*.003,width*.8);
  if (design.tagline.trim()) {
    brush.shadowColor = '#100819'; brush.shadowBlur = unit*.008;
    label(brush,design.tagline.toUpperCase(),width/2,rows.length?baseline+size*.2:unit*.12,unit*.017,unit*.004,width*.82);
  }
  brush.restore();
}

let grainPattern;
function paperGrain() {
  if (grainPattern) return grainPattern;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 128;
  const pen = tile.getContext('2d'), raster = pen.createImageData(128,128);
  let seed = 27183;
  for (let i=0;i<raster.data.length;i+=4) {
    seed = seed*48271%2147483647;
    const value = 60+seed%140;
    raster.data.set([value,value,value,255],i);
  }
  pen.putImageData(raster,0,0);
  grainPattern = tile;
  return tile;
}

export function paintCover(surface, design, library, width, height, selection=-1) {
  surface.width = Math.round(width); surface.height = Math.round(height);
  const pen = surface.getContext('2d',{ alpha:false });
  const w=surface.width, h=surface.height, unit=Math.min(w,h);
  const frames = panelShapes(design.template,w,h);
  const treatment = findByKey(treatments,design.grade), power=design.intensity/100;
  pen.fillStyle=ivory; pen.fillRect(0,0,w,h);
  frames.forEach(frame => {
    pen.save(); outline(pen,frame.polygon); pen.clip();
    const pose = design.frames[frame.slot], asset=library.get(pose.asset);
    if (asset) {
      const crop=photoBounds(asset.bitmap,frame,pose);
      pen.filter=`contrast(${1+(treatment.contrast-1)*power}) saturate(${1+(treatment.saturation-1)*power}) grayscale(${design.grade==='neon'?.4*power:0})`;
      pen.imageSmoothingQuality='high';
      pen.drawImage(asset.bitmap,crop.left,crop.top,crop.width,crop.height);
    } else {
      const placeholder=pen.createLinearGradient(0,0,w,h);
      placeholder.addColorStop(0,'#393147'); placeholder.addColorStop(1,'#ce8a80');
      pen.fillStyle=placeholder; pen.fillRect(0,0,w,h);
    }
    pen.restore();
  });
  pen.save();
  const margin=unit*.014;
  pen.beginPath(); pen.rect(margin,margin,w-margin*2,h-margin*2); pen.clip();
  const tint=pen.createLinearGradient(0,0,w*.18,h);
  treatment.palette.forEach((color,n)=>tint.addColorStop(n/(treatment.palette.length-1),color));
  pen.globalCompositeOperation=treatment.blend;
  pen.globalAlpha=treatment.alpha*power;
  pen.fillStyle=tint; pen.fillRect(0,0,w,h);
  pen.globalCompositeOperation='screen'; pen.globalAlpha=.15*power;
  const glow=pen.createRadialGradient(w*.1,h*.08,0,w*.1,h*.08,w*.85);
  glow.addColorStop(0,treatment.palette[0]); glow.addColorStop(1,'#00000000');
  pen.fillStyle=glow; pen.fillRect(0,0,w,h);
  if (design.grain) {
    pen.globalCompositeOperation='soft-light'; pen.globalAlpha=.12;
    pen.fillStyle=pen.createPattern(paperGrain(),'repeat'); pen.fillRect(0,0,w,h);
  }
  pen.globalCompositeOperation='source-over'; pen.globalAlpha=1;
  const vignette=pen.createLinearGradient(0,0,0,h);
  vignette.addColorStop(0,'#170d24aa'); vignette.addColorStop(.4,'#170d2400');
  vignette.addColorStop(.76,'#170d2400'); vignette.addColorStop(1,'#170d24a0');
  pen.fillStyle=vignette; pen.fillRect(0,0,w,h);
  pen.restore();
  pen.strokeStyle=ivory; pen.lineWidth=unit*.007; pen.lineJoin='round';
  frames.forEach(frame => { outline(pen,frame.polygon); pen.stroke(); });
  lettering(pen,design,w,h);
  pen.fillStyle=ivory; pen.font=`700 ${unit*.013}px Arial`;
  pen.fillText('VICE FRAME',unit*.044,h-unit*.044);
  pen.textAlign='right'; pen.font=`700 ${unit*.01}px Arial`;
  pen.fillText('MADE FOR THE MOMENT',w-unit*.044,h-unit*.044);
  pen.fillStyle='#f4ad99'; pen.fillRect(unit*.044,h-unit*.035,unit*.07,unit*.003);
  if (selection>=0 && frames[selection]) {
    pen.strokeStyle='#ffbc9a'; pen.setLineDash([unit*.015,unit*.01]);
    outline(pen,frames[selection].polygon); pen.stroke();
  }
  return surface;
}

export async function makePNG(design, library) {
  await document.fonts.ready;
  const size=findByKey(dimensions,design.size);
  const surface=paintCover(document.createElement('canvas'),design,library,size.width,size.height);
  return new Promise((accept,fail)=>surface.toBlob(blob=>blob?accept(blob):fail(new Error('Could not encode your cover.')),'image/png'));
}
