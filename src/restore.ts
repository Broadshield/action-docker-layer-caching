

// import * as os from 'os';
// import * as path from 'path';
import * as core from '@actions/core';
import { EventsEnum } from './constants';
import * as buildx from './buildx';
import * as context from './context';
import * as docker from './docker';
import { ImageDetector } from './image-detector';
import { LayerCache } from './layer-cache';
import ActionError from './utils/action-error';
import * as utils from "./utils/action-utils";
import { CommandHelper } from './command-helper';
// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logWarning(e.message));
async function run(): Promise<void> {
  try {
    if (!utils.isCacheFeatureAvailable()) {
      core.notice('Skipping restore because cache feature is not available.');
      return;
    }
    if (!utils.isValidEvent()) {
      utils.logWarning(
        `Event Validation Error: The event type ${process.env[EventsEnum.Key]
        } is not supported because it's not tied to a branch or tag ref.`
      );
      return;
    }

    // const defContext = context.defaultContext();
    // standalone if docker cli not available
    const standalone = !(await docker.isAvailable());
    await docker.displayVersion(standalone);

    if (!(await buildx.isAvailable(standalone))) {
      core.setFailed(`Docker buildx is required. See https://github.com/docker/setup-buildx-action to set up buildx.`);
      return;
    }
    utils.enableBuildKit();

    const state = utils.getCacheState();
    // const dockerInputs: context.DockerInputs = await context.getDockerInputs(defContext);

    utils.setTmpDir(context.tmpDir());
    core.startGroup(`Download and install buildx`);
    await buildx.install('latest', standalone ? context.tmpDir() : context.dockerConfigHome, standalone);
    const cmd = new CommandHelper(process.cwd(), `docker`, [
      'buildx',
      'install'
    ]);
    const output = await cmd.exec();
    if (output.exitCode !== 0) {
      core.warning(output.stderr);
    }
    await buildx.displayVersion(standalone);
    core.endGroup();



    //* Get any existing images and tags from docker so we don't waste
    //  time restoring something thats already available
    const alreadyExistingImageRecords = await ImageDetector.getExistingImages();
    const existingImageSet = ImageDetector.getImageSetFromRecords(
      alreadyExistingImageRecords
    );
    core.saveState(`already-existing-images`, JSON.stringify(existingImageSet));

    const layerCache = new LayerCache([]);
    layerCache.concurrency = utils.getInputAsInt(`concurrency`, { required: true }) || 4;
    const primaryKey = core.getInput(`key`, { required: true })
    const restoreKeys = utils.getInputAsArray(`restore-keys`);
    const restoredKey = await layerCache.restore(primaryKey, restoreKeys);
    await layerCache.cleanUp();

    core.saveState(`restored-key`, JSON.stringify(restoredKey ?? ''));
    core.saveState(
      `restored-images`,
      JSON.stringify(await ImageDetector.getImagesShouldSave(existingImageSet))
    );
  } catch (error) {
    core.saveState(`restored-key`, JSON.stringify(``));
    core.saveState(`restored-images`, JSON.stringify([]));
    const actionError = new ActionError(
      'restore:run: Failed to restore image.',
      error
    );
    actionError.logError();
    core.setFailed('');
  }
}

run();
