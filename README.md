# Docker Layer Caching in GitHub Actions [![Readme Test status is unavailable](https://github.com/satackey/action-docker-layer-caching/workflows/Readme%20Test/badge.svg)](https://github.com/satackey/action-docker-layer-caching/actions?query=workflow%3A%22Readme+Test%22) [![CI status is unavailable](https://github.com/satackey/action-docker-layer-caching/workflows/CI/badge.svg)](https://github.com/satackey/action-docker-layer-caching/actions?query=workflow%3ACI)

Enable Docker Layer Caching by adding a single line in GitHub Actions.
This GitHub Action speeds up the building of docker images in your GitHub Actions workflow.

You can run `docker buildx build` and `docker compose build` in your GitHub Actions workflow using the cache with no special configuration, and it also supports multi-stage builds.

**However you can enhance the performance by adding the following configuration to your GitHub Actions workflow:**
Instead of building the image like:

```bash
docker build -t mysuser/myapp .
```

 Do it like this:

```bash
docker buildx build --cache-to type=inline --push -t mysuser/myapp .
```

This GitHub Action uses the [docker save](https://docs.docker.com/engine/reference/commandline/save/) / [docker load](https://docs.docker.com/engine/reference/commandline/load/) command and the [@actions/cache](https://www.npmjs.com/package/@actions/cache) library.

## ⚠️ **Deprecation Notice for `v0.0.4` and older** ⚠️

The author had not considered a large number of layers to be cached, so those versions process all layers in parallel.
([#12](https://github.com/satackey/action-docker-layer-caching/issues/12))
**Please update to version `v0.0.5` with limited concurrency to avoid overloading the cache service.**

## Example workflows

### Docker Compose
```yaml
name: CI

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    # Pull the latest image to build, and avoid caching pull-only images.
    # (docker pull is faster than caching in most cases.)
    - run: docker compose pull

    # In this step, this action saves a list of existing images,
    # the cache is created without them in the post run.
    # It also restores the cache if it exists.
    - uses: Broadshield/action-docker-layer-caching@main
      # Ignore the failure of a step and avoid terminating the job.
      continue-on-error: true

    - run: docker compose up --build

    # Finally, "Post Run Broadshield/action-docker-layer-caching@main",
    # which is the process of saving the cache, will be executed.
```


### docker build

```yaml
name: CI

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      packages: write
      contents: read
    steps:
    - uses: actions/checkout@v2

    # In this step, this action saves a list of existing images,
    # the cache is created without them in the post run.
    # It also restores the cache if it exists.
    - uses: Broadshield/action-docker-layer-caching@main
      # Ignore the failure of a step and avoid terminating the job.
      continue-on-error: true

    - name: Build the Docker image
      run: buildx build --cache-to type=inline --file Dockerfile --tag my-image-name:$(date +%s) .

    # Finally, "Post Run Broadshield/action-docker-layer-caching@main",
    # which is the process of saving the cache, will be executed.
```


## Inputs

See [action.yml](./action.yml) for details.

By default, the cache is separated by the workflow name.
You can also set the cache key manually, like the official [actions/cache](https://github.com/actions/cache#usage) action.

```yaml
    - uses: Broadshield/action-docker-layer-caching@main
      # Ignore the failure of a step and avoid terminating the job.
      continue-on-error: true
      with:
        key: docker-layer-caching-${{ github.workflow }}-${{ github.head_ref || github.ref }}-${{ github.event_name }}-{hash}
        restore-keys: |
          docker-layer-caching-${{ github.workflow }}-${{ github.head_ref || github.ref }}-${{ github.event_name }}-{hash}
          docker-layer-caching-${{ github.workflow }}-${{ github.head_ref || github.ref }}-${{ github.event_name }}-
          docker-layer-caching-${{ github.workflow }}-${{ github.head_ref || github.ref }}-
          docker-layer-caching-${{ github.workflow }}-
          docker-layer-caching-
```

**Note: You must include `{hash}` in the `key` input.** (`{hash}` is replaced by the hash value of the docker image when the action is executed.)
