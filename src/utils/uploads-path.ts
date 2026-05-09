import fs from 'fs';
import path from 'path';

function unique(paths: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    const normalized = path.resolve(p);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function getUploadsCandidates(): string[] {
  const fromEnv = (process.env.UPLOADS_DIR || '').trim();
  const cwd = process.cwd();
  const __dirnameCandidate = path.resolve(__dirname, '..', '..');
  return unique([
    fromEnv,
    path.join(cwd, 'uploads'),
    path.join(cwd, 'storage', 'uploads'),
    path.join(__dirnameCandidate, 'uploads')
  ].filter((p) => p && p.length > 0));
}

export function resolveReadableUploadsDir(): string {
  const candidates = getUploadsCandidates();
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // Ignore inaccessible path and keep searching.
    }
  }
  return candidates[0] || path.join(process.cwd(), 'uploads');
}

export function resolveCardImagesDir(): string {
  return path.join(resolveReadableUploadsDir(), 'card_images');
}

// Artwork "cru" (sem moldura / sem HUD). Usado pelo client para renderizar a carta dinamicamente.
export function resolveCardArtworksDir(): string {
  return path.join(resolveReadableUploadsDir(), 'card_artworks');
}

export function resolveCardBasesDir(): string {
  return path.join(resolveReadableUploadsDir(), 'card_bases');
}
