import * as cache from "@actions/cache";
import * as core from '@actions/core';
import { URL } from 'node:url';

import { OutputsEnum, RefKey as ReferenceKey, StateEnum } from '../constants';

export const IsPost = !!process.env['STATE_isPost'];
export const tmpDir = process.env['STATE_tmpDir'] || '';

export function setTmpDir(tmpDirectory: string) {
  core.saveState('tmpDir', tmpDirectory);
}


if (!IsPost) {
  core.saveState('isPost', 'true');
}

export function enableBuildKit() {
  process.env['DOCKER_BUILDKIT']='1';
  process.env['BUILDKIT_INLINE_CACHE']='1';

}
export function isGhes(): boolean {
  const ghUrl = new URL(process.env.GITHUB_SERVER_URL || 'https://github.com');
  return ghUrl.hostname.toUpperCase() !== 'GITHUB.COM';
}

export function isExactKeyMatch(key: string, cacheKey?: string): boolean {
  return !!(
    cacheKey &&
    cacheKey.localeCompare(key, undefined, {
      sensitivity: 'accent'
    }) === 0
  );
}

export function setCacheState(state: string): void {
  core.saveState(StateEnum.CacheMatchedKey, state);
}

export function setCacheHitOutput(isCacheHit: boolean): void {
  core.setOutput(OutputsEnum.CacheHit, isCacheHit.toString());
}

export function setOutputAndState(key: string, cacheKey?: string): void {
  setCacheHitOutput(isExactKeyMatch(key, cacheKey));
  // Store the matched cache key if it exists
  if (cacheKey) {
    setCacheState(cacheKey);
  }
}

export function getCacheState(): string | undefined {
  const cacheKey = core.getState(StateEnum.CacheMatchedKey);
  if (cacheKey) {
    core.debug(`Cache state/key: ${cacheKey}`);
    return cacheKey;
  }

  return undefined;
}

export function logWarning(message: string): void {
  core.warning(`${message}`);
}

// Cache token authorized for all events that are tied to a ref
// See GitHub Context https://help.github.com/actions/automating-your-workflow-with-github-actions/contexts-and-expression-syntax-for-github-actions#github-context
export function isValidEvent(): boolean {
  return ReferenceKey in process.env && Boolean(process.env[ReferenceKey]);
}

export function getInputAsArray(
  name: string,
  options?: core.InputOptions
): string[] {
  return core
    .getInput(name, options)
    .split('\n')
    .map(s => s.trim())
    .filter(x => x !== '');
}

export function getInputAsInt(
  name: string,
  options?: core.InputOptions
): number | undefined {
  const value = Number.parseInt(core.getInput(name, options), 10);
  if (Number.isNaN(value) || value < 0) {
    return undefined;
  }
  return value;
}


export function isCacheFeatureAvailable(): boolean {
  if (!cache.isFeatureAvailable()) {
      if (isGhes()) {
          logWarning(
              "Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not."
          );
      } else {
          logWarning(
              "An internal error has occurred in cache backend. Please check https://www.githubstatus.com/ for any ongoing issue in actions."
          );
      }
      return false;
  }

  return true;
}
