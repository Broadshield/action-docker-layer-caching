import * as exec from '@actions/exec';
import * as core from '@actions/core';
import { getDockerInputs } from './context';

export async function runLocalRegistry(): Promise<boolean> {
  const dockerInputs = await getDockerInputs(core.getInput('github-token'));
  if (!dockerInputs.githubToken) {
    return false;
  }
  // docker run -d --restart=always -v "$(pwd)/registry:/var/lib/registry:rw" -p 5000:5000 -e REGISTRY_PROXY_REMOTEURL=https://ghcr.io -e REGISTRY_PROXY_USERNAME=\$ -e REGISTRY_PROXY_PASSWORD="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" --name registry registry:2;
  // IMAGE_ID=ghcr.io/${{ github.repository_owner }}/$IMAGE_NAME
  // # Change all uppercase to lowercase
  // IMAGE_ID=$(echo $IMAGE_ID | tr '[A-Z]' '[a-z]')
  // VERSION=$(echo "${{ github.ref }}" | sed -e 's,.*/\(.*\),\1,')
  // [[ "${{ github.ref }}" == "refs/tags/"* ]] && VERSION=$(echo $VERSION | sed -e 's/^v//')
  // docker tag $IMAGE_NAME $IMAGE_ID:$VERSION
  // docker push $IMAGE_ID:$VERSION
  return exec
    .getExecOutput('docker',
      [
        'run',
        '-d',
        '-p=5000', dockerInputs.dockerRegistry,
        '--password', dockerInputs.githubToken,
        '--username', '$'
      ], {
      ignoreReturnCode: true,
      silent: true
    })
    .then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        return false;
      }
      return res.exitCode == 0;
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .catch(_error => {
      return false;
    });
}

export async function dockerLoginGHCR(): Promise<boolean> {
  const dockerInputs = await getDockerInputs(core.getInput('github-token'));
  if (!dockerInputs.githubToken) {
    return false;
  }
  return exec
    .getExecOutput('docker',[
      'login', dockerInputs.dockerRegistry,
      '--password', dockerInputs.githubToken,
      '--username', '$'
    ], {
      ignoreReturnCode: true,
      silent: true
    })
    .then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        return false;
      }
      return res.exitCode == 0;
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .catch(_error => {
      return false;
    });
}

export async function isAvailable(): Promise<boolean> {
  return exec
    .getExecOutput('docker', undefined, {
      ignoreReturnCode: true,
      silent: true
    })
    .then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        return false;
      }
      return res.exitCode == 0;
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .catch(_error => {
      return false;
    });
}

export async function displayVersion(standaloneInput?: boolean): Promise<void> {
  const standalone: boolean = standaloneInput !== undefined ? standaloneInput : !(await isAvailable());
  core.startGroup(`Docker info`);
  if (standalone) {
    core.info(`Docker info skipped in standalone mode`);
  } else {
    await exec.exec('docker', ['version'], {
      failOnStdErr: false
    });
    await exec.exec('docker', ['info'], {
      failOnStdErr: false
    });
  }
  core.endGroup();
}
