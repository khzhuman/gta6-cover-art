(() => {
  'use strict';

  const templates = [
    {
      id: 'hero', name: 'Hero Split', description: 'One lead. Two supporting scenes.',
      icon: 'hero',
      panels: [
        { name: 'Hero', points: [[0, 0], [0.59, 0], [0.54, 1], [0, 1]] },
        { name: 'Scene 02', points: [[0.59, 0], [1, 0], [1, 0.49], [0.565, 0.51]] },
        { name: 'Scene 03', points: [[0.565, 0.51], [1, 0.49], [1, 1], [0.54, 1]] }
      ]
    },
    {
      id: 'trio', name: 'Trio', description: 'Three scenes. One story.', icon: 'trio',
      panels: [
        { name: 'Left', points: [[0, 0], [0.335, 0], [0.335, 1], [0, 1]] },
        { name: 'Center', points: [[0.335, 0], [0.665, 0], [0.665, 1], [0.335, 1]] },
        { name: 'Right', points: [[0.665, 0], [1, 0], [1, 1], [0.665, 1]] }
      ]
    },
    {
      id: 'quad', name: 'Quad', description: 'Four moments worth keeping.', icon: 'quad',
      panels: [
        { name: 'Top left', points: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]] },
        { name: 'Top right', points: [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]] },
        { name: 'Bottom left', points: [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]] },
        { name: 'Bottom right', points: [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]] }
      ]
    },
    {
      id: 'duo', name: 'Wide Duo', description: 'Two cinematic bands. Made for wide.', icon: 'duo',
      panels: [
        { name: 'Top scene', points: [[0, 0], [1, 0], [1, 0.54], [0, 0.46]] },
        { name: 'Bottom scene', points: [[0, 0.46], [1, 0.54], [1, 1], [0, 1]] }
      ]
    }
  ];

  const grades = [
    {
      id: 'sunset', name: 'Vice Sunset', note: 'Orange skies, pink afterglow',
      colors: ['#ffae73', '#e96495'], filter: 'contrast(1.13) saturate(1.16)',
      wash: ['#ffb166', '#f48797', '#9249aa'], blend: 'soft-light', opacity: 0.48,
      glow: '#ffad74', vignette: 0.33
    },
    {
      id: 'neon', name: 'Neon Nights', note: 'Electric teal, midnight magenta',
      colors: ['#56dbd5', '#db63bb'], filter: 'grayscale(0.52) contrast(1.2) saturate(0.9)',
      wash: ['#48dfd1', '#8474c2', '#e942aa'], blend: 'color', opacity: 0.67,
      glow: '#48b8d6', vignette: 0.45
    },
    {
      id: 'golden', name: 'Golden Hour', note: 'A little warmth, a lot of glow',
      colors: ['#ffd38b', '#d78b5a'], filter: 'contrast(1.06) saturate(1.06)',
      wash: ['#f8d99b', '#efb97d', '#cb8c78'], blend: 'soft-light', opacity: 0.34,
      glow: '#ffe0a5', vignette: 0.2
    },
    {
      id: 'clean', name: 'Clean', note: 'Your photos in their own light',
      colors: ['#eee9de', '#9aabb1'], filter: 'none',
      wash: null, blend: 'source-over', opacity: 0, glow: null, vignette: 0
    }
  ];

  const sizes = [
    { id: 'square', name: 'Square', ratio: '1:1', width: 1080, height: 1080 },
    { id: 'portrait', name: 'Portrait', ratio: '4:5', width: 1080, height: 1350 },
    { id: 'wide', name: 'Wide', ratio: '16:9', width: 1920, height: 1080 }
  ];

  const samples = [
    { id: 'portrait', name: 'The heroine', file: 'samples/sample-portrait.jpg', position: '50% 42%' },
    { id: 'car', name: 'The getaway', file: 'samples/sample-car.jpg', position: '50% 60%' },
    { id: 'beach', name: 'The coastline', file: 'samples/sample-beach.jpg', position: '50% 55%' },
    { id: 'man', name: 'The leading man', file: 'samples/sample-man.jpg', position: '50% 35%' },
    { id: 'boulevard', name: 'Ocean Drive', file: 'samples/boulevard.jpg', position: '50% 50%' },
    { id: 'pier', name: 'The pier', file: 'samples/pier.jpg', position: '50% 50%' }
  ];

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const getTemplate = id => templates.find(item => item.id === id) || templates[0];
  const getGrade = id => grades.find(item => item.id === id) || grades[0];
  const getSize = id => sizes.find(item => item.id === id) || sizes[0];

  function panelLayout(templateId, width, height) {
    const margin = Math.min(width, height) * 0.014;
    const innerW = width - margin * 2;
    const innerH = height - margin * 2;
    return getTemplate(templateId).panels.map((panel, index) => {
      const points = panel.points.map(([x, y]) => [margin + x * innerW, margin + y * innerH]);
      const xs = points.map(point => point[0]);
      const ys = points.map(point => point[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { index, name: panel.name, points, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    });
  }

  function pointInPanel(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  window.ViceFrameTemplates = Object.freeze({
    templates, grades, sizes, samples, clamp, getTemplate, getGrade, getSize, panelLayout, pointInPanel
  });
})();
