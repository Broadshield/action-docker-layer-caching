import * as core from '@actions/core';

import { CommandHelper } from './command-helper';

export function undefinedOnEmpty(value?: string): string | undefined {
  if (!value || value.trim() === '') {
    return undefined;
  }
  return value;
}

export const ImageDetector = {
  async getExistingImages(): Promise<Record<string, string>[]> {
    core.debug(`Existing Images:`);
    const rawFilter = undefinedOnEmpty(core.getInput(`filter`));
    const filter = rawFilter ? `--filter=${rawFilter}` : '';
    const cmd = new CommandHelper(process.cwd(), `docker`, [
      'image',
      'ls',
      '--format={{.ID}} {{.Repository}}:{{.Tag}}',
      '--filter=dangling=false',
      filter
    ]);
    const output = await cmd.exec();
    const images = output.stdout.split('\n').filter(key => key !== ``);
    const existingImageRecords: Record<string, string>[] = [];
    for (const image of images) {
      const [key, value] = image.split(' ');
      const imageEntry: Record<string, string> = {
        key,
        value
      };
      existingImageRecords.push(imageEntry);
    }

    return existingImageRecords;
  },
  getImageSetFromRecords(imageRecords: Record<string, string>[]): string[] {
    const imageRecordIdentifiersArray = [
      ...imageRecords.map(image => image.key),
      ...imageRecords.map(image => image.value)
    ];
    return [...new Set(imageRecordIdentifiersArray)];
  },

  async getImagesShouldSave(
    alreadyRegisteredImages: string[]
  ): Promise<string[]> {
    core.debug(`Images to save:`);
    const imageRecords = await ImageDetector.getExistingImages();
    const resultArray = ImageDetector.getImageSetFromRecords(imageRecords);
    return resultArray.filter(item => !alreadyRegisteredImages.includes(item));
  }
};
