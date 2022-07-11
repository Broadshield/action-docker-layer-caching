/** Original File from https://github.com/docker/setup-buildx-action/blob/master/src/git.ts */
import * as exec from '@actions/exec';

export async function getRemoteSha(repo: string, ref: string): Promise<string> {
  return exec
    .getExecOutput(`git`, ['ls-remote', repo, ref], {
      ignoreReturnCode: true,
      silent: true
    })
    .then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr);
      }
      const [rsha] = res.stdout.trim().split(/[\s\t]/);
      if (rsha.length == 0) {
        throw new Error(`Cannot find remote ref for ${repo}#${ref}`);
      }
      return rsha;
    });
}
