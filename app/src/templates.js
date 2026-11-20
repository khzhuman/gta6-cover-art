// Shared coordinates keep the preview, export and crop selection in agreement.
export const arrangements = [
  { key: 'hero', name: 'Hero Split', detail: 'A leading role. Two side stories.', paths: [
    [[0,0],[.6,0],[.54,1],[0,1]],
    [[.6,0],[1,0],[1,.48],[.57,.51]],
    [[.57,.51],[1,.48],[1,1],[.54,1]]
  ] },
  { key: 'trio', name: 'Trio', detail: 'Three perspectives on the same night.', paths: [
    [[0,0],[.34,0],[.34,1],[0,1]],
    [[.34,0],[.67,0],[.67,1],[.34,1]],
    [[.67,0],[1,0],[1,1],[.67,1]]
  ] },
  { key: 'quad', name: 'Quad', detail: 'Four frames. Unlimited possibilities.', paths: [
    [[0,0],[.5,0],[.5,.5],[0,.5]], [[.5,0],[1,0],[1,.5],[.5,.5]],
    [[0,.5],[.5,.5],[.5,1],[0,1]], [[.5,.5],[1,.5],[1,1],[.5,1]]
  ] },
  { key: 'duo', name: 'Wide Duo', detail: 'A cinematic double feature.', paths: [
    [[0,0],[1,0],[1,.55],[0,.46]],
    [[0,.46],[1,.55],[1,1],[0,1]]
  ] }
];

export const treatments = [
  { key:'sunset', name:'Vice Sunset', palette:['#ffb878','#ef829c','#904aac'], blend:'soft-light', alpha:.53, contrast:1.14, saturation:1.18 },
  { key:'neon', name:'Neon Nights', palette:['#46e6db','#7b70c7','#f044a5'], blend:'color', alpha:.62, contrast:1.22, saturation:.82 },
  { key:'golden', name:'Golden Hour', palette:['#ffe0a1','#edb176','#c68b7f'], blend:'soft-light', alpha:.38, contrast:1.08, saturation:1.08 },
  { key:'clean', name:'Clean', palette:['#e6dbce','#a2b9be'], blend:'soft-light', alpha:0, contrast:1, saturation:1 }
];

export const dimensions = [
  { key:'square', name:'Square', width:1080, height:1080, ratio:'1:1' },
  { key:'portrait', name:'Portrait', width:1080, height:1350, ratio:'4:5' },
  { key:'wide', name:'Wide', width:1920, height:1080, ratio:'16:9' }
];

export const stock = [
  { key:'portrait', name:'The heroine', file:'sample-portrait.jpg' },
  { key:'car', name:'The getaway', file:'sample-car.jpg' },
  { key:'beach', name:'The coastline', file:'sample-beach.jpg' },
  { key:'man', name:'The leading man', file:'sample-man.jpg' },
  { key:'boulevard', name:'Ocean Drive', file:'boulevard.jpg' },
  { key:'pier', name:'The pier', file:'pier.jpg' }
];

export const bounded = (value, low, high) => Math.min(high, Math.max(low, value));
export const findByKey = (list, key) => list.find(entry => entry.key === key);

export function panelShapes(key, width, height) {
  const border = Math.min(width, height) * .014;
  return findByKey(arrangements, key).paths.map((points, slot) => {
    const polygon = points.map(([u,v]) => [border + u*(width-border*2), border + v*(height-border*2)]);
    const xs = polygon.map(point => point[0]);
    const ys = polygon.map(point => point[1]);
    return { slot, polygon, left:Math.min(...xs), top:Math.min(...ys), width:Math.max(...xs)-Math.min(...xs), height:Math.max(...ys)-Math.min(...ys) };
  });
}

export function pointInPanel(polygon, x, y) {
  let crossings = 0;
  polygon.forEach(([ax,ay], index) => {
    const [bx,by] = polygon[(index+1)%polygon.length];
    if ((ay > y) !== (by > y) && x < ax + (y-ay)*(bx-ax)/(by-ay)) crossings++;
  });
  return crossings % 2 === 1;
}
