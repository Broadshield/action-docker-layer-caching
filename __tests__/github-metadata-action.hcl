variable "GITHUB_ACTOR" {
    # The name of the person or app that initiated the workflow. For example, 'octocat'.
    default = "unknown_actor"
}

variable "GITHUB_BASE_REF" {
    # The name of the base ref or target branch of the pull request in a workflow run. This is only set when the event that triggers a workflow run is either 'pull_request' or 'pull_request_target'. For example, 'main'.
    default = "main"
}

variable "GITHUB_HEAD_REF" {
    # The head ref or source branch of the pull request in a workflow run. This property is only set when the event that triggers a workflow run is either 'pull_request' or 'pull_request_target'. For example, 'feature-branch-1'.
    default = "unknown-branch"
}

variable "GITHUB_JOB" {
    # The 'job_id' of the current job. For example, 'greeting_job'.
    default = "unknown_job_id"
}

variable "GITHUB_REF" {
    # The branch or tag ref that triggered the workflow run. For workflows triggered by 'push', this is the branch or tag ref that was pushed. For workflows triggered by 'pull_request', this is the pull request merge branch. For workflows triggered by 'release', this is the release tag created. For other triggers, this is the branch or tag ref that triggered the workflow run. This is only set if a branch or tag is available for the event type. The ref given is fully-formed, meaning that for branches the format is 'refs/heads/<branch_name>'', for pull requests it is 'refs/pull/<pr_number>/merge', and for tags it is 'refs/tags/<tag_name>''. For example, 'refs/heads/feature-branch-1'.
    default = "refs/heads/main"
}

variable "GITHUB_REF_NAME" {
    # The branch or tag name that triggered the workflow run. For example, 'feature-branch-1'.
    default = "unknown-branch"
}

variable "GITHUB_REF_PROTECTED" {
    # 'true' if branch protections are configured for the ref that triggered the workflow run.
    default = false
}

variable "GITHUB_REF_TYPE" {
    # The type of ref that triggered the workflow run. Valid values are 'branch' or 'tag'.
    default = "branch"
}

variable "GITHUB_REPOSITORY" {
    # The owner and repository name. For example, 'octocat/Hello-World'.
    default = "repo/owner"
}

variable "GITHUB_REPOSITORY_OWNER" {
    # The repository owner's name. For example, 'octocat'.
    default = "owner"
}

variable "GITHUB_RUN_ATTEMPT" {
    # A unique number for each attempt of a particular workflow run in a repository. This number begins at 1 for the workflow run's first attempt, and increments with each re-run. For example, '3'.
    default = 0
}

variable "GITHUB_RUN_ID" {
    # A unique number for each workflow run within a repository. This number does not change if you re-run the workflow run. For example, '1658821493'.
    default = 1658821493
}

variable "GITHUB_SHA" {
    # The commit SHA that triggered the workflow. The value of this commit SHA depends on the event that triggered the workflow. For more information, see Events that trigger workflows. For example, 'ffac537e6cbbf934b08745a378932722df287a53'.
    default = "ffac537e6cbbf934b08745a378932722df287a53"
}

variable "RUNNER_ARCH" {
    # The architecture of the runner executing the job. Possible values are X86, X64, ARM, or ARM64.
    default = "X64"
}

variable "RUNNER_NAME" {
    # The name of the runner executing the job. For example, 'Hosted Agent'
    default = "Hosted Agent"
}

variable "RUNNER_OS" {
    # The operating system of the runner executing the job. Possible values are Linux, Windows, or macOS. For example, Windows
    default = "Linux"
}

target "github-metadata-action" {
    context = "./test_project"
  dockerfile = "Dockerfile"
    args = {
        GITHUB_ACTOR = "${GITHUB_ACTOR}"
        GITHUB_BASE_REF = "${GITHUB_BASE_REF}"
        GITHUB_HEAD_REF = "${GITHUB_HEAD_REF}"
        GITHUB_JOB = "${GITHUB_JOB}"
        GITHUB_REF = "${GITHUB_REF}"
        GITHUB_REF_NAME = "${GITHUB_REF_NAME}"
        GITHUB_REF_PROTECTED = "${GITHUB_REF_PROTECTED}"
        GITHUB_REF_TYPE = "${GITHUB_REF_TYPE}"
        GITHUB_REPOSITORY = "${GITHUB_REPOSITORY}"
        GITHUB_REPOSITORY_OWNER = "${GITHUB_REPOSITORY_OWNER}"
        GITHUB_RUN_ATTEMPT = "${GITHUB_RUN_ATTEMPT}"
        GITHUB_RUN_ID = "${GITHUB_RUN_ID}"
        GITHUB_SHA = "${GITHUB_SHA}"
        RUNNER_ARCH = "${RUNNER_ARCH}"
        RUNNER_NAME = "${RUNNER_NAME}"
        RUNNER_OS = "${RUNNER_OS}"
    }
}
