import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { promises as fs } from 'node:fs';

import { CommandHelper } from '../src/command-helper';
import {
  CommandExitCodeEnum,
  EventsEnum,
  RefKey as ReferenceKey
} from '../src/constants';
import run as restoreRun from "../src/restore";
import run as saveRun from "../src/save";
import { ImageDetector } from '../src/image-detector';
import { LayerCache } from '../src/layer-cache';
import * as actionUtils from '../src/utils/action-utils';
import * as testUtils from '../src/utils/test-utils';

const actionUtilsPath = '../src/utils/actionUtils';

jest.setTimeout(20_000);
jest.mock('@actions/cache');
jest.mock('@actions/core');

beforeAll(() => {
  jest.spyOn(core, 'getInput').mockImplementation((name, options) => {
    return jest.requireActual('@actions/core').getInput(name, options);
  });
  jest.spyOn(actionUtils, 'getCacheState').mockImplementation(() => {
    return jest.requireActual(actionUtilsPath).getCacheState();
  });
  jest
    .spyOn(actionUtils, 'isExactKeyMatch')
    .mockImplementation((key, cacheResult) => {
      return jest
        .requireActual(actionUtilsPath)
        .isExactKeyMatch(key, cacheResult);
    });
  jest
    .spyOn(actionUtils, 'getInputAsArray')
    .mockImplementation((name, options) => {
      const actualUtils = jest.requireActual(actionUtilsPath);
      return actualUtils.getInputAsArray(name, options);
    });
  jest.spyOn(actionUtils, 'isValidEvent').mockImplementation(() => {
    const actualUtils = jest.requireActual(actionUtilsPath);
    return actualUtils.isValidEvent();
  });
});

beforeEach(() => {
  process.env[EventsEnum.Key] = EventsEnum.Push;
  process.env[ReferenceKey] = 'refs/heads/feature-branch';

  jest.spyOn(actionUtils, 'isGhes').mockImplementation(() => false);
  jest
    .spyOn(actionUtils, 'isCacheFeatureAvailable')
    .mockImplementation(() => true);
});

afterEach(() => {
  testUtils.clearInputs();
  delete process.env[EventsEnum.Key];
  delete process.env[ReferenceKey];
});

describe('Image Detector', () => {
  const dir = './__tests__/tmp';
  const savedCacheKey = 'Linux-node-bb828da54c148048dd17899ba9fda624811cfb43';
  const savedRestoreKeys = ['Linux-node-'];
  const referenceImage = 'reference=hello-world*';
  const helloWorldImage = 'hello-world:latest';

  test('Empty command creates empty output', async () => {
    const cmd = await new CommandHelper(
      process.cwd(),
      undefined,
      undefined
    ).exec(true);
    expect.hasAssertions();
    expect(cmd.stderr).toBe('');
    expect(cmd.stdout).toBe('');
    expect(cmd.exitCode).toBe(CommandExitCodeEnum.SUCCESS);
  });

  test('Erroring command creates error output', async () => {
    const cmd = await new CommandHelper(
      process.cwd(),
      `docker nothing`,
      undefined
    ).exec(true);
    expect.hasAssertions();
    expect(cmd.stderr).toBe(
      `docker: 'nothing' is not a docker command.\n` + `See 'docker --help'`
    );
    expect(cmd.stdout).toBe('');
    expect(cmd.exitCode).toBe(CommandExitCodeEnum.ERROR);
  });
  test('Pull hello-world docker image', async () => {
    process.env.INPUT_FILTER = referenceImage;
    const cmd = await new CommandHelper(
      process.cwd(),
      `docker pull ${helloWorldImage}`,
      undefined
    ).exec(true);
    expect.hasAssertions();
    expect(cmd.exitCode).toBe(CommandExitCodeEnum.SUCCESS);
    const imageRecords = await ImageDetector.getExistingImages();
    const imageRecord = imageRecords.find(
      image => image.key === 'feb5d9fea6a5'
    );
    expect(imageRecord?.value).toEqual(helloWorldImage);
  });
  test('Find and save hello-world image', async () => {
    process.env.INPUT_FILTER = referenceImage;
    const imageRecords = await ImageDetector.getExistingImages();
    const imageRecord = imageRecords.find(
      image => image.value === helloWorldImage
    );

    expect(imageRecord?.key).toStrictEqual('feb5d9fea6a5');
    const imageList = [imageRecord!.key, imageRecord!.value];
    await fs.mkdir(dir, { recursive: true });
    process.chdir(dir);
    const distinctImages = [...new Set(imageList)];
    core.info(distinctImages.join(','));

    const layerCache = new LayerCache(distinctImages);
    layerCache.concurrency = 10;
    jest
      .spyOn(core, 'getState')
      // Cache Entry State
      .mockImplementationOnce(() => {
        return savedCacheKey;
      })
      // Cache Key State
      .mockImplementationOnce(() => {
        return '';
      });
    const saveCacheMock = jest.spyOn(cache, 'saveCache');
    await layerCache.store(savedCacheKey);

    expect(saveCacheMock).toHaveBeenCalledTimes(1);

    const restoredKey = await layerCache.restore(
      savedCacheKey,
      savedRestoreKeys
    );
    await layerCache.cleanUp();
    core.info(`restored-key ${JSON.stringify(restoredKey || '')}`);
  });

  test('Find and restore hello-world image', async () => {
    process.env.INPUT_FILTER = referenceImage;
    await fs.mkdir(dir, { recursive: true });
    process.chdir(dir);
    const distinctImages = ['feb5d9fea6a5', helloWorldImage];
    core.info(distinctImages.join(','));

    const layerCache = new LayerCache([]);
    layerCache.concurrency = 10;

    const restoredKey = await layerCache.restore(
      savedCacheKey,
      savedRestoreKeys
    );
    core.info(`restored-key ${JSON.stringify(restoredKey || '')}`);
  });

  test('restore without AC available should no-op', async () => {
    jest.spyOn(actionUtils, 'isGhes').mockImplementation(() => false);
    jest
      .spyOn(actionUtils, 'isCacheFeatureAvailable')
      .mockImplementation(() => false);

    const restoreCacheMock = jest.spyOn(cache, 'restoreCache');
    const setCacheHitOutputMock = jest.spyOn(actionUtils, 'setCacheHitOutput');

    await run();

    expect(restoreCacheMock).toHaveBeenCalledTimes(0);
    expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
    expect(setCacheHitOutputMock).toHaveBeenCalledWith(false);
  });
  test('restore with invalid event outputs warning', async () => {
    const logWarningMock = jest.spyOn(actionUtils, 'logWarning');
    const failedMock = jest.spyOn(core, 'setFailed');
    const invalidEvent = 'commit_comment';
    process.env[Events.Key] = invalidEvent;
    delete process.env[RefKey];
    await run();
    expect(logWarningMock).toHaveBeenCalledWith(
      `Event Validation Error: The event type ${invalidEvent} is not supported because it's not tied to a branch or tag ref.`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
  });
});
