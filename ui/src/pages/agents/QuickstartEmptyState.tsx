import { Button, ConfigProvider, Typography } from "antd";
import { useTheme } from "@emotion/react";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { paths } from "@/router/routes";

/**
 * Buttons inside get instant hover and press, hover at half the press, and no click
 * wave, which antd's button does not do by default.
 */
export function InstantButtons({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return (
    <ConfigProvider
      wave={{ disabled: true }}
      theme={{
        components: {
          Button: {
            motionDurationMid: "0s",
            // The theme's own fill on both modes, so hover can sit halfway to press.
            colorPrimary: color.primary,
            colorPrimaryHover: `color-mix(in srgb, ${color.primary} 50%, ${color.primaryHover})`,
            colorPrimaryActive: color.primaryHover,
            defaultHoverBg: color.rowHoverBg,
            defaultActiveBg: color.rowPressBg,
            defaultHoverColor: color.text,
            defaultActiveColor: color.text,
            defaultHoverBorderColor: `${color.primary}53`,
            defaultActiveBorderColor: `${color.primary}A6`,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}

/** Opens the Quickstart page. */
export function QuickstartButton({
  primary = false,
  large = false,
  label = "View Quickstart",
  icon,
  testId,
  onNavigate,
}: {
  primary?: boolean;
  /** The page's main action: taller, wider and bolder than antd's large button. */
  large?: boolean;
  label?: string;
  /** Shown before the label; a large button shows an arrow after it instead. */
  icon?: ReactNode;
  testId: string;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <InstantButtons>
      <Button
        type={primary ? "primary" : "default"}
        size={large ? "large" : undefined}
        icon={large ? <ArrowRight size={18} aria-hidden /> : icon}
        iconPlacement={large ? "end" : "start"}
        css={large ? { height: 52, paddingInline: 32, fontSize: 17, fontWeight: 600 } : undefined}
        data-testid={testId}
        onClick={() => {
          onNavigate?.();
          void navigate(paths.quickstart);
        }}
      >
        {label}
      </Button>
    </InstantButtons>
  );
}

/**
 * A tab's empty state, shown only once its list has loaded with nothing in it. A failed
 * or filtered read keeps the table, so this never stands in for an error or a no-match.
 */
export function QuickstartEmptyState({
  testId,
  icon: Icon,
  title,
  description,
}: {
  testId: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  const theme = useTheme();
  return (
    <div
      data-testid={testId}
      css={{
        display: "grid",
        justifyItems: "center",
        gap: theme.space(3),
        padding: `${theme.space(10)} ${theme.space(4)}`,
        textAlign: "center",
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.color.border}`,
        background: theme.color.bgElevated,
      }}
    >
      <div
        aria-hidden
        css={{
          display: "grid",
          placeItems: "center",
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: `1px solid ${theme.color.accentBorder}`,
          background: theme.color.accentBg,
          color: theme.color.accentText,
        }}
      >
        <Icon size={26} />
      </div>
      <div css={{ display: "grid", gap: theme.space(1) }}>
        <Typography.Title level={4} css={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <Typography.Text css={{ color: theme.color.textMuted, maxWidth: 420 }}>{description}</Typography.Text>
      </div>
      <div css={{ marginTop: theme.space(1) }}>
        <QuickstartButton primary testId={`${testId}-quickstart`} />
      </div>
    </div>
  );
}
