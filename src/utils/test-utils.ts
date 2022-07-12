import { InputsEnum } from '../constants';

// See: https://github.com/actions/toolkit/blob/master/packages/core/src/core.ts#L67
function getInputName(name: string): string {
  return `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
}

export function setInput(name: string, value: string): void {
  process.env[getInputName(name)] = value;
}

interface CacheInput {
  path: string;
  key: string;
  restoreKeys?: string[];
}

export function setInputs(input: CacheInput): void {
  setInput(InputsEnum.Path, input.path);
  setInput(InputsEnum.Key, input.key);
  if (input.restoreKeys) {
    setInput(InputsEnum.RestoreKeys, input.restoreKeys.join('\n'));
  }
}

export function clearInputs(): void {
  delete process.env[getInputName(InputsEnum.Path)];
  delete process.env[getInputName(InputsEnum.Key)];
  delete process.env[getInputName(InputsEnum.RestoreKeys)];
  delete process.env[getInputName(InputsEnum.UploadChunkSize)];
}
