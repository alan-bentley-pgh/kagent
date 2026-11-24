/**
 * The example resources the Quickstart creates. They mirror the chart's
 * `helm/kagent/templates/example-agents.yaml` and `harnesses.yaml`, so keep the two in step.
 */
import type { AgentResource } from "@/api/domain/agents";
import type { AgentTemplateResource, ToolBinding } from "@/api/domain/agentTemplates";
import { DEFAULT_HARNESS_WORKER_POOL, type HarnessResource } from "@/api/domain/harnesses";
import type { BuiltinSkillsCatalog } from "@/api/runtimeConfig";
import { emptyHarnessDraft, harnessSpecFromDraft } from "@/components/harness-form/harnessDraft";

/** The chart's install namespace, default model, tool server and kagent harness. */
export const QUICKSTART_NAMESPACE = "kagent";
export const DEFAULT_MODEL_CONFIG = "default-model-config";
export const TOOL_SERVER = "kagent-tool-server";
export const QUICKSTART_HARNESS = "kagent-default";
export const PLATFORM_AGENT = "platform-agent";

export interface Specialist {
  /** The chart's short name: the template is `platform-<key>`, the agent `<key>-agent`. */
  key: string;
  label: string;
  /** How the platform agent's description names this area. */
  topic: string;
  skill: string;
  description: string;
  systemPrompt: string;
  read: string[];
  write: string[];
  /** Selected when the step opens. */
  preselected: boolean;
}

const PROMPT_INCLUDES = [
  `{{include "builtin/skills-usage"}}`,
  `{{include "builtin/tool-usage-best-practices"}}`,
  `{{include "builtin/safety-guardrails"}}`,
];

function specialistPrompt(lead: string): string {
  return `${lead} Load your skill and follow it.\n\n${PROMPT_INCLUDES.join("\n\n")}\n`;
}

const KUBERNETES_PROMPT = [
  "You are a Kubernetes specialist. You help users run and troubleshoot\nworkloads in the cluster where kagent runs. When a question matches one of\nyour skills, load that skill and follow it.",
  PROMPT_INCLUDES[0],
  `{{include "builtin/kubernetes-context"}}`,
  PROMPT_INCLUDES[1],
  PROMPT_INCLUDES[2],
].join("\n\n") + "\n";

export const SPECIALISTS: readonly Specialist[] = [
  {
    key: "kubernetes",
    label: "Kubernetes",
    topic: "Kubernetes",
    skill: "k8s-troubleshooting",
    description: "Kubernetes specialist: diagnoses and fixes unhealthy pods, deployments and services.",
    systemPrompt: KUBERNETES_PROMPT,
    read: [
      "k8s_describe_resource", "k8s_generate_resource", "k8s_get_available_api_resources",
      "k8s_get_cluster_configuration", "k8s_get_events", "k8s_get_pod_logs", "k8s_get_resource_yaml",
      "k8s_get_resources", "k8s_wait",
    ],
    write: [
      "k8s_annotate_resource", "k8s_apply_manifest", "k8s_check_service_connectivity", "k8s_create_resource",
      "k8s_create_resource_from_url", "k8s_delete_resource", "k8s_execute_command", "k8s_label_resource",
      "k8s_patch_resource", "k8s_patch_status", "k8s_remove_annotation", "k8s_remove_label", "k8s_rollout",
      "k8s_scale",
    ],
    preselected: true,
  },
  {
    key: "helm",
    label: "Helm",
    topic: "Helm",
    skill: "helm-release-management",
    description: "Helm specialist: lists, inspects, upgrades and uninstalls Helm releases and manages chart repositories.",
    systemPrompt: specialistPrompt("You are a Helm specialist. You help users inspect, troubleshoot, upgrade and uninstall Helm releases."),
    read: ["helm_get_release", "helm_list_releases"],
    write: ["helm_repo_add", "helm_repo_update", "helm_uninstall", "helm_upgrade"],
    preselected: true,
  },
  {
    key: "istio",
    label: "Istio",
    topic: "Istio",
    skill: "istio-traffic-debugging",
    description: "Istio specialist: debugs service mesh traffic, mTLS, routing, sidecars, ztunnel and waypoints.",
    systemPrompt: specialistPrompt("You are an Istio specialist. You diagnose and fix service mesh traffic, security and waypoint problems."),
    read: [
      "istio_analyze_cluster_configuration", "istio_generate_waypoint", "istio_list_waypoints", "istio_proxy_config",
      "istio_proxy_status", "istio_version", "istio_waypoint_status", "istio_ztunnel_config",
    ],
    write: ["istio_apply_waypoint", "istio_delete_waypoint"],
    preselected: true,
  },
  {
    key: "argo-rollouts",
    label: "Argo Rollouts",
    topic: "Argo Rollouts",
    skill: "argo-rollouts-progressive-delivery",
    description: "Argo Rollouts specialist: checks, promotes, pauses and updates canary and blue-green Rollouts.",
    systemPrompt: specialistPrompt("You are an Argo Rollouts specialist. You help users run canary and blue-green releases with Argo Rollouts."),
    read: [
      "argo_check_plugin_logs", "argo_rollouts_list", "argo_verify_argo_rollouts_controller_install",
      "argo_verify_kubectl_plugin_install",
    ],
    write: ["argo_pause_rollout", "argo_promote_rollout", "argo_set_rollout_image", "argo_verify_gateway_plugin"],
    preselected: true,
  },
  {
    key: "kubescape",
    label: "Kubescape",
    topic: "security",
    skill: "kubescape-security-posture",
    description: "Security specialist: reviews Kubescape configuration scans, image vulnerabilities and workload behavior.",
    systemPrompt: specialistPrompt("You are a Kubernetes security specialist. You review Kubescape results and recommend hardening steps."),
    read: [
      "kubescape_check_health", "kubescape_get_application_profile", "kubescape_get_configuration_scan",
      "kubescape_get_network_neighborhood", "kubescape_get_vulnerability_details", "kubescape_list_application_profiles",
      "kubescape_list_configuration_scans", "kubescape_list_network_neighborhoods", "kubescape_list_vulnerabilities",
      "kubescape_list_vulnerability_manifests",
    ],
    write: [],
    preselected: false,
  },
  {
    key: "prometheus",
    label: "Prometheus",
    topic: "metrics",
    skill: "prometheus-observability",
    description: "Observability specialist: writes and runs PromQL queries about cluster and application metrics.",
    systemPrompt: specialistPrompt("You are an observability specialist. You turn questions about metrics into PromQL, run them and explain the results."),
    read: [
      "prometheus_label_names_tool", "prometheus_promql_tool", "prometheus_query_range_tool", "prometheus_query_tool",
      "prometheus_targets_tool",
    ],
    write: [],
    preselected: false,
  },
];

export const templateName = (specialist: Specialist) => `platform-${specialist.key}`;
export const agentName = (specialist: Specialist) => `${specialist.key}-agent`;

/** The Harness the chart ships when `harnesses.kagent.enabled`, built by the Harness form's own code. */
export function quickstartHarness(namespace = QUICKSTART_NAMESPACE): HarnessResource {
  return {
    metadata: { name: QUICKSTART_HARNESS, namespace },
    spec: harnessSpecFromDraft({ ...emptyHarnessDraft(), workerPool: DEFAULT_HARNESS_WORKER_POOL }),
  };
}

/** Read-only tools run freely; tools that change things wait for approval. */
function toolBindings(read: string[], write: string[]): ToolBinding[] {
  const server = { kind: "RemoteMCPServer", name: TOOL_SERVER };
  return [
    { mcp: { server, tools: read } },
    ...(write.length > 0 ? [{ mcp: { server, requireApproval: true, tools: write } }] : []),
  ];
}

/**
 * A specialist's template. With no catalog (built-in skills off) it has no skills; with a
 * catalog that lacks its skill it is undefined.
 */
export function specialistTemplate(
  specialist: Specialist,
  catalog: BuiltinSkillsCatalog | undefined,
  namespace = QUICKSTART_NAMESPACE,
): AgentTemplateResource | undefined {
  const skill = catalog?.skills.find((entry) => entry.name === specialist.skill);
  if (catalog && !skill) return undefined;
  return {
    metadata: { name: templateName(specialist), namespace },
    spec: {
      description: specialist.description,
      modelConfig: { name: DEFAULT_MODEL_CONFIG },
      promptTemplate: { dataSources: [{ name: "kagent-builtin-prompts", alias: "builtin" }] },
      systemPrompt: specialist.systemPrompt,
      tools: toolBindings(specialist.read, specialist.write),
      ...(catalog && skill ? { skills: [{ name: skill.name, source: { oci: catalog.image, path: skill.path } }] } : {}),
    },
  };
}

/** "A", "A and B", "A, B and C". */
function listTopics(topics: string[]): string {
  if (topics.length <= 1) return topics.join("");
  return `${topics.slice(0, -1).join(", ")} and ${topics[topics.length - 1]}`;
}

/** The orchestrator template: one sub-agent per specialist template it can call. */
export function platformTemplate(
  specialists: readonly Specialist[],
  namespace = QUICKSTART_NAMESPACE,
): AgentTemplateResource {
  return {
    metadata: { name: PLATFORM_AGENT, namespace },
    spec: {
      description: `Platform assistant: sends ${listTopics(specialists.map((entry) => entry.topic))} questions to a specialist.`,
      modelConfig: { name: DEFAULT_MODEL_CONFIG },
      systemPrompt:
        "You help users run and troubleshoot the Kubernetes cluster where kagent\nruns. You do not call cluster tools yourself. Send each task to the\nspecialist that owns it, and pass along what the user asked. If a task\nspans several areas, call each specialist in turn and combine the answers.\n",
      tools: specialists.map((entry) => ({
        subAgent: { name: entry.key, description: entry.description, templateRef: { name: templateName(entry) } },
      })),
    },
  };
}

/** An Agent that references `template` and runs on the Quickstart harness. */
export function quickstartAgent(name: string, template: string, namespace = QUICKSTART_NAMESPACE): AgentResource {
  return {
    metadata: { name, namespace },
    spec: { template: { ref: { name: template } }, harnessRef: { name: QUICKSTART_HARNESS } },
  };
}

/** Why a specialist cannot be offered, or undefined when it can. No catalog offers all, without skills. */
export function specialistUnavailable(
  specialist: Specialist,
  catalog: BuiltinSkillsCatalog | undefined,
): string | undefined {
  if (catalog && !catalog.skills.some((entry) => entry.name === specialist.skill)) {
    return specialist.key === "prometheus"
      ? "Needs a Prometheus URL in kagent-tools."
      : `This install has no ${specialist.skill} skill.`;
  }
  return undefined;
}

/** What one create did. "exists" covers a resource found in the list or refused as AlreadyExists. */
export type CreateOutcome =
  | { state: "created" }
  | { state: "exists" }
  | { state: "failed"; message: string; denied: boolean };

/** gRPC codes as `ApiError.code` carries them. */
export function outcomeOfError(error: unknown): CreateOutcome {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "AlreadyExists") return { state: "exists" };
  return {
    state: "failed",
    message: error instanceof Error ? error.message : String(error),
    denied: code === "PermissionDenied",
  };
}

/**
 * Creates each item in order and records what happened to it. One failure does not stop
 * the rest, so a retry can send only the failures.
 */
export async function createEach<T extends { id: string }>(
  items: readonly T[],
  create: (item: T) => Promise<unknown>,
  onOutcome: (id: string, outcome: CreateOutcome) => void,
): Promise<Record<string, CreateOutcome>> {
  const outcomes: Record<string, CreateOutcome> = {};
  for (const item of items) {
    let outcome: CreateOutcome;
    try {
      await create(item);
      outcome = { state: "created" };
    } catch (error) {
      outcome = outcomeOfError(error);
    }
    outcomes[item.id] = outcome;
    onOutcome(item.id, outcome);
  }
  return outcomes;
}

/** An item as one step shows it. */
export type ItemStatus =
  | { kind: "new" }
  | { kind: "exists" }
  | { kind: "unavailable"; reason: string }
  | { kind: "done"; outcome: CreateOutcome };

/**
 * A session result wins over the list, so something just created reads "Created" and not
 * "Already exists" once the list catches up. A failure stays on screen until retried.
 */
export function itemStatus(
  outcome: CreateOutcome | undefined,
  listed: boolean,
  unavailable?: string,
): ItemStatus {
  if (outcome) return { kind: "done", outcome };
  if (listed) return { kind: "exists" };
  if (unavailable) return { kind: "unavailable", reason: unavailable };
  return { kind: "new" };
}

/** Whether a create of this item is still to come: new, or failed last time. */
export function isPending(status: ItemStatus): boolean {
  return status.kind === "new" || (status.kind === "done" && status.outcome.state === "failed");
}

/** Whether the item is there now, whoever made it. */
export function isPresent(status: ItemStatus): boolean {
  return status.kind === "exists" || (status.kind === "done" && status.outcome.state !== "failed");
}
