import { applyNavOverrides, useExtensionNavOverrides } from "@/appExtensions";
import { inlineLink } from "@/components/common/linkStyles";
import { coreNavItems, DOCS_URL } from "@/components/Structure/navItems";
import { QuickstartButton } from "@/pages/agents/QuickstartEmptyState";
import { useTheme } from "@emotion/react";
import { Typography } from "antd";
import { ExternalLink, Rocket } from "lucide-react";
import { Link } from "react-router-dom";

/** One line per page worth starting from, keyed by its sidebar entry. */
const CARD_LINES = {
  agents: "Make an agent and chat with it",
  scheduledRuns: "Run agents at set times",
  models: "Add the models your agents use",
  mcpServers: "Add tools for your agents",
  policies: "Limit what agents can reach",
  prompts: "Keep prompts in one place",
} as const;

/**
 * The dashboard of an install with nothing in it: the Quickstart first, then the pages to
 * start from. Cards follow the sidebar, so an entry an extension hides is not offered here.
 */
export function GettingStarted() {
  const theme = useTheme();
  const { color } = theme;
  const cards = applyNavOverrides(coreNavItems, useExtensionNavOverrides()).filter(
    (item) => item.key in CARD_LINES,
  );

  return (
    <div
      data-testid="dashboard-getting-started"
      css={{
        display: "grid",
        justifyItems: "center",
        gap: theme.space(8),
        maxWidth: 960,
        margin: "0 auto",
        paddingBlock: theme.space(6),
        textAlign: "center",
      }}
    >
      <div css={{ display: "grid", justifyItems: "center", gap: theme.space(3) }}>
        <div
          aria-hidden
          css={{
            display: "grid",
            placeItems: "center",
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: `1px solid ${color.accentBorder}`,
            background: color.accentBg,
            color: color.accentText,
          }}
        >
          <Rocket size={30} />
        </div>
        <Typography.Title level={2} css={{ margin: 0 }}>
          No agents yet
        </Typography.Title>
        <Typography.Text css={{ color: color.textMuted, fontSize: 16 }}>
          Start with the Quickstart, or see what kagent can do.
        </Typography.Text>
        <div css={{ marginTop: theme.space(3) }}>
          <QuickstartButton primary large testId="dashboard-quickstart" />
        </div>
      </div>

      <section aria-labelledby="dashboard-next" css={{ display: "grid", gap: theme.space(3), width: "100%" }}>
        <Typography.Title id="dashboard-next" level={5} css={{ margin: 0, color: color.textMuted }}>
          Where to go next
        </Typography.Title>
        <ul
          css={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: theme.space(4),
            listStyle: "none",
            margin: 0,
            padding: 0,
            textAlign: "left",
          }}
        >
          {cards.map(({ key, label, path, icon: Icon }) => (
            <li key={key} css={{ display: "grid" }}>
              <Link
                to={path}
                data-testid={`dashboard-card-${key}`}
                css={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  alignItems: "center",
                  gap: theme.space(3),
                  padding: theme.space(4),
                  borderRadius: theme.radius.md,
                  border: `1px solid ${color.border}`,
                  backgroundColor: color.bgElevated,
                  color: color.text,
                  transition: "none",
                  // Hover is the press tint at half strength; neither changes the card's size.
                  "&:hover": {
                    color: color.text,
                    borderColor: `${color.primary}53`,
                    backgroundImage: `linear-gradient(${color.rowHoverBg}, ${color.rowHoverBg})`,
                  },
                  "&:active": {
                    color: color.text,
                    borderColor: `${color.primary}A6`,
                    backgroundImage: `linear-gradient(${color.rowPressBg}, ${color.rowPressBg})`,
                  },
                  "&:focus-visible": { outline: `2px solid ${color.primaryText}`, outlineOffset: 2 },
                }}
              >
                <span
                  aria-hidden
                  css={{
                    display: "grid",
                    placeItems: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: `1px solid ${color.accentBorder}`,
                    background: color.accentBg,
                    color: color.accentText,
                  }}
                >
                  <Icon size={20} />
                </span>
                <span css={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <span css={{ fontWeight: 600 }}>{label}</span>
                  <span css={{ color: color.textMuted, fontSize: 13 }}>
                    {CARD_LINES[key as keyof typeof CARD_LINES]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <a
        href={DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="dashboard-docs"
        aria-label="Read the docs (opens in a new tab)"
        css={{ ...inlineLink(theme), display: "inline-flex", alignItems: "center", gap: theme.space(1) }}
      >
        Read the docs
        <ExternalLink size={14} aria-hidden />
      </a>
    </div>
  );
}
