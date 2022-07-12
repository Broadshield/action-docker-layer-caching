import * as core from '@actions/core';
import { EventsEnum, StateEnum } from './constants';

import { ImageDetector } from './image-detector';
import { LayerCache } from './layer-cache';
import ActionError from './utils/action-error';
import * as utils from "./utils/action-utils";
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
    if (JSON.parse(core.getInput('skip-save', { required: true }))) {
      core.info('Skipping save.');
      return;
    }
    const state = utils.getCacheState();

    // Inputs are re-evaluted before the post action, so we want the original key used for restore
    const primaryKey = core.getState(StateEnum.CachePrimaryKey);
    if (!primaryKey) {
      utils.logWarning(`Error retrieving key from state.`);
      return;
    }

    if (utils.isExactKeyMatch(primaryKey, state)) {
      core.info(
        `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
      );
      return;
    }

    const alreadyExistingImages: string[] = JSON.parse(
      core.getState(`already-existing-images`)
    );
    const restoredImages: string[] = JSON.parse(
      core.getState(`restored-images`)
    );

    const existingAndRestoredImages = [
      ...alreadyExistingImages,
      ...restoredImages
    ];

    const newImages = await ImageDetector.getImagesShouldSave(
      existingAndRestoredImages
    );

    if (newImages.length === 0) {
      core.info(`There is no image to save.`);
      return;
    }

    const imagesToSave = await ImageDetector.getImagesShouldSave(
      alreadyExistingImages
    );
    const layerCache = new LayerCache(imagesToSave);
    layerCache.concurrency = Number.parseInt(
      core.getInput(`concurrency`, { required: true }),
      10
    );

    await layerCache.store(primaryKey);
    await layerCache.cleanUp();
  } catch (error) {
    const actionError = new ActionError(
      'save:run: Failed to save image.',
      error
    );
    actionError.logError();
    core.setFailed('');
  }
}

run();
