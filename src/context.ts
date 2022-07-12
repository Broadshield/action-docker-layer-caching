import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tmp from 'tmp';
import * as github from '@actions/github';
import * as core from '@actions/core';
import * as buildx from './buildx';
import * as handlebars from 'handlebars';
let _defaultContext, _tmpDir: string;
export const osPlat: string = os.platform();
export const osArch: string = os.arch();
export const dockerConfigHome: string = process.env.DOCKER_CONFIG || path.join(os.homedir(), '.docker');
export function defaultContext(): string {
  if (!_defaultContext) {
    let ref = github.context.ref;
    if (github.context.sha && ref && !ref.startsWith('refs/')) {
      ref = `refs/heads/${github.context.ref}`;
    }
    if (github.context.sha && !ref.startsWith(`refs/pull/`)) {
      ref = github.context.sha;
    }
    _defaultContext = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${github.context.repo.owner}/${github.context.repo.repo}.git#${ref}`;
  }
  return _defaultContext;
}

export interface DockerInputs {
  buildArgs: string[];
  buildContexts: string[];
  builder: string;
  cacheFrom: string[];
  cacheTo: string[];
  load: boolean;
  pull: boolean;
  push: boolean;
  context: string;
  githubToken?: string;
  dockerRegistry: string;
}
export interface BuildXInputs {
  buildkitdFlags: string;
  install: boolean;
}
export async function getBuildxInputs(): Promise<BuildXInputs> {
  return {
    buildkitdFlags: '--allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host',
    install: true,
  };
}
export async function getArgs(inputs: DockerInputs, defaultContextHere: string, buildxVersion: string): Promise<Array<string>> {
  // prettier-ignore
  return [
    ...await getBuildArgs(inputs, defaultContextHere, buildxVersion),
    ...await getCommonArgs(inputs, buildxVersion),
    handlebars.compile(inputs.context)({ defaultContextHere })
  ];
}

export function tmpDir(): string {
  if (!_tmpDir) {
    _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-layer-cache-')).split(path.sep).join(path.posix.sep);
  }
  return _tmpDir;
}

export function tmpNameSync(options?: tmp.TmpNameOptions): string {
  return tmp.tmpNameSync(options);
}

export async function getInputList(name: string, ignoreComma?: boolean): Promise<string[]> {
  const items = core.getInput(name);
  if (items == '') {
    return [];
  }
  return items
    .split(/\r?\n/)
    .filter(x => x)
    .reduce<string[]>((acc, line) => acc.concat(!ignoreComma ? line.split(',').filter(x => x) : line).map(pat => pat.trim()), []);
}

export const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

export function GitHubToken(providedToken?: string): string | undefined {
  if (providedToken && providedToken.length > 0) {
    return providedToken;
  } else {
    return github.context.payload.token ?? process.env.GITHUB_TOKEN;
  }
}

export async function getDockerInputs(defaultContextArg: string): Promise<DockerInputs> {
  return {
    buildArgs: await getInputList('build-args', true),
    buildContexts: await getInputList('build-contexts', true),
    builder: core.getInput('builder'),
    cacheFrom: await getInputList('cache-from', true),
    cacheTo: await getInputList('cache-to', true),
    context: core.getInput('context') || defaultContextArg,
    load: core.getBooleanInput('load'),
    pull: core.getBooleanInput('pull'),
    push: core.getBooleanInput('push'),
    githubToken: GitHubToken(core.getInput('github-token')),
    dockerRegistry: core.getInput('docker-registry'),
  };
}


async function getBuildArgs(inputs: DockerInputs, defaultContextArg: string, buildxVersion: string): Promise<Array<string>> {
  const args: Array<string> = ['build'];

  await asyncForEach(inputs.buildArgs, async buildArg => {
    args.push('--build-arg', buildArg);
  });
  if (buildx.satisfies(buildxVersion, '>=0.8.0')) {
    await asyncForEach(inputs.buildContexts, async buildContext => {
      args.push('--build-context', buildContext);
    });
  }
  await asyncForEach(inputs.cacheFrom, async cacheFrom => {
    args.push('--cache-from', cacheFrom);
  });
  await asyncForEach(inputs.cacheTo, async cacheTo => {
    args.push('--cache-to', cacheTo);
  });
  if (inputs.githubToken && inputs.context == defaultContextArg) {
    args.push('--secret', await buildx.getSecretString(`GIT_AUTH_TOKEN=${inputs.githubToken}`));
  }
  return args;
}

async function getCommonArgs(inputs: DockerInputs, buildxVersion: string): Promise<Array<string>> {
  const args: Array<string> = [];
  if (inputs.builder) {
    args.push('--builder', inputs.builder);
  }
  if (inputs.load) {
    args.push('--load');
  }
  if (buildx.satisfies(buildxVersion, '>=0.6.0')) {
    args.push('--metadata-file', await buildx.getMetadataFile());
  }
  if (inputs.pull) {
    args.push('--pull');
  }
  if (inputs.push) {
    args.push('--push');
  }
  return args;
}
