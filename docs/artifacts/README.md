# Artifact Management Module

## Module: `artifact_management`
Depends on: `base`, `infra_management`
Location: `odoo-backend/custom-addons/artifact_management/`

## Models (7)

### Registry
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `artifact.project` | name (unique), project_type (jar/docker/lxc), repo_url, deploy_base_path | Software project definition |
| `artifact.version` | project_id, git_tag (unique per project), git_commit, git_branch, checksum, file_size | Built artifact version |

### Deployment
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `artifact.deployment` | version_id, target_type (compute/container), compute_id/container_id, ssh_credential_id, status | What deployed where |
| `artifact.deploy.pipeline` | deployment_id, ssh_credential_id, status, step_ids | Running/completed execution |
| `artifact.deploy.step` | pipeline_id, sequence, step_type (ssh/local/sftp), command, stdout/stderr, exit_code | Individual step record |

### Templates
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `artifact.deploy.template` | name, project_type, variable_names, step_ids | Reusable step sequences |
| `artifact.deploy.template.step` | template_id, sequence, step_type, command (with {variables}), timeout | Template step definition |

## Target Compatibility

```python
ALLOWED_TARGETS = {
    'jar':    { 'compute': ['dedicated_server', 'vm'], 'container': ['lxc', 'lxd', 'docker', 'podman'] },
    'docker': { 'compute': ['dedicated_server', 'vm'], 'container': [] },
    'lxc':    { 'compute': ['dedicated_server', 'vm'], 'container': [] },
}
```
- JAR artifacts can deploy to servers, VMs, and containers
- Docker/LXC artifacts can only deploy to servers and VMs (no nesting)
- UI disables invalid targets, backend validates on create/deploy

## Pipeline Executor
- `action_deploy()` on deployment creates pipeline from template, resolves `{variables}`, spawns background thread
- Thread opens one paramiko SSH session, runs steps sequentially
- Commits to DB after each step (frontend polls for progress)
- Supports ssh (remote exec), local (subprocess), sftp (file upload)
- Truncates large output (64KB stdout, 16KB stderr per step)

## Seed Data
- "RouteSphere JAR Deploy" template with 9 steps: stop, kill, backup, upload, install, permissions, version file, history, start, verify

## React UI
- Route: `/artifacts` — 3 tabs: Projects, Versions, Deployments
- Deploy dialog: infra tree on left, pick DC → compute/container targets (with compatibility filtering)
- PipelineViewer: terminal-style step output with 2s polling, progress bar, cancel

## Variables
Templates use `{variable}` placeholders resolved at deploy time:
- Built-in: `deploy_path`, `artifact_path`, `git_tag`, `git_commit`, `git_branch`, `target_name`, `deploy_user`
- Custom: passed as JSON in deployment `variables` field (e.g. `{"tenant": "bdcom", "profile": "dev"}`)
