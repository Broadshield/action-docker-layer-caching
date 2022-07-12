import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface Manifest {
  Config: string;
  RepoTags: string[] | null;
  Layers: string[];
}

export type Manifests = Manifest[];

export async function loadRawManifests(
  rootPath: string
): Promise<string | Buffer> {
  return fs.readFile(path.join(rootPath, `manifest.json`));
}

export async function loadManifests(manifestPath: string): Promise<Manifests> {
  const raw = await loadRawManifests(manifestPath);
  return JSON.parse(raw.toString());
}
