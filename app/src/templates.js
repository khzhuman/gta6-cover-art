// Shared normalized geometry keeps thumbnails, cropping and exports in agreement.
export const arrangements = [
  { key: 'hero', name: 'Hero Split', detail: 'A leading role. Two side stories.', paths: [
    [[0, 0], [.6, 0], [.54, 1], [0, 1]],
    [[.6, 0], [1, 0], [1, .48], [.57, .51]],
    [[.57, .51], [1, .48], [1, 1], [.54, 1]]
  ] },
  { key: 'trio', name: 'Trio', detail: 'Three perspectives on the same night.', paths: [
    [[0, 0], [.34, 0], [.34, 1], [0, 1]],
    [[.34, 0], [.67, 0], [.67, 1], [.34, 1]],
    [[.67, 0], [1, 0], [1, 1], [.67, 1]]
  ] },
  { key: 'quad', name: 'Quad', detail: 'Four frames. Unlimited possibilities.', paths: [
    [[0, 0], [.5, 0], [.5, .5], [0, .5]],
    [[.5, 0], [1, 0], [1, .5], [.5, .5]],
    [[0, .5], [.5, .5], [.5, 1], [0, 1]],
    [[.5, .5], [1, .5], [1, 1], [.5, 1]]
  ] },
  { key: 'duo', name: 'Wide Duo', detail: 'A cinematic double feature.', paths: [
    [[0, 0], [1, 0], [1, .55], [0, .46]],
    [[0, .46], [1, .55], [1, 1], [0, 1]]
  ] }
];

export const treatments = [
  { key: 'sunset', name: 'Vice Sunset', palette: ['#ffb878', '#ef829c', '#904aac'], blend: 'soft-light', alpha: .53, contrast: 1.14, saturation: 1.18 },
  { key: 'neon', name: 'Neon Nights', palette: ['#46e6db', '#7b70c7', '#f044a5'], blend: 'color', alpha: .62, contrast: 1.22, saturation: .82 },
  { key: 'golden', name: 'Golden Hour', palette: ['#ffe0a1', '#edb176', '#c68b7f'], blend: 'soft-light', alpha: .38, contrast: 1.08, saturation: 1.08 },
  { key: 'clean', name: 'Clean', palette: ['#e6dbce', '#a2b9be'], blend: 'soft-light', alpha: 0, contrast: 1, saturation: 1 }
];

export const dimensions = [
  { key: 'square', name: 'Square', width: 1080, height: 1080, ratio: '1:1' },
  { key: 'portrait', name: 'Portrait', width: 1080, height: 1350, ratio: '4:5' },
  { key: 'wide', name: 'Wide', width: 1920, height: 1080, ratio: '16:9' }
];

// The two starter scenes are intentionally retained as ordinary image files.
export const stock = [
  { key: 'portrait', name: 'The heroine', source: 'sample-portrait.b64.txt', encoded: true },
  { key: 'car', name: 'The getaway', source: 'sample-car.b64.txt', encoded: true },
  { key: 'beach', name: 'The coastline', source: 'sample-beach.b64.txt', encoded: true },
  { key: 'man', name: 'The leading man', source: 'sample-man.b64.txt', encoded: true },
  { key: 'boulevard', name: 'Ocean Drive', source: 'boulevard.jpg', encoded: false },
  { key: 'pier', name: 'The pier', source: 'pier.jpg', encoded: false }
];

export const bounded = (number, minimum, maximum) => Math.max(minimum, Math.min(maximum, number));
export const findByKey = (catalog, key) => catalog.find(item => item.key === key);

export function panelShapes(key, width, height) {
  const inset = Math.min(width, height) * .014;
  return findByKey(arrangements, key).paths.map((vertices, slot) => {
    const polygon = vertices.map(([u, v]) => [inset + u * (width - 2 * inset), inset + v * (height - 2 * inset)]);
    const left = Math.min(...polygon.map(([x]) => x));
    const top = Math.min(...polygon.map(([, y]) => y));
    return {
      slot, polygon, left, top,
      width: Math.max(...polygon.map(([x]) => x)) - left,
      height: Math.max(...polygon.map(([, y]) => y)) - top
    };
  });
}

export function pointInPanel(polygon, x, y) {
  let inside = false;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[(i + 1) % polygon.length];
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) inside = !inside;
  }
  return inside;
}
