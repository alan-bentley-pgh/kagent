import { useMemo, useState, type ReactNode } from "react";
import { Alert, Button, Checkbox, Skeleton, Space, Steps, Tag, Typography } from "antd";
import { useTheme, type Theme } from "@emotion/react";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Bot,
  BookOpen,
  CircleCheck,
  CircleX,
  Container,
  ExternalLink,
  LayoutTemplate,
  LoaderCircle,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  apiClient,
  isNotFound,
  useAgentsAcrossNamespaces,
  useAgentTemplates,
  useHarnesses,
  useInvalidateAgents,
  useInvalidateAgentTemplates,
  useInvalidateHarnesses,
  useModel,
} from "@/api";
import { isPermissionDenied } from "@/api/ApiError";
import { runtimeConfig } from "@/api/runtimeConfig";
import { inlineLink } from "@/components/common/linkStyles";
import { ReadError } from "@/components/common/ReadError";
import { PageFrame } from "@/components/Structure/PageFrame";
import { DOCS_URL } from "@/components/Structure/navItems";
import { buildPath, paths } from "@/router/routes";
import { halfway } from "@/theme/theme";
import { InstantButtons } from "./QuickstartEmptyState";
import {
  agentName,
  createEach,
  DEFAULT_MODEL_CONFIG,
  isPending,
  isPresent,
  itemStatus,
  PLATFORM_AGENT,
  platformTemplate,
  QUICKSTART_HARNESS,
  QUICKSTART_NAMESPACE,
  quickstartAgent,
  quickstartHarness,
  SPECIALISTS,
  specialistTemplate,
  specialistUnavailable,
  templateName,
  TOOL_SERVER,
  type CreateOutcome,
  type ItemStatus,
} from "./quickstartExamples";

const { Text, Title } = Typography;
const NS = QUICKSTART_NAMESPACE;

/** A plain line per built-in skill. A skill missing here shows the catalog's own text. */
const SKILL_SUMMARIES: Record<string, string> = {
  "k8s-troubleshooting": "Finds why pods, deployments or services are unhealthy.",
  "helm-release-management": "Lists, upgrades and uninstalls Helm releases.",
  "istio-traffic-debugging": "Debugs mesh traffic: 503s, mTLS and routing.",
  "argo-rollouts-progressive-delivery": "Checks, promotes and pauses canary and blue-green rollouts.",
  "kubescape-security-posture": "Reviews Kubescape scans and image vulnerabilities.",
  "prometheus-observability": "Writes and runs PromQL queries about metrics.",
};

type StepKey = "harness" | "templates" | "agents";

interface Item {
  id: string;
  step: StepKey;
  title: string;
  description: string;
  status: ItemStatus;
  preselected: boolean;
  /** The built-in skill a template brings. */
  skill?: { name: string; summary: string };
  create: () => Promise<unknown>;
}

/** The example harness, templates and agents, created step by step. */
export function QuickstartPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const catalog = useMemo(() => runtimeConfig().builtinSkills, []);

  const harnesses = useHarnesses(NS);
  const templates = useAgentTemplates(NS);
  const agents = useAgentsAcrossNamespaces([NS]);
  const model = useModel(NS, DEFAULT_MODEL_CONFIG);
  const invalidateHarnesses = useInvalidateHarnesses();
  const invalidateTemplates = useInvalidateAgentTemplates();
  const invalidateAgents = useInvalidateAgents();

  const [step, setStep] = useState(0);
  // Banners the user closed on the Templates step; they come back on reload.
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const dismiss = (key: string) => setDismissed((prev) => ({ ...prev, [key]: true }));
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [outcomes, setOutcomes] = useState<Record<string, CreateOutcome>>({});
  const [busy, setBusy] = useState<string[]>([]);

  const reads = [harnesses, templates, agents];
  const failed = reads.find((read) => read.error)?.error;
  const loaded = reads.every((read) => read.data !== undefined) && (model.data !== undefined || model.error !== undefined);

  const harnessListed = Boolean(harnesses.data?.some((row) => row.name === QUICKSTART_HARNESS));
  const templateListed = (name: string) => Boolean(templates.data?.some((row) => row.name === name));
  const agentListed = (name: string) => Boolean(agents.data?.agents.some((row) => row.namespace === NS && row.name === name));

  // Only a confirmed absence blocks; a model read the caller may not make is left to the controller.
  const modelMissing = isNotFound(model.error);
  const modelReadFailed = model.error && !modelMissing && !isPermissionDenied(model.error) ? model.error : undefined;
  const templateBlock = modelMissing || modelReadFailed ? "model" : undefined;

  const harnessItem: Item = {
    id: `harness:${QUICKSTART_HARNESS}`,
    step: "harness",
    title: QUICKSTART_HARNESS,
    description: "Runs agents with kagent's own runtime on the kagent-default worker pool.",
    status: itemStatus(outcomes[`harness:${QUICKSTART_HARNESS}`], harnessListed),
    preselected: true,
    create: () => apiClient.agentBuildingBlocks.createHarness({ namespace: NS, name: QUICKSTART_HARNESS, resource: quickstartHarness() }),
  };

  const templateItems: Item[] = SPECIALISTS.map((specialist) => {
    const name = templateName(specialist);
    const id = `template:${name}`;
    const unavailable = specialistUnavailable(specialist, catalog) ?? (templateBlock ? "Needs the default model." : undefined);
    const skill = catalog?.skills.find((entry) => entry.name === specialist.skill);
    return {
      id,
      step: "templates" as const,
      title: name,
      description: specialist.description,
      status: itemStatus(outcomes[id], templateListed(name), unavailable),
      preselected: specialist.preselected,
      skill: skill ? { name: skill.name, summary: SKILL_SUMMARIES[skill.name] ?? skill.description } : undefined,
      create: () => {
        const resource = specialistTemplate(specialist, catalog);
        if (!resource) throw new Error(`This install has no ${specialist.skill} skill.`);
        return apiClient.agentBuildingBlocks.createAgentTemplate({ namespace: NS, name, resource });
      },
    };
  });

  const harnessPresent = isPresent(harnessItem.status);
  const presentSpecialists = SPECIALISTS.filter((_, index) => isPresent(templateItems[index].status));
  const agentBlock = harnessPresent ? undefined : "Agents need the kagent-default harness. Create it in step 1.";

  const agentItems: Item[] = [];
  if (presentSpecialists.length > 0) {
    const id = `agent:${PLATFORM_AGENT}`;
    agentItems.push({
      id,
      step: "agents",
      title: PLATFORM_AGENT,
      description: "The main agent. It passes each question to the specialist that knows the area.",
      status: itemStatus(outcomes[id], agentListed(PLATFORM_AGENT), agentBlock),
      preselected: true,
      create: async () => {
        // Its own template first, as the chart ships it; one already there is used as is.
        if (!templateListed(PLATFORM_AGENT)) {
          try {
            await apiClient.agentBuildingBlocks.createAgentTemplate({
              namespace: NS,
              name: PLATFORM_AGENT,
              resource: platformTemplate(presentSpecialists),
            });
          } catch (error) {
            if ((error as { code?: string }).code !== "AlreadyExists") throw error;
          }
        }
        return apiClient.agentBuildingBlocks.createAgent({
          namespace: NS,
          name: PLATFORM_AGENT,
          resource: quickstartAgent(PLATFORM_AGENT, PLATFORM_AGENT),
        });
      },
    });
  }
  for (const specialist of presentSpecialists) {
    const name = agentName(specialist);
    const id = `agent:${name}`;
    agentItems.push({
      id,
      step: "agents",
      title: name,
      description: `Uses ${templateName(specialist)} on the kagent-default harness.`,
      status: itemStatus(outcomes[id], agentListed(name), agentBlock),
      preselected: false,
      create: () =>
        apiClient.agentBuildingBlocks.createAgent({
          namespace: NS,
          name,
          resource: quickstartAgent(name, templateName(specialist)),
        }),
    });
  }

  const steps: { key: StepKey; items: Item[] }[] = [
    { key: "harness", items: [harnessItem] },
    { key: "templates", items: templateItems },
    { key: "agents", items: agentItems },
  ];
  const isChosen = (item: Item) => chosen[item.id] ?? item.preselected;
  const current = steps[step] as (typeof steps)[number] | undefined;
  const toCreate = current?.items.filter((item) => isChosen(item) && isPending(item.status)) ?? [];
  const working = busy.length > 0;

  async function create(items: Item[]): Promise<boolean> {
    setBusy(items.map((item) => item.id));
    const results = await createEach(items, (item) => item.create(), (id, outcome) => {
      setOutcomes((previous) => ({ ...previous, [id]: outcome }));
      setBusy((previous) => previous.filter((entry) => entry !== id));
    });
    setBusy([]);
    // Refreshes these lists and any others on screen. Guarded, not load-bearing.
    await Promise.all([invalidateHarnesses(), invalidateTemplates(), invalidateAgents()]).catch(() => {});
    return Object.values(results).every((outcome) => outcome.state !== "failed");
  }

  async function createAndOpen() {
    const ok = await create(toCreate);
    // A failure keeps the reader here to see it; only a clean run moves on.
    if (!ok) return;
    const target = agentItems.find((item) => isChosen(item));
    if (target) void navigate(buildPath(paths.agent, { namespace: NS, name: target.title }));
  }

  const stepOutcomes = (key: StepKey) =>
    steps.find((entry) => entry.key === key)!.items.flatMap((item) => (outcomes[item.id] ? [outcomes[item.id]] : []));

  return (
    <PageFrame
      title="Quickstart"
      description="Three steps to a working agent. Pick what you want and kagent creates it."
      actions={
        <InstantButtons>
          <Button icon={<ArrowLeft size={14} aria-hidden />} data-testid="quickstart-back" onClick={() => void navigate(paths.agents)}>
            Back to agents
          </Button>
        </InstantButtons>
      }
    >
      <InstantButtons>
        <div data-testid="quickstart" css={{ display: "grid", gap: theme.space(5), minWidth: 0 }}>
          <Steps
            data-testid="quickstart-steps"
            current={step}
            size="small"
            responsive={false}
            css={{ ".ant-steps-item-title": { whiteSpace: "nowrap" }, "& *": { transition: "none !important" } }}
            items={[
              { title: "Harness" },
              { title: "Templates" },
              { title: "Agents" },
            ]}
          />

          {failed ? (
            <ReadError
              resource="what already exists in the kagent namespace"
              error={failed}
              testId="quickstart-error"
              onRetry={async () => {
                await Promise.all(reads.map((read) => read.refresh()));
              }}
            />
          ) : !loaded ? (
            <Panel theme={theme} testId="quickstart-loading">
              <Skeleton active paragraph={{ rows: 5 }} />
            </Panel>
          ) : step === 0 ? (
            <StepPanel
              theme={theme}
              testId="quickstart-step-harness"
              icon={Container}
              title="Create example kagent Harness"
              help="A harness decides how and where an agent runs."
            >
              <ItemList items={[harnessItem]} isChosen={isChosen} busy={busy} disabled={working} onToggle={(id, value) => setChosen((prev) => ({ ...prev, [id]: value }))} />
              {working ? null : <Results outcomes={stepOutcomes("harness")} />}
            </StepPanel>
          ) : step === 1 ? (
            <StepPanel
              theme={theme}
              testId="quickstart-step-templates"
              icon={LayoutTemplate}
              title="Create example Agent Templates"
              help="A template sets what an agent can do: its model, prompt, tools and skills."
            >
              {dismissed.info ? null : <TemplateInfo theme={theme} onClose={() => dismiss("info")} />}
              {catalog || dismissed.noSkills ? null : (
                <Alert
                  type="info"
                  showIcon
                  closable={{ "aria-label": "Dismiss", onClose: () => dismiss("noSkills") }}
                  data-testid="quickstart-no-skills"
                  title="Built-in skills are off on this install."
                  description={
                    <>
                      The templates are created without them. To add skills, set <code>examples.enabled</code> in
                      the Helm chart. See the{" "}
                      <a href={DOCS_URL} target="_blank" rel="noreferrer" css={inlineLink(theme)}>docs</a>.
                    </>
                  }
                />
              )}
              {modelMissing ? (
                <Alert
                  type="warning"
                  showIcon
                  data-testid="quickstart-model-missing"
                  title={
                    <>
                      Create a model named <code>{DEFAULT_MODEL_CONFIG}</code>. The templates use it, and none exists yet.
                    </>
                  }
                  description={<Link to={paths.modelNew} css={inlineLink(theme)} data-testid="quickstart-add-model">Add a model</Link>}
                />
              ) : modelReadFailed ? (
                <ReadError resource="the default model" error={modelReadFailed} testId="quickstart-model-error" onRetry={model.refresh} />
              ) : null}
              <ItemList items={templateItems} isChosen={isChosen} busy={busy} disabled={working} onToggle={(id, value) => setChosen((prev) => ({ ...prev, [id]: value }))} />
              {working ? null : <Results outcomes={stepOutcomes("templates")} />}
            </StepPanel>
          ) : (
            <StepPanel
              theme={theme}
              testId="quickstart-step-agents"
              icon={Bot}
              title="Create example Agents"
              help="An agent is one template running on one harness."
            >
              {agentItems.length === 0 ? (
                <Alert type="info" showIcon data-testid="quickstart-no-templates" title="Each agent needs a template. Create one in step 2." />
              ) : !harnessPresent ? (
                <Alert type="warning" showIcon data-testid="quickstart-no-harness" title={agentBlock} />
              ) : null}
              <ItemList items={agentItems} isChosen={isChosen} busy={busy} disabled={working} onToggle={(id, value) => setChosen((prev) => ({ ...prev, [id]: value }))} />
              {working ? null : <Results outcomes={stepOutcomes("agents")} />}
            </StepPanel>
          )}

          {loaded && !failed ? (
            <div css={{ display: "flex", flexWrap: "wrap", gap: theme.space(2), justifyContent: "space-between" }}>
              <Button
                icon={<ArrowLeft size={14} aria-hidden />}
                data-testid="quickstart-previous"
                disabled={step === 0 || working}
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
              <Space size={8} wrap>
                {current?.key === "agents" ? (
                  <Button
                    type="primary"
                    data-testid="quickstart-create"
                    loading={working}
                    disabled={!agentItems.some((item) => isChosen(item) && (isPending(item.status) || isPresent(item.status)))}
                    onClick={() => void createAndOpen()}
                  >
                    {toCreate.length > 0 ? "Create agent" : "Go to agent"}
                  </Button>
                ) : current ? (
                  <Button
                    type="primary"
                    data-testid="quickstart-create"
                    loading={working}
                    disabled={toCreate.length === 0}
                    onClick={() => void create(toCreate)}
                  >
                    {createLabel(current.key, toCreate)}
                  </Button>
                ) : null}
                {current && step < steps.length - 1 ? (
                  <Button
                    icon={<ArrowRight size={14} aria-hidden />}
                    iconPlacement="end"
                    data-testid="quickstart-next"
                    disabled={working || toCreate.length > 0}
                    onClick={() => setStep(step + 1)}
                  >
                    Next
                  </Button>
                ) : null}
              </Space>
            </div>
          ) : null}
        </div>
      </InstantButtons>
    </PageFrame>
  );
}

function createLabel(step: StepKey, items: Item[]): string {
  if (items.length > 0 && items.every((item) => item.status.kind === "done")) return "Retry failed";
  if (step === "harness") return "Create harness";
  if (items.length === 0) return "Create templates";
  return items.length === 1 ? "Create 1 template" : `Create ${items.length} templates`;
}

function Panel({ theme, testId, children }: { theme: Theme; testId: string; children: ReactNode }) {
  return (
    <section
      data-testid={testId}
      css={{
        display: "grid",
        gap: theme.space(4),
        padding: theme.space(5),
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.color.border}`,
        background: theme.color.bgElevated,
        minWidth: 0,
      }}
    >
      {children}
    </section>
  );
}

function StepPanel({
  theme,
  testId,
  icon: Icon,
  title,
  help,
  children,
}: {
  theme: Theme;
  testId: string;
  icon: LucideIcon;
  title: string;
  help: string;
  children: ReactNode;
}) {
  return (
    <Panel theme={theme} testId={testId}>
      <div css={{ display: "flex", gap: theme.space(3), alignItems: "center" }}>
        <div
          aria-hidden
          css={{
            display: "grid",
            placeItems: "center",
            flex: "none",
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: `1px solid ${theme.color.accentBorder}`,
            background: theme.color.accentBg,
            color: theme.color.accentText,
          }}
        >
          <Icon size={20} />
        </div>
        <div css={{ minWidth: 0 }}>
          <Title level={4} css={{ margin: 0 }} data-testid="quickstart-step-title">
            {title}
          </Title>
          <Text css={{ color: theme.color.textMuted }}>{help}</Text>
        </div>
      </div>
      {children}
    </Panel>
  );
}

/** Where skills and tools come from, in two lines and two links. */
function TemplateInfo({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const row = (Icon: LucideIcon, label: string, body: ReactNode) => (
    <div css={{ display: "grid", gridTemplateColumns: "20px minmax(0, 1fr)", gap: theme.space(2), alignItems: "start" }}>
      <Icon size={16} aria-hidden css={{ marginTop: 3, color: theme.color.accentText }} />
      <Text>
        <Text strong>{label}</Text> {body}
      </Text>
    </div>
  );
  return (
    <div
      data-testid="quickstart-template-info"
      css={{
        position: "relative",
        display: "grid",
        gap: theme.space(2),
        padding: theme.space(3),
        paddingRight: theme.space(10),
        borderRadius: theme.radius.sm,
        border: `1px solid ${theme.color.border}`,
        background: theme.color.bg,
      }}
    >
      <Button
        type="text"
        size="small"
        aria-label="Dismiss"
        data-testid="quickstart-info-dismiss"
        icon={<X size={14} aria-hidden />}
        onClick={onClose}
        css={{ position: "absolute", top: theme.space(2), right: theme.space(2) }}
      />
      {row(BookOpen, "Skills.", "Skills are instructions an agent loads when a task matches. kagent ships these in the kagent-tools image.")}
      {row(
        Wrench,
        "Tools.",
        <>
          Tools come from the kagent tool server (<code>{TOOL_SERVER}</code>), an MCP server installed with
          kagent-tools. Tools that change the cluster ask you first. See{" "}
          <Link to={paths.mcpServers} css={inlineLink(theme)} data-testid="quickstart-mcp-link">MCP Servers</Link> or the{" "}
          <a href={DOCS_URL} target="_blank" rel="noreferrer" css={inlineLink(theme)} data-testid="quickstart-docs">
            docs
            <ExternalLink size={12} aria-hidden css={{ marginLeft: 3, verticalAlign: "-1px" }} />
          </a>
          .
        </>,
      )}
      {row(Bot, "Model.", <>Each template uses the default model, <code>{DEFAULT_MODEL_CONFIG}</code>.</>)}
    </div>
  );
}

function ItemList({
  items,
  isChosen,
  busy,
  disabled,
  onToggle,
}: {
  items: Item[];
  isChosen: (item: Item) => boolean;
  busy: string[];
  disabled: boolean;
  onToggle: (id: string, value: boolean) => void;
}) {
  return (
    <div css={{ display: "grid", gap: 8 }}>
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          checked={isPending(item.status) && isChosen(item)}
          creating={busy.includes(item.id)}
          disabled={disabled || !isPending(item.status)}
          onToggle={(value) => onToggle(item.id, value)}
        />
      ))}
    </div>
  );
}

function ItemRow({
  item,
  checked,
  creating,
  disabled,
  onToggle,
}: {
  item: Item;
  checked: boolean;
  creating: boolean;
  disabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  const theme = useTheme();
  const { color } = theme;
  const testId = `quickstart-item-${item.title}`;
  const interactive = !disabled;
  return (
    <label
      data-testid={testId}
      data-state={item.status.kind === "done" ? item.status.outcome.state : item.status.kind}
      css={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        columnGap: theme.space(3),
        rowGap: 2,
        alignItems: "start",
        padding: `${theme.space(3)} ${theme.space(4)}`,
        borderRadius: theme.radius.sm,
        border: `1px solid ${color.border}`,
        background: isPending(item.status) ? color.bgElevated : color.bg,
        cursor: interactive ? "pointer" : "default",
        "@media (max-width: 640px)": { gridTemplateColumns: "auto minmax(0, 1fr)" },
        ...(interactive
          ? {
              "&:hover": { background: color.rowHoverBg, borderColor: halfway(color.border, color.borderStrong) },
              "&:active": { background: color.rowPressBg, borderColor: color.borderStrong },
            }
          : {}),
      }}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onChange={(event) => onToggle(event.target.checked)}
        css={{ marginTop: 2 }}
        aria-label={item.title}
      />
      <div css={{ minWidth: 0, display: "grid", gap: 2 }}>
        <Text strong css={{ fontFamily: theme.font.mono, fontSize: 13, color: color.text }}>
          {item.title}
        </Text>
        <Text css={{ color: color.textMuted }}>{item.description}</Text>
        {item.skill ? (
          <div css={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 2 }}>
            <Tag css={{ marginInlineEnd: 0 }}>kagent skill</Tag>
            <Text css={{ fontFamily: theme.font.mono, fontSize: 12 }}>{item.skill.name}</Text>
            <Text css={{ color: color.textMuted, fontSize: 12 }}>{item.skill.summary}</Text>
          </div>
        ) : null}
        {item.status.kind === "done" && item.status.outcome.state === "failed" ? (
          <Text css={{ color: color.dangerText, fontSize: 12, wordBreak: "break-word" }} data-testid={`${testId}-error`}>
            {item.status.outcome.message}
          </Text>
        ) : null}
        {item.status.kind === "unavailable" ? (
          <Text css={{ color: color.textMuted, fontSize: 12 }} data-testid={`${testId}-reason`}>
            {item.status.reason}
          </Text>
        ) : null}
      </div>
      <StatusBadge status={item.status} creating={creating} testId={`${testId}-status`} />
    </label>
  );
}

/** State as icon and text together, never colour alone. */
function StatusBadge({ status, creating, testId }: { status: ItemStatus; creating: boolean; testId: string }) {
  const { color } = useTheme();
  const badge = (Icon: LucideIcon, text: string, ink: string) => (
    <span
      data-testid={testId}
      css={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
        fontSize: 13,
        color: ink,
        gridColumn: "auto",
        "@media (max-width: 640px)": { gridColumn: "2" },
      }}
    >
      <Icon size={15} aria-hidden />
      {text}
    </span>
  );
  if (creating) return badge(LoaderCircle, "Creating", color.textMuted);
  if (status.kind === "exists") return badge(CircleCheck, "Already exists", color.textMuted);
  if (status.kind === "unavailable") return badge(Ban, "Not available", color.textMuted);
  if (status.kind === "done") {
    if (status.outcome.state === "created") return badge(CircleCheck, "Created", color.successText);
    if (status.outcome.state === "exists") return badge(CircleCheck, "Already exists", color.textMuted);
    return badge(CircleX, "Could not create", color.dangerText);
  }
  return <span data-testid={testId} />;
}

/** The step's last run: how many failed, and why when it was a refusal. */
function Results({ outcomes }: { outcomes: CreateOutcome[] }) {
  const failures = outcomes.filter((outcome) => outcome.state === "failed");
  if (failures.length === 0) return null;
  const denied = failures.some((outcome) => outcome.state === "failed" && outcome.denied);
  const summary = failures.length === outcomes.length
    ? failures.length === 1 ? "It could not be created." : `None of the ${outcomes.length} could be created.`
    : `${failures.length} of ${outcomes.length} failed. The rest were created.`;
  return (
    <Alert
      type={denied ? "warning" : "error"}
      showIcon
      data-testid={denied ? "quickstart-denied" : "quickstart-failures"}
      title={denied ? "Your account can read these resources but not create them. Ask an admin for write access." : summary}
      description={denied ? summary : "The error is on each item. Retry to send only the failed ones again."}
    />
  );
}

