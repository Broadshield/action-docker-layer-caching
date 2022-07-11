import * as cache from '@actions/cache';
import * as core from '@actions/core';
import PromisePool from 'native-promise-pool';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import recursiveReaddir from 'recursive-readdir';
import format from 'string-format';

import { CommandHelper } from './command-helper';
import { loadManifests, loadRawManifests, Manifest, Manifests } from './tar';
import ActionError from './utils/action-error';

class LayerCache {
  ids: string[] = [];

  currentTarStoreDir = 'image';

  unformattedSaveKey = '';

  restoredRootKey = '';

  imagesDir: string = path.join(process.env.GITHUB_WORKSPACE ?? __dirname , '..', '.adlc');

  enabledParallel = true;

  concurrency = 4;

  static ERROR_CACHE_ALREADY_EXISTS_STR = `Unable to reserve cache with key`;

  static ERROR_LAYER_CACHE_NOT_FOUND_STR = `Layer cache not found`;

  constructor(ids: string[]) {
    this.ids = ids;
  }

  async store(key: string): Promise<boolean> {
    this.unformattedSaveKey = key;

    await this.saveImageAsUnpacked();
    if (this.enabledParallel) {
      await this.separateAllLayerCaches();
    }

    if ((await this.storeRoot()) === undefined) {
      core.info(`cache key already exists, aborting.`);
      return false;
    }

    await Promise.all(this.enabledParallel ? await this.storeLayers() : []);
    return true;
  }

  private async saveImageAsUnpacked(): Promise<number> {
    await fs.mkdir(this.getUnpackedTarDir(), { recursive: true });
    const saveArgumentArray = await this.makeRepotagsDockerSaveArgReady(
      this.ids
    );
    const saveArgument = saveArgumentArray.join(`' '`);
    const result = await new CommandHelper(this.getUnpackedTarDir(), 'bash', [
      '-c',
      `docker save '${saveArgument}' | tar xf - -C .`
    ]).exec();
    return result.exitCode;
  }

  private async makeRepotagsDockerSaveArgReady(
    repotags: string[]
  ): Promise<string[]> {
    const getMiddleIdsWithRepotag = async (id: string): Promise<string[]> => {
      return [id, ...(await this.getAllImageIdsFrom(id))];
    };
    const readyArgumentsUnFlat = await Promise.all(
      repotags.map(async id => getMiddleIdsWithRepotag(id))
    );
    const readyArguments = readyArgumentsUnFlat.flat();
    return [...new Set(readyArguments)];
  }

  private async getAllImageIdsFrom(repotag: string): Promise<string[]> {
    const result = await new CommandHelper(this.getUnpackedTarDir(), 'docker', [
      'history',
      '-q',
      repotag
    ]).exec();

    return result.stdout
      .split(`\n`)
      .filter(id => id !== `<missing>` && id !== ``);
  }

  private async registryIsAccessible(): Promise<boolean> {
  //   proxy:
  // remoteurl: https://registry-1.docker.io
  // username: [username]
  // password: [password]
    // "docker run -d -p 5000:5000 -e REGISTRY_PROXY_REMOTEURL=https://ghcr.io -e REGISTRY_PROXY_USERNAME=\$ --name registry registry:2;"
    // DOCKER_OPTS="$DOCKER_OPTS --build-arg BUILDKIT_INLINE_CACHE=0"
    // docker buildx create --use --name build-cacher --platform linux/amd64
    // docker build  --build-arg BUILDKIT_INLINE_CACHE=1
    // docker build --cache-from type=registry,ref=localhost:5000/myuser/myapp2 --cache-to type=registry,ref=localhost:5000/myuser/myapp2 --build-arg BUILDKIT_INLINE_CACHE=1 -t myuser/myapp2  .
    // docker tag  myuser/myapp2 localhost:5000/myuser/myapp2
    // docker push  localhost:5000/myuser/myapp2
return true;
    }

  private async getManifests(): Promise<Manifests> {
    return loadManifests(this.getUnpackedTarDir());
  }

  private async storeRoot(): Promise<number | undefined> {
    const rootKey = await this.generateRootSaveKey();
    const paths = [this.getUnpackedTarDir()];
    core.info(`Start storing root cache, key: ${rootKey}, dir: ${paths}`);
    const cacheId = await LayerCache.dismissError(
      cache.saveCache(paths, rootKey),
      LayerCache.ERROR_CACHE_ALREADY_EXISTS_STR,
      -1
    );
    core.info(`Stored root cache, key: ${rootKey}, id: ${cacheId}`);
    return cacheId !== -1 ? cacheId : undefined;
  }

  private async separateAllLayerCaches(): Promise<void> {
    await LayerCache.moveLayerTarsInDir(
      this.getUnpackedTarDir(),
      this.getLayerCachesDir()
    );
  }

  private async joinAllLayerCaches(): Promise<void> {
    await LayerCache.moveLayerTarsInDir(
      this.getLayerCachesDir(),
      this.getUnpackedTarDir()
    );
  }

  static async moveLayerTarsInDir(
    fromDir: string,
    toDir: string
  ): Promise<void> {
    const allDirs = await recursiveReaddir(fromDir);
    const layerTars = allDirs
      .filter(layerPath => path.basename(layerPath) === `layer.tar`)
      .map(layerPath => path.relative(fromDir, layerPath));

    const moveLayer = async (layer: string): Promise<void> => {
      const from = path.join(fromDir, layer);
      const to = path.join(toDir, layer);
      core.debug(`Moving layer tar from ${from} to ${to}`);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rename(from, to);
    };
    await Promise.all(layerTars.map(async layer => moveLayer(layer)));
  }

  private async storeLayers(): Promise<number[]> {
    const pool = new PromisePool(this.concurrency);
    const layerIdPromises = await this.getLayerIds();
    return Promise.all(
      layerIdPromises.map(async layerId => {
        return pool.open(async () => this.storeSingleLayerBy(layerId));
      })
    );
  }

  static async dismissError<T>(
    promise: Promise<T>,
    dismissString: string,
    defaultResult: T
  ): Promise<T> {
    try {
      return promise;
    } catch (error) {
      if (error instanceof cache.ValidationError) {
        throw new ActionError('LayerCache:dismissError:ValidationError', error);
      } else if (error instanceof cache.ReserveCacheError) {
        const reservedCacheError = new ActionError(
          'LayerCache:dismissError:ReserveCacheError',
          error
        );
        core.info(reservedCacheError.getError());
      } else {
        const unknownError = new ActionError(
          'LayerCache:dismissError:UnknownError',
          error
        );
        if (unknownError.getError().includes(dismissString)) {
          core.info(unknownError.getError());
        } else {
          core.warning(unknownError.getError());
        }
      }
      return defaultResult;
    }
  }

  private async storeSingleLayerBy(layerId: string): Promise<number> {
    const layerPath = this.genSingleLayerStorePath(layerId);
    const key = await this.generateSingleLayerSaveKey(layerId);

    core.info(`Start storing layer cache: ${JSON.stringify({ layerId, key })}`);
    const cacheId = await LayerCache.dismissError(
      cache.saveCache([layerPath], key),
      LayerCache.ERROR_CACHE_ALREADY_EXISTS_STR,
      -1
    );
    core.info(`Stored layer cache: ${JSON.stringify({ key, cacheId })}`);

    core.debug(
      JSON.stringify({
        log: `storeSingleLayerBy`,
        layerId,
        layerPath,
        key,
        cacheId
      })
    );
    return cacheId;
  }

  // ---

  async restore(
    primaryKey: string,
    restoreKeys?: string[]
  ): Promise<string | undefined> {
    const restoredCacheKey = await this.restoreRoot(primaryKey, restoreKeys);
    if (restoredCacheKey === undefined) {
      core.info(`Root cache could not be found. aborting.`);
      return undefined;
    }
    if (this.enabledParallel) {
      const hasRestoredAllLayers = await this.restoreLayers();
      if (!hasRestoredAllLayers) {
        core.info(`Some layer cache could not be found. aborting.`);
        return undefined;
      }
      await this.joinAllLayerCaches();
    }
    await this.loadImageFromUnpacked();
    return restoredCacheKey;
  }

  private async restoreRoot(
    primaryKey: string,
    restoreKeys?: string[]
  ): Promise<string | undefined> {
    core.debug(
      `Trying to restore root cache: ${JSON.stringify({
        restoreKeys,
        dir: this.getUnpackedTarDir()
      })}`
    );
    const restoredRootKey = await cache.restoreCache(
      [this.getUnpackedTarDir()],
      primaryKey,
      restoreKeys
    );
    core.debug(`restoredRootKey: ${restoredRootKey}`);
    if (restoredRootKey === undefined) {
      return undefined;
    }
    this.restoredRootKey = restoredRootKey;

    return restoredRootKey;
  }

  private async restoreLayers(): Promise<boolean> {
    const pool = new PromisePool(this.concurrency);
    const layerIdPromises = await this.getLayerIds();
    const tasks = layerIdPromises.map(async layerId =>
      pool.open(async () => this.restoreSingleLayerBy(layerId))
    );

    try {
      await Promise.all(tasks);
    } catch (error) {
      const actionError = new ActionError(`LayerCache:restoreLayers:`, error);
      if (
        actionError
          .getError()
          .includes(LayerCache.ERROR_LAYER_CACHE_NOT_FOUND_STR)
      ) {
        core.info(actionError.getError());

        // Avoid UnhandledPromiseRejectionWarning
        for (const task of tasks) {
          task
            .then(out => {
              core.error(out);
            })
            .catch(error_ => {
              const subError = new ActionError(
                'LayerCache:restoreLayers:subtasks:',
                error_
              );
              subError.logError();
            });
        }

        return false;
      }
      throw error;
    }

    return true;
  }

  private async restoreSingleLayerBy(id: string): Promise<string> {
    const layerPath = this.genSingleLayerStorePath(id);
    const key = await this.recoverSingleLayerKey(id);
    const dir = path.dirname(layerPath);

    core.debug(
      JSON.stringify({
        log: `restoreSingleLayerBy`,
        id,
        layerPath,
        dir,
        key
      })
    );

    await fs.mkdir(dir, { recursive: true });
    const result = await cache.restoreCache([layerPath], key);

    if (result === undefined) {
      throw new ActionError(
        `${LayerCache.ERROR_LAYER_CACHE_NOT_FOUND_STR}: ${JSON.stringify({
          id
        })}`
      );
    }

    return result;
  }

  private async loadImageFromUnpacked(): Promise<void> {
    const cmd = new CommandHelper(this.getUnpackedTarDir(), `sh`, [
      '-c',
      'tar cf - . | docker load'
    ]);
    await cmd.exec();
  }

  async cleanUp(): Promise<void> {
    await fs.rm(this.getImagesDir(), {force: true, recursive: true });
  }

  // ---

  getImagesDir(): string {
    return this.imagesDir;
  }

  getUnpackedTarDir(): string {
    return path.join(this.getImagesDir(), this.getCurrentTarStoreDir());
  }

  getLayerCachesDir(): string {
    return `${this.getUnpackedTarDir()}-layers`;
  }

  getCurrentTarStoreDir(): string {
    return this.currentTarStoreDir;
  }

  genSingleLayerStorePath(id: string): string {
    return path.join(this.getLayerCachesDir(), id, `layer.tar`);
  }

  async generateRootHashFromManifest(): Promise<string> {
    const manifest = await loadRawManifests(this.getUnpackedTarDir());
    return crypto
      .createHash(`sha256`)
      .update(manifest.toString(), `utf8`)
      .digest(`hex`);
  }

  async generateRootSaveKey(): Promise<string> {
    const rootHash = await this.generateRootHashFromManifest();
    const formatted = await this.getFormattedSaveKey(rootHash);
    core.debug(
      JSON.stringify({ log: `generateRootSaveKey`, rootHash, formatted })
    );
    return `${formatted}-root`;
  }

  async generateSingleLayerSaveKey(id: string): Promise<string> {
    const formatted = await this.getFormattedSaveKey(id);
    core.debug(
      JSON.stringify({ log: `generateSingleLayerSaveKey`, formatted, id })
    );
    return `layer-${formatted}`;
  }

  async recoverSingleLayerKey(id: string): Promise<string> {
    const unformatted = await this.recoverUnformattedSaveKey();
    return format(`layer-${unformatted}`, { hash: id });
  }

  async getFormattedSaveKey(hash: string): Promise<string> {
    const result = format(this.unformattedSaveKey, { hash });
    core.debug(JSON.stringify({ log: `getFormattedSaveKey`, hash, result }));
    return result;
  }

  async recoverUnformattedSaveKey(): Promise<string> {
    const hash = await this.generateRootHashFromManifest();
    core.debug(JSON.stringify({ log: `recoverUnformattedSaveKey`, hash }));

    return this.restoredRootKey.replace(hash, `{hash}`).replace(/-root$/, ``);
  }

  static getTarFilesFromManifest(manifest: Manifest): string[] {
    return manifest.Layers;
  }

  async getLayerTarFiles(): Promise<string[]> {
    const manifestList = await this.getManifests();
    const tarFilesThatMayDuplicate = manifestList.flatMap(manifest =>
      LayerCache.getTarFilesFromManifest(manifest)
    );
    return [...new Set(tarFilesThatMayDuplicate)];
  }

  async getLayerIds(): Promise<string[]> {
    const tarFiles = await this.getLayerTarFiles();
    const layerIds = tarFiles.map(layerFilePath => path.dirname(layerFilePath));
    core.debug(JSON.stringify({ log: `getLayerIds`, layerIds }));
    return layerIds;
  }
}

export { LayerCache };
