import 'source-map-support/register'

import * as core from '@actions/core'
import exec from 'actions-exec-listener'
import { LayerCache } from './src/LayerCache'
import {  ImageDetector } from './src/ImageDetector'

const main = async () => {
  // const repotag = core.getInput(`repotag`, { required: true })
  const primaryKey = core.getInput(`key`, { required: true })
  const restoreKeys = core.getInput(`restore-keys`, { required: false }).split(`\n`).filter(key => key !== ``)

  core.saveState(`already-existing-images`, JSON.stringify(await new ImageDetector().getExistingImages()))

  const layerCache = new LayerCache([])
  layerCache.concurrency = parseInt(core.getInput(`concurrency`, { required: true }), 10)
  const restoredKey = await layerCache.restore(primaryKey, restoreKeys)
  await layerCache.cleanUp()

  core.saveState(`restored-key`, JSON.stringify(restoredKey !== undefined ? restoredKey : ''))
}

main().catch(e => {
  console.error(e)
  core.setFailed(e)
})
