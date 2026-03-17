import { call } from './odoo';

// ── Projects ──

export async function getProjects(domain = []) {
  return call('artifact.project', 'search_read', [domain], {
    fields: ['id', 'name', 'project_type', 'repo_url', 'artifact_path', 'deploy_base_path', 'deploy_template_id', 'version_count', 'deployment_count', 'description'],
    order: 'name',
  });
}

export async function createProject(vals) {
  return call('artifact.project', 'create', [vals]);
}

export async function updateProject(id, vals) {
  return call('artifact.project', 'write', [[id], vals]);
}

// ── Versions ──

export async function getVersions(domain = []) {
  return call('artifact.version', 'search_read', [domain], {
    fields: ['id', 'name', 'project_id', 'git_tag', 'git_commit', 'git_branch', 'checksum', 'file_size', 'file_size_display', 'artifact_path', 'build_date', 'built_by', 'status', 'notes', 'deployment_count'],
    order: 'build_date desc',
  });
}

export async function createVersion(vals) {
  return call('artifact.version', 'create', [vals]);
}

export async function updateVersion(id, vals) {
  return call('artifact.version', 'write', [[id], vals]);
}

// ── Deployments ──

export async function getDeployments(domain = []) {
  return call('artifact.deployment', 'search_read', [domain], {
    fields: ['id', 'name', 'project_id', 'version_id', 'target_type', 'compute_id', 'container_id', 'target_display', 'ssh_credential_id', 'deploy_template_id', 'pipeline_id', 'status', 'variables', 'started_at', 'finished_at', 'deployed_by', 'notes'],
    order: 'started_at desc, id desc',
  });
}

export async function createDeployment(vals) {
  return call('artifact.deployment', 'create', [vals]);
}

export async function triggerDeploy(deploymentId) {
  return call('artifact.deployment', 'action_deploy', [[deploymentId]]);
}

// ── Templates ──

export async function getDeployTemplates(domain = []) {
  return call('artifact.deploy.template', 'search_read', [domain], {
    fields: ['id', 'name', 'project_type', 'description', 'variable_names', 'step_count'],
    order: 'name',
  });
}

export async function getTemplateSteps(templateId) {
  return call('artifact.deploy.template.step', 'search_read', [[['template_id', '=', templateId]]], {
    fields: ['id', 'sequence', 'name', 'step_type', 'command', 'timeout', 'continue_on_error'],
    order: 'sequence',
  });
}

// ── Pipelines ──

export async function getPipeline(id) {
  const results = await call('artifact.deploy.pipeline', 'read', [[id]], {
    fields: ['id', 'name', 'status', 'current_step', 'started_at', 'finished_at', 'total_steps'],
  });
  return results[0] || null;
}

export async function getPipelineSteps(pipelineId) {
  return call('artifact.deploy.step', 'search_read', [[['pipeline_id', '=', pipelineId]]], {
    fields: ['id', 'sequence', 'name', 'step_type', 'command', 'status', 'exit_code', 'stdout', 'stderr', 'started_at', 'finished_at', 'duration_seconds', 'continue_on_error'],
    order: 'sequence',
  });
}

export async function cancelPipeline(id) {
  return call('artifact.deploy.pipeline', 'action_cancel', [[id]]);
}

// ── Target Compatibility ──

export async function getAllowedTargets() {
  return call('artifact.project', 'get_allowed_targets', []);
}

// ── Containers (from infra) ──

export async function getContainers(domain = []) {
  return call('infra.container', 'search_read', [domain], {
    fields: ['id', 'name', 'container_type', 'image', 'compute_id', 'cpu_limit', 'memory_limit', 'status'],
    order: 'compute_id, name',
  });
}

// ── SSH Credentials (from infra) ──

export async function getSSHCredentials(domain = []) {
  return call('infra.ssh.credential', 'search_read', [domain], {
    fields: ['id', 'name', 'host', 'port', 'username', 'server_type', 'key_id', 'deploy_status', 'compute_id', 'network_device_id'],
    order: 'name',
  });
}

// ── Computes (from infra) ──

export async function getComputes(domain = []) {
  return call('infra.compute', 'search_read', [domain], {
    fields: ['id', 'name', 'hostname', 'management_ip', 'datacenter_id', 'status'],
    order: 'name',
  });
}
