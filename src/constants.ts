export enum InputsEnum {
  Key = 'key',
  Path = 'path',
  RestoreKeys = 'restore-keys',
  UploadChunkSize = 'upload-chunk-size'
}

export enum OutputsEnum {
  CacheHit = 'cache-hit'
}

export enum StateEnum {
  CachePrimaryKey = 'CACHE_KEY',
  CacheMatchedKey = 'CACHE_RESULT'
}

export enum EventsEnum {
  Key = 'GITHUB_EVENT_NAME',
  Push = 'push',
  PullRequest = 'pull_request'
}
export enum CommandExitCodeEnum {
  SUCCESS,
  ERROR
}
export const RefKey = 'GITHUB_REF';
