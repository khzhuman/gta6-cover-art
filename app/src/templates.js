const driver = ['THE DRIVER', 'CORAL CAUSEWAY · 7:15 PM'];
const boss = ['THE BOSS', 'OWNS THE SKYLINE'];
const getaway = ['THE GETAWAY', 'ONE TANK · NO BRAKES'];
const siren = ['THE SIREN', 'WATCHES THE WATER'];
const racer = ['THE RACER', 'MIDNIGHT GP CHAMPION'];
const fixer = ['THE FIXER', 'FIXES EVERYTHING'];
const coast = ['THE COASTLINE', 'WHERE IT ALL BEGAN'];

const rectangle = (x0, y0, x1, y1) => [[x0,y0], [x1,y0], [x1,y1], [x0,y1]];
const layout = (key, name, detail, paths, cast) => ({
  key, name, detail, paths, labels: cast.map(([role, sub]) => ({ role, sub }))
});

export const arrangements = [
  layout('ensemble', 'Ensemble', 'The whole cast. One cover.', [
    [[0,0],[.47,0],[.43,1],[0,1]],
    [[.47,0],[.735,0],[.728,.34],[.456,.34]],
    [[.735,0],[1,0],[1,.34],[.728,.34]],
    [[.456,.34],[.728,.34],[.722,.67],[.443,.67]],
    [[.728,.34],[1,.34],[1,.67],[.722,.67]],
    [[.443,.67],[.722,.67],[.715,1],[.43,1]],
    [[.722,.67],[1,.67],[1,1],[.715,1]]
  ], [driver, boss, getaway, siren, racer, fixer, coast]),
  layout('hero', 'Hero Split', 'A leading role. Two side stories.', [
    [[0,0],[.6,0],[.54,1],[0,1]],
    [[.6,0],[1,0],[1,.48],[.57,.51]],
    [[.57,.51],[1,.48],[1,1],[.54,1]]
  ], [driver, getaway, coast]),
  layout('trio', 'Trio', 'Three perspectives on the same night.',
    [rectangle(0,0,.34,1), rectangle(.34,0,.67,1), rectangle(.67,0,1,1)],
    [driver, boss, racer]),
  layout('quad', 'Quad', 'Four frames. Unlimited possibilities.',
    [rectangle(0,0,.5,.5), rectangle(.5,0,1,.5), rectangle(0,.5,.5,1), rectangle(.5,.5,1,1)],
    [driver, boss, siren, fixer]),
  layout('duo', 'Wide Duo', 'A cinematic double feature.', [
    [[0,0],[1,0],[1,.55],[0,.46]],
    [[0,.46],[1,.55],[1,1],[0,1]]
  ], [driver, coast])
];

const lateLight = ['#ffd76a', '#ff8f4d', '#e5488c', '#5f2d91'];
export const treatments = [
  ['sunset', 'Vice Sunset', ['#ffb878', '#ef829c', '#904aac'], .53, 1.14, 1.18],
  ['neon', 'Neon Nights', ['#46e6db', '#7b70c7', '#f044a5'], .62, 1.22, .82],
  ['golden', 'Soft Gold', ['#ffe0a1', '#edb176', '#c68b7f'], .38, 1.08, 1.08],
  ['clean', 'Clean', ['#e6dbce', '#a2b9be'], 0, 1, 1],
  ['goldenhour', 'Golden Hour', lateLight, .85, 1.3, 1.35],
  ['poster', 'Poster Print', [...lateLight], .7, 1.18, 1.25, 5]
].map(([key, name, palette, alpha, contrast, saturation, steps]) => ({
  key, name, palette, alpha, contrast, saturation,
  blend: key === 'neon' ? 'color' : 'soft-light',
  ...(steps ? { steps } : {})
}));

export const dimensions = [
  ['square', 'Square', 1080, 1080, '1:1'],
  ['portrait', 'Portrait', 1080, 1350, '4:5'],
  ['wide', 'Wide', 1920, 1080, '16:9']
].map(([key, name, width, height, ratio]) => ({ key, name, width, height, ratio }));

export const stock = [
  ['portrait', 'The heroine'], ['driver', 'The getaway driver'], ['boss', 'The boss'],
  ['lifeguard', 'The siren'], ['racer', 'The racer'], ['man', 'The leading man'],
  ['car', 'The getaway'], ['beach', 'The coastline'],
  ['boulevard', 'Ocean Drive', 'boulevard.jpg'], ['pier', 'The pier', 'pier.jpg']
].map(([key, name, file]) => ({
  key, name, source: file ?? 'sample-' + key + '.b64.txt', encoded: !file
}));

export function bounded(value, low, high) {
  return Math.max(low, Math.min(value, high));
}

export function findByKey(entries, key) {
  return entries.find(entry => key === entry.key);
}

export function panelShapes(key, width, height) {
  const margin = .014 * Math.min(width, height);
  const span = [width - margin * 2, height - margin * 2];
  return findByKey(arrangements, key).paths.map((path, slot) => {
    const polygon = path.map(vertex => vertex.map((t, axis) => margin + t * span[axis]));
    const xs = polygon.map(vertex => vertex[0]);
    const ys = polygon.map(vertex => vertex[1]);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return { slot, polygon, left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
  });
}

export function pointInPanel(polygon, x, y) {
  let crossings = 0;
  let [previousX, previousY] = polygon.at(-1) ?? [];
  for (const [nextX, nextY] of polygon) {
    if ((previousY > y) !== (nextY > y)) {
      const fraction = (y - previousY) / (nextY - previousY);
      if (x < previousX + fraction * (nextX - previousX)) crossings++;
    }
    [previousX, previousY] = [nextX, nextY];
  }
  return crossings % 2 === 1;
}
