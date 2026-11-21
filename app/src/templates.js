export const sizes = {
  square: { name: 'Square', width: 1080, height: 1080, aspect: '1:1' },
  portrait: { name: 'Portrait', width: 1080, height: 1350, aspect: '4:5' },
  wide: { name: 'Wide', width: 1920, height: 1080, aspect: '16:9' },
};

export const samples = [
  ['portrait', 'Neon Portrait'],
  ['car', 'Getaway Car'],
  ['beach', 'Last Light'],
  ['man', 'Night Watch'],
  ['driver', 'The Driver'],
  ['boss', 'The Boss'],
  ['lifeguard', 'Beach Patrol'],
  ['racer', 'Street Racer'],
].map(([key, name]) => ({ id: key, name, encoded: true, source: `sample-${key}.b64.txt` })).concat([
  { id: 'boulevard', name: 'Boulevard', encoded: false, source: 'boulevard.jpg' },
  { id: 'pier', name: 'The Pier', encoded: false, source: 'pier.jpg' },
]);

export const grades = {
  golden: {
    name: 'Golden Hour', colors: ['#ffd76a', '#ff8f4d', '#e5488c', '#5f2d91'],
    contrast: 1.34, saturation: 1.50, grain: .22,
  },
  print: {
    name: 'Poster Print', colors: ['#fff1bc', '#f19b77', '#bc4477', '#352246'],
    steps: 5, grain: .22,
  },
};

function panel(role, sub, points, label) {
  return { role, sub, points, label };
}

// Neighboring panels share vertices so the divider is continuous at every aspect.
export const templates = {
  showcase: {
    name: 'Showcase', note: 'A leading portrait with three scenes stacked on each side.',
    demo: ['boss', 'driver', 'man', 'racer', 'portrait', 'lifeguard', 'car'],
    panels: [
      panel('THE BOSS', 'Owns the night', [[.345,.05],[.655,.05],[.675,.95],[.325,.95]], [.365,.865]),
      panel('THE DRIVER', 'Never misses a turn', [[0,.05],[.345,.05],[.338,.383],[0,.383]], [.03,.295]),
      panel('THE MUSCLE', 'Settles every score', [[0,.383],[.338,.383],[.331,.70],[0,.70]], [.03,.615]),
      panel('THE RACER', 'Redline at midnight', [[0,.70],[.331,.70],[.325,.95],[0,.95]], [.03,.865]),
      panel('THE SIREN', 'Trouble sounds sweet', [[.655,.05],[1,.05],[1,.383],[.662,.383]], [.685,.295]),
      panel('THE LOOKOUT', 'Sees the storm first', [[.662,.383],[1,.383],[1,.70],[.669,.70]], [.685,.565]),
      panel('THE GETAWAY', 'Leave the lights behind', [[.669,.70],[1,.70],[1,.95],[.675,.95]], [.685,.865]),
    ],
  },
  ensemble: {
    name: 'Ensemble', note: 'One leading frame and six supporting scenes cut on the diagonal.',
    demo: ['driver', 'boss', 'car', 'portrait', 'racer', 'man', 'beach'],
    panels: [
      panel('THE DRIVER', 'Never misses a turn', [[.23,0],[.72,0],[.64,.62],[.32,.7]], [.34,.59]),
      panel('THE BOSS', 'Owns the night', [[0,0],[.23,0],[.28,.389],[0,.47]], [.03,.35]),
      panel('THE GETAWAY', 'Leave the lights behind', [[0,.47],[.28,.389],[.32,.7],[0,.78]], [.03,.59]),
      panel('THE SIREN', 'Trouble sounds sweet', [[.72,0],[1,0],[1,.33],[.68,.31]], [.74,.24]),
      panel('THE RACER', 'Redline at midnight', [[.68,.31],[1,.33],[1,.58],[.64,.62]], [.75,.49]),
      panel('THE FIXER', 'Nothing stays broken', [[0,.78],[.32,.7],[.46,.665],[.40,1],[0,1]], [.03,.87]),
      panel('THE COASTLINE', 'Ends where it begins', [[.46,.665],[.64,.62],[1,.58],[1,1],[.40,1]], [.74,.86]),
    ],
  },
  hero: {
    name: 'Hero Split', note: 'A leading portrait beside a sharp slice of scenery.',
    demo: ['portrait', 'boulevard'],
    panels: [
      panel('THE LEAD', 'All eyes here', [[0,0],[.71,0],[.49,1],[0,1]], [.05,.72]),
      panel('THE CITY', 'Up after dark', [[.71,0],[1,0],[1,1],[.49,1]], [.74,.72]),
    ],
  },
  trio: {
    name: 'Trio', note: 'Three side by side scenes with slanted cuts.',
    demo: ['portrait', 'car', 'pier'],
    panels: [
      panel('THE SPARK', 'First sight', [[0,0],[.32,0],[.24,1],[0,1]], [.035,.68]),
      panel('THE CHASE', 'Foot to the floor', [[.32,0],[.72,0],[.60,1],[.24,1]], [.34,.68]),
      panel('THE ESCAPE', 'Past the last exit', [[.72,0],[1,0],[1,1],[.60,1]], [.74,.68]),
    ],
  },
  quad: {
    name: 'Quad', note: 'Four frames that meet at an off-center crossroads.',
    demo: ['driver', 'boss', 'racer', 'beach'],
    panels: [
      panel('THE ARRIVAL', 'Just in time', [[0,0],[.56,0],[.49,.47],[0,.56]], [.04,.39]),
      panel('THE DEAL', 'No second offers', [[.56,0],[1,0],[1,.39],[.49,.47]], [.62,.30]),
      panel('THE RUN', 'Don’t look back', [[0,.56],[.49,.47],[.43,1],[0,1]], [.04,.73]),
      panel('THE DAWN', 'A clean slate', [[.49,.47],[1,.39],[1,1],[.43,1]], [.64,.73]),
    ],
  },
  duo: {
    name: 'Wide Duo', note: 'Two sweeping scenes divided by a diagonal across the horizon.',
    demo: ['beach', 'pier'],
    panels: [
      panel('THE DAY', 'Salt in the air', [[0,0],[1,0],[1,.35],[0,.62]], [.05,.38]),
      panel('THE NIGHT', 'Heat on the pavement', [[0,.62],[1,.35],[1,1],[0,1]], [.70,.71]),
    ],
  },
};

export function bounds(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

export function contains(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside;
}
