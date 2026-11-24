import { test, expect } from "../fixtures/test";
import { expectSettled, loadPage, routes } from "../helpers/app";
import { operationCalls, rpc } from "../helpers/mockCalls";
import { clickRefresh } from "../helpers/resource";

/**
 * The dashboard's recent list, which is conversations and now reads like it.
 *
 * The card was headed "Recently created agents" and listed `AgentInstance` rows, which
 * are conversations rather than agents — so the heading was wrong about what it held.
 * The rows were worse: each linked to a conversation under a bare eight-character id,
 * on the reasoning that "an agent has no name". A conversation does have one, and this
 * is the third surface to show it after the rail and the agent's own table.
 */
test("dashboard: recent conversations read as names, not as ids", async ({ page }) => {
  await loadPage(page, routes.dashboard);
  await expectSettled(page);

  const card = page.getByTestId("dashboard-recent-card");
  await expect(card).toBeVisible({ timeout: 30_000 });

  await test.step("1. the card says what it lists", async () => {
    await expect(card).toContainText("Recent agent chat sessions");

    // And Refresh confirms here too — wired up on the page being worked on and
    // forgotten on the four beside it is exactly how this goes wrong. Counted rather
    // than read off the toast, which lives two seconds.
    const before = await operationCalls(page, rpc.listAgentInstances);
    await clickRefresh(page);
    await expect
      .poll(() => operationCalls(page, rpc.listAgentInstances), { timeout: 10_000 })
      .toBeGreaterThan(before);
  });

  await test.step("2. and no row is a bare id", async () => {
    /*
     * The property, rather than a fixture's particular name.
     *
     * `conversationTitle` answers with the name somebody gave it, the title derived
     * from its first message, or "Untitled" beside the short id — never the short id
     * alone. So a link whose whole text is eight hex characters is the old behaviour,
     * whichever conversation happens to be recent enough to appear here.
     */
    const rows = page.getByTestId("recent-agent");
    await expect(rows.first()).toBeVisible();
    const labels = await rows.locator("a").evaluateAll((links) =>
      links.map((link) => link.textContent?.trim() ?? ""),
    );

    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label, "a conversation should be listed by name, not by its id").not.toMatch(
        /^[0-9a-f]{8}$/,
      );
    }
  });

  await test.step("3. and a conversation somebody named shows that name", async () => {
    // The other half: "not an id" would also be satisfied by every row reading
    // "Untitled", which is true and useless. At least one of the fixtures' recent
    // conversations carries a name its reader chose.
    const labels = await page
      .getByTestId("recent-agent")
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.textContent?.trim() ?? ""));

    expect(
      labels.some((label) => label !== "" && !label.startsWith("Untitled")),
      `at least one recent conversation should read as a chosen name; got ${JSON.stringify(labels)}`,
    ).toBe(true);
  });
});

/**
 * An install with nothing in it: the dashboard swaps its figures for the Quickstart and
 * the pages to start from. A failed load keeps the figures and the error instead.
 */
test("dashboard: an empty install leads to the Quickstart, and a failed one does not", async ({ page }) => {
  await loadPage(page, routes.dashboard, { scenario: "empty", title: "Dashboard" });
  const gettingStarted = page.getByTestId("dashboard-getting-started");

  await test.step("1. the figures give way to the getting-started view", async () => {
    await expect(gettingStarted).toBeVisible();
    await expect(page.getByTestId("dashboard-summary-grid")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-header-quickstart")).toHaveCount(0);
    await expect(gettingStarted.getByRole("link")).toHaveCount(7);
    // The same docs page the sidebar links to.
    const docs = await page.getByTestId("sidebar-docs").getAttribute("href");
    await expect(page.getByTestId("dashboard-docs")).toHaveAttribute("href", docs!);
  });

  await test.step("2. View Quickstart opens the Quickstart", async () => {
    await page.getByTestId("dashboard-quickstart").click();
    await expect(page).toHaveURL(/\/quickstart$/);
    await expect(page.getByTestId("quickstart")).toBeVisible();
    await expect(page.getByTestId("quickstart-step-harness")).toBeVisible();
  });

  await test.step("3. going back returns to the same view", async () => {
    await page.goBack();
    await expect(gettingStarted).toBeVisible();
  });

  await test.step("4. a card opens its page", async () => {
    await page.getByTestId("dashboard-card-models").click();
    await expect(page).toHaveURL(/\/models$/);
    await expect(page.getByTestId("page-title")).toHaveText("Models");
  });

  await test.step("5. a failed load shows the error, not the getting-started view", async () => {
    await loadPage(page, routes.dashboard, { scenario: "error", title: "Dashboard" });
    await expect(page.getByTestId("dashboard-error")).toBeVisible();
    await expect(page.getByTestId("dashboard-summary-grid")).toBeVisible();
    await expect(gettingStarted).toHaveCount(0);
  });
});

// The tile counts Agent resources, so it matches the Agents page, not the conversation count.
test("dashboard: the Agents tile matches the Agents page", async ({ page }) => {
  await loadPage(page, routes.agents, { title: "Agents" });
  const summaryText = page.getByTestId("agents-summary");
  await expect(summaryText).toHaveText(/of [1-9]\d* agents/);
  const summary = await summaryText.textContent();
  const total = summary?.match(/of (\d+) agents/)?.[1];
  expect(total, `unexpected summary ${JSON.stringify(summary)}`).toBeDefined();

  await loadPage(page, routes.dashboard);
  await expectSettled(page);
  await expect(page.getByTestId("stat-agents-value")).toHaveText(total!);
  // A populated dashboard keeps a way to the Quickstart in its header.
  await page.getByTestId("dashboard-header-quickstart").click();
  await expect(page).toHaveURL(/\/quickstart$/);
});
