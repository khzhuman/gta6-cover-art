// All asset fetches are relative to this module; nothing contacts a remote service.
const ownedURLs = new Set();

export function objectURL(blob) {
  const url = URL.createObjectURL(blob);
  ownedURLs.add(url);
  return url;
}

export function releaseURL(url) {
  if (ownedURLs.delete(url)) URL.revokeObjectURL(url);
}

export async function textAssetURL(filename, mimeType) {
  const response = await fetch(new URL(`../assets/${filename}`, import.meta.url));
  if (!response.ok) throw new Error(`Could not load ${filename} (${response.status}).`);
  const binary = atob((await response.text()).trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return objectURL(new Blob([bytes], { type: mimeType }));
}

export async function displayFont() {
  const url = await textAssetURL('font.b64.txt', 'font/ttf');
  try {
    const face = new FontFace('ViceDisplay', `url("${url}")`, { weight: '700', display: 'swap' });
    await face.load();
    document.fonts.add(face);
    return face;
  } finally {
    releaseURL(url);
  }
}

export async function imageFromURL(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

export async function sampleAsset(scene) {
  const url = scene.encoded
    ? await textAssetURL(scene.source, 'image/jpeg')
    : new URL(`../samples/${scene.source}`, import.meta.url).href;
  try {
    return { ...scene, url, bitmap: await imageFromURL(url) };
  } catch (error) {
    releaseURL(url);
    throw error;
  }
}

// Keep removed uploads alive for undo/redo; free URLs when this document is discarded.
window.addEventListener('pagehide', event => {
  if (!event.persisted) for (const url of ownedURLs) releaseURL(url);
});
