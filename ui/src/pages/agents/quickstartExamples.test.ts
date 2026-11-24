import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/ApiError";
import type { BuiltinSkillsCatalog } from "@/api/runtimeConfig";
import {
  createEach,
  isPending,
  isPresent,
  itemStatus,
  outcomeOfError,
  platformTemplate,
  quickstartAgent,
  quickstartHarness,
  SPECIALISTS,
  specialistTemplate,
  specialistUnavailable,
} from "./quickstartExamples";

const catalog: BuiltinSkillsCatalog = {
  image: "ghcr.io/kagent-dev/kagent/tools@sha256:abc",
  skills: SPECIALISTS.filter((entry) => entry.key !== "prometheus").map((entry) => ({
    name: entry.skill,
    description: "",
    path: `opt/kagent-tools-skills/skills/${entry.skill}`,
  })),
};
const byKey = (key: string) => SPECIALISTS.find((entry) => entry.key === key)!;
const apiError = (code: string, status: number) =>
  new ApiError(`${code} happened`, { kind: "http", url: "rpc", code, status });

describe("quickstart resources", () => {
  it("builds the chart's kagent-default harness", () => {
    expect(quickstartHarness()).toEqual({
      metadata: { name: "kagent-default", namespace: "kagent" },
      spec: {
        kagent: {},
        substrate: { workerPoolRef: { name: "kagent-default" }, snapshotPolicy: { location: "s3://ate-snapshots/kagent/" } },
      },
    });
  });

  it("builds a specialist template with its skill, read tools and approval-gated write tools", () => {
    const helm = specialistTemplate(byKey("helm"), catalog)!;
    expect(helm.metadata).toEqual({ name: "platform-helm", namespace: "kagent" });
    expect(helm.spec.modelConfig).toEqual({ name: "default-model-config" });
    expect(helm.spec.skills).toEqual([
      { name: "helm-release-management", source: { oci: catalog.image, path: "opt/kagent-tools-skills/skills/helm-release-management" } },
    ]);
    expect(helm.spec.tools).toEqual([
      { mcp: { server: { kind: "RemoteMCPServer", name: "kagent-tool-server" }, tools: ["helm_get_release", "helm_list_releases"] } },
      {
        mcp: {
          server: { kind: "RemoteMCPServer", name: "kagent-tool-server" },
          requireApproval: true,
          tools: ["helm_repo_add", "helm_repo_update", "helm_uninstall", "helm_upgrade"],
        },
      },
    ]);
    expect(helm.spec.systemPrompt).toContain("Load your skill and follow it.");
  });

  it("leaves out the approval binding when a specialist has no write tools", () => {
    expect(specialistTemplate(byKey("kubescape"), catalog)!.spec.tools).toHaveLength(1);
  });

  it("offers a specialist only when a present catalog has its skill", () => {
    expect(specialistTemplate(byKey("prometheus"), catalog)).toBeUndefined();
    expect(specialistUnavailable(byKey("prometheus"), catalog)).toBe("Needs a Prometheus URL in kagent-tools.");
    expect(specialistUnavailable(byKey("helm"), catalog)).toBeUndefined();
  });

  it("with skills off, offers every specialist and builds it without skills", () => {
    for (const specialist of SPECIALISTS) {
      expect(specialistUnavailable(specialist, undefined)).toBeUndefined();
      const template = specialistTemplate(specialist, undefined)!;
      expect(template.spec).not.toHaveProperty("skills");
      expect(template.spec.tools).toEqual(specialistTemplate(specialist, { ...catalog, skills: [...catalog.skills, {
        name: specialist.skill, description: "", path: "p" }] })!.spec.tools);
      expect(template.spec.systemPrompt).toBe(specialist.systemPrompt);
    }
  });

  it("builds the platform template with one sub-agent per specialist, named as the chart does", () => {
    const platform = platformTemplate([byKey("kubernetes"), byKey("istio"), byKey("kubescape")]);
    expect(platform.spec.description).toBe("Platform assistant: sends Kubernetes, Istio and security questions to a specialist.");
    expect(platform.spec.tools?.map((tool) => tool.subAgent?.templateRef.name)).toEqual([
      "platform-kubernetes",
      "platform-istio",
      "platform-kubescape",
    ]);
  });

  it("builds an agent that references its template and the kagent-default harness", () => {
    expect(quickstartAgent("helm-agent", "platform-helm").spec).toEqual({
      template: { ref: { name: "platform-helm" } },
      harnessRef: { name: "kagent-default" },
    });
  });
});

describe("quickstart create decisions", () => {
  it("treats AlreadyExists as skipped and keeps the real message of a failure", () => {
    expect(outcomeOfError(apiError("AlreadyExists", 409))).toEqual({ state: "exists" });
    expect(outcomeOfError(apiError("PermissionDenied", 403))).toEqual({
      state: "failed",
      message: "PermissionDenied happened",
      denied: true,
    });
    expect(outcomeOfError(new Error("boom"))).toEqual({ state: "failed", message: "boom", denied: false });
  });

  it("creates every item even after a failure, and reports each", async () => {
    const seen: string[] = [];
    const outcomes = await createEach(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      async (item) => {
        if (item.id === "b") throw new Error("no");
        if (item.id === "c") throw apiError("AlreadyExists", 409);
      },
      (id) => seen.push(id),
    );
    expect(seen).toEqual(["a", "b", "c"]);
    expect(outcomes).toEqual({
      a: { state: "created" },
      b: { state: "failed", message: "no", denied: false },
      c: { state: "exists" },
    });
  });

  it("prefers this session's result over the list, and skips what exists", () => {
    const created = itemStatus({ state: "created" }, true);
    expect(created).toEqual({ kind: "done", outcome: { state: "created" } });
    expect(isPresent(created)).toBe(true);
    expect(isPending(created)).toBe(false);

    const listed = itemStatus(undefined, true, "Needs the default model.");
    expect(listed).toEqual({ kind: "exists" });
    expect(isPending(listed)).toBe(false);

    expect(itemStatus(undefined, false, "Needs the default model.")).toEqual({
      kind: "unavailable",
      reason: "Needs the default model.",
    });

    const failed = itemStatus({ state: "failed", message: "no", denied: false }, false);
    expect(isPending(failed)).toBe(true);
    expect(isPresent(failed)).toBe(false);
    expect(isPending(itemStatus(undefined, false))).toBe(true);
  });
});
