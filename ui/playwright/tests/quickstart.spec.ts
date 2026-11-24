import { expect, test } from "../fixtures/test";
import { loadPage, rowNamed } from "../helpers/app";
import { clickNav } from "../helpers/nav";
import { LIFECYCLE_TIMEOUT } from "../helpers/resource";
import type { Page } from "@playwright/test";

/**
 * The Quickstart wizard creates the chart's example harness, templates and agents. The
 * mock backend records each create, so the lists afterwards can contradict the wizard.
 */
test.describe.configure({ timeout: LIFECYCLE_TIMEOUT });

const item = (page: Page, name: string) => page.getByTestId(`quickstart-item-${name}`);
const status = (page: Page, name: string) => page.getByTestId(`quickstart-item-${name}-status`);

test("quickstart: a fresh install gets example templates and agents, and lands on the agent", async ({ page }) => {
  await loadPage(page, "/quickstart", { scenario: "fresh", title: "Quickstart" });

  await test.step("1. the chart's harness is already there, so the step skips it", async () => {
    await expect(page.getByTestId("quickstart-step-harness")).toBeVisible();
    await expect(status(page, "kagent-default")).toHaveText("Already exists");
    await expect(item(page, "kagent-default").getByRole("checkbox")).toBeDisabled();
    await expect(page.getByTestId("quickstart-create")).toBeDisabled();
    await page.getByTestId("quickstart-next").click();
  });

  await test.step("2. with skills off, every specialist is offered without one, four picked", async () => {
    await expect(page.getByTestId("quickstart-step-templates")).toBeVisible();
    await expect(page.getByTestId("quickstart-template-info")).toContainText("kagent-tool-server");
    await expect(page.getByTestId("quickstart-no-skills")).toBeVisible();
    await expect(item(page, "platform-helm")).not.toContainText("helm-release-management");
    await expect(item(page, "platform-kubescape").getByRole("checkbox")).not.toBeChecked();
    await expect(item(page, "platform-prometheus")).toHaveAttribute("data-state", "new");
    await expect(item(page, "platform-prometheus").getByRole("checkbox")).not.toBeChecked();
    // Next waits until the picked templates exist or are unpicked.
    await expect(page.getByTestId("quickstart-next")).toBeDisabled();
    await expect(page.getByTestId("quickstart-create")).toHaveText("Create 4 templates");
  });

  await test.step("2b. the banners close and leave the templates alone", async () => {
    await page.getByTestId("quickstart-info-dismiss").click();
    await expect(page.getByTestId("quickstart-template-info")).toHaveCount(0);
    await page.getByTestId("quickstart-no-skills").getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByTestId("quickstart-no-skills")).toHaveCount(0);
    await expect(page.getByTestId("quickstart-create")).toHaveText("Create 4 templates");
  });

  await test.step("3. creating them reports each one", async () => {
    await page.getByTestId("quickstart-create").click();
    for (const name of ["platform-kubernetes", "platform-helm", "platform-istio", "platform-argo-rollouts"]) {
      await expect(status(page, name)).toHaveText("Created");
    }
    await expect(item(page, "platform-kubescape")).toHaveAttribute("data-state", "new");
    await expect(page.getByTestId("quickstart-failures")).toHaveCount(0);
    await page.getByTestId("quickstart-next").click();
  });

  await test.step("4. Back keeps what was done, and Next returns", async () => {
    await page.getByTestId("quickstart-previous").click();
    await expect(status(page, "platform-helm")).toHaveText("Created");
    await page.getByTestId("quickstart-next").click();
  });

  await test.step("5. the agents step offers the platform agent and one per template", async () => {
    await expect(page.getByTestId("quickstart-step-agents")).toBeVisible();
    await expect(item(page, "platform-agent").getByRole("checkbox")).toBeChecked();
    await expect(item(page, "helm-agent")).toBeVisible();
    await expect(item(page, "kubescape-agent")).toHaveCount(0);
    await item(page, "istio-agent").click();
    await expect(item(page, "istio-agent").getByRole("checkbox")).toBeChecked();
  });

  await test.step("6. Create agent lands on the platform agent", async () => {
    await page.getByTestId("quickstart-create").click();
    await expect(page).toHaveURL(/\/agents\/kagent\/platform-agent$/);
  });

  await test.step("7. the agents list holds what the wizard made", async () => {
    await clickNav(page, "agents", /\/agents$/);
    await expect(rowNamed(page, "platform-agent")).toHaveCount(1);
    await expect(rowNamed(page, "istio-agent")).toHaveCount(1);
    await expect(page.getByTestId("agents-table").locator("tbody tr.ant-table-row")).toHaveCount(2);
  });

  await test.step("8. the templates list holds the specialists and the platform template", async () => {
    await page.getByRole("tab", { name: "Templates" }).click();
    for (const name of ["platform-agent", "platform-kubernetes", "platform-helm", "platform-istio", "platform-argo-rollouts"]) {
      await expect(rowNamed(page, name), `${name} is missing`).toHaveCount(1);
    }
    await expect(page.getByTestId("templates-table").locator("tbody tr.ant-table-row")).toHaveCount(5);
  });

  await test.step("9. back in the wizard, everything made shows as already there", async () => {
    await page.getByTestId("agents-quickstart").click();
    await expect(status(page, "kagent-default")).toHaveText("Already exists");
    await page.getByTestId("quickstart-next").click();
    await expect(status(page, "platform-helm")).toHaveText("Already exists");
  });
});

test("quickstart: skills show where attached, and what cannot be created is said", async ({ page }) => {
  await test.step("1. with skills on, each template shows the skill it brings", async () => {
    await loadPage(page, "/quickstart", { scenario: "ok", title: "Quickstart" });
    await page.getByTestId("quickstart-next").click();
    await expect(item(page, "platform-helm")).toContainText("helm-release-management");
    await expect(page.getByTestId("quickstart-no-skills")).toHaveCount(0);
  });

  await test.step("2. an empty install creates the harness, then needs a model for templates", async () => {
    await loadPage(page, "/quickstart", { scenario: "empty", title: "Quickstart" });
    await page.getByTestId("quickstart-create").click();
    await expect(status(page, "kagent-default")).toHaveText("Created");
    await page.getByTestId("quickstart-next").click();
    await expect(page.getByTestId("quickstart-model-missing")).toBeVisible();
    await expect(status(page, "platform-helm")).toHaveText("Not available");
    await expect(page.getByTestId("quickstart-create")).toBeDisabled();
    await expect(page.getByTestId("quickstart-add-model")).toHaveAttribute("href", /\/models\/new$/);
  });

  await test.step("3. a refused create names each failure, and Next waits", async () => {
    await loadPage(page, "/quickstart", { scenario: "denied", title: "Quickstart" });
    await page.getByTestId("quickstart-next").click();
    await page.getByTestId("quickstart-create").click();
    await expect(page.getByTestId("quickstart-denied")).toBeVisible();
    await expect(status(page, "platform-helm")).toHaveText("Could not create");
    await expect(page.getByTestId("quickstart-item-platform-helm-error")).toContainText("Not authorized");
    await expect(page.getByTestId("quickstart-create")).toHaveText("Retry failed");
    await expect(page.getByTestId("quickstart-next")).toBeDisabled();
  });

  await test.step("4. a failed read shows the error, not an empty wizard", async () => {
    await loadPage(page, "/quickstart", { scenario: "error", title: "Quickstart" });
    await expect(page.getByTestId("quickstart-error")).toBeVisible();
    await expect(page.getByTestId("quickstart-create")).toHaveCount(0);
    await expect(page.getByTestId("quickstart-step-harness")).toHaveCount(0);
  });
});
