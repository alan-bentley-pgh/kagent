import {
  apiClient, useAgentsAcrossNamespaces,
  useHarnessesAcrossNamespaces,
  useInvalidateAgentTemplates,
  useNamespaces,
  type Harness,
} from "@/api";
import { isPermissionDenied } from "@/api/ApiError";
import { ReadError } from "@/components/common/ReadError";
import { copyPath } from "@/components/table/copyFrom";
import { FilterBar } from "@/components/table/FilterBar";
import { matchesQuery } from "@/components/table/listTable";
import { RefreshButton } from "@/components/table/RefreshButton";
import { RowActionsMenu } from "@/components/table/RowActionsMenu";
import { useListView } from "@/components/table/useListView";
import { buildPath, paths } from "@/router/routes";
import { useTheme } from "@emotion/react";
import { Skeleton, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Container } from "lucide-react";
import { useMemo } from "react";
import { QuickstartEmptyState } from "./QuickstartEmptyState";

/** The filters this tab offers, which `useListView` keeps in the URL. */
const FILTER_IDS = ["ns"] as const;


function describeLoss(count: number): string {
  return `${count} Agent(s) directly reference this Harness. They cannot prepare updated configuration until it is restored or replaced. Their last successful revisions and existing conversations are retained.`;
}

const { Text } = Typography;


export function HarnessesTab() {
  const theme = useTheme();
  const namespaces = useNamespaces();
  const namespaceDenied = isPermissionDenied(namespaces.error);
  const harnesses = useHarnessesAcrossNamespaces(namespaceDenied ? null : namespaces.data?.map((row) => row.name));

  const namespaceFailure = namespaceDenied ? undefined : namespaces.error;
  const loadFailure = namespaceFailure ?? harnesses.error;

  const view = useListView(FILTER_IDS);
  const selectedNamespaces = view.selected("ns");

  const rows = harnesses.data ?? [];
  // Only a successful, unfiltered read can say there are none. With no namespaces to read
  // the read never starts, and the namespace list alone answers.
  const listed = harnesses.data !== undefined || (!namespaceDenied && namespaces.data?.length === 0);
  const showEmpty = !loadFailure && listed && !view.isNarrowed && rows.length === 0;
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            selectedNamespaces.length === 0 || selectedNamespaces.includes(row.namespace),
        )
        .filter((row) =>
          matchesQuery(view.query, [
            row.name,
            row.namespace,
            row.runtime,
            row.workloadImage,
          ]),
        ),
    [rows, selectedNamespaces, view.query],
  );


  const agents = useAgentsAcrossNamespaces(namespaceDenied ? null : namespaces.data?.map(row => row.name));
  const referenced = (harness: Harness) => (agents.data?.agents ?? []).filter(agent =>
    agent.namespace === harness.namespace && agent.resource.spec.harnessRef.name === harness.name);

  const invalidateTemplates = useInvalidateAgentTemplates();

  const columns: ColumnsType<Harness> = [
    {
      title: "Harness",
      dataIndex: "name",
      key: "name",
      render: (_: unknown, row: Harness) => (
        <Space orientation="vertical" size={0}>
          <Text css={{ fontFamily: theme.font.mono }}>{row.name}</Text>
          <Text css={{ color: theme.color.textMuted, fontSize: 12 }}>{row.namespace}</Text>
        </Space>
      ),
    },
    {
      title: "Runtime",
      dataIndex: "runtime",
      key: "runtime",
      render: (runtime: string) => <Tag>{runtime || "Not reported"}</Tag>,
    },
    {
      title: "Workload image",
      dataIndex: "workloadImage",
      key: "workloadImage",
      render: (image: string) => (
        <Text
          ellipsis={{ tooltip: image }}
          copyable={image ? { text: image } : false}
          css={{ fontFamily: theme.font.mono, fontSize: 11, maxWidth: 260 }}
        >
          {image || "Release default"}
        </Text>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 56,
      render: (_: unknown, row: Harness) => (
        <RowActionsMenu
          kind="harness"
          namespace={row.namespace}
          name={row.name}
          editTo={buildPath(paths.harnessEdit, { namespace: row.namespace, name: row.name })}
          copyTo={copyPath(paths.harnessNew, row)}
          remove={{
            onDelete: () => apiClient.agentBuildingBlocks.removeHarness(row.namespace, row.name),
            onDeleted: async () => {
              await Promise.allSettled([harnesses.refresh(), invalidateTemplates()]);
            },
            description: agents.error || !agents.data || agents.data.refused.length ? "Could not determine every Agent using this Harness. Existing revisions are retained; Agents using it cannot prepare updated configuration." : describeLoss(referenced(row).length),
          }}
        />
      ),
    },
  ];

  const refreshThisTab = harnesses.refresh;

  return (
    <Space orientation="vertical" size="middle" css={{ display: "flex" }}>

      <FilterBar
        testId="harnesses-filters"
        view={view}
        search={{
          label: "Search harnesses",
          placeholder: "Search names, runtimes and images",
        }}
        filters={[
          {
            id: "ns",
            label: "Namespace",
            allLabel: "All namespaces",
            options: (namespaceDenied ? [...new Set(rows.map((row) => row.namespace))] : (namespaces.data ?? []).map((row) => row.name)).map((value) => ({ value })),
          },
        ]}
        trailing={
          <Space size={8}>
            {!loadFailure && !harnesses.isLoading ? (
              <Text data-testid="harnesses-summary" css={{ color: theme.color.textMuted }}>
                {filtered.length} of {rows.length}{" "}
                {rows.length === 1 ? "harness" : "harnesses"}
              </Text>
            ) : null}
            {/* Beside the controls that narrow this list, and it refreshes this list:
                a control in a table's own filter row that quietly re-read two other
                tabs would be doing more than it appears to. */}
            <RefreshButton onRefresh={refreshThisTab} what="Harnesses" iconOnly />
          </Space>
        }
      />

      {loadFailure ? (
        <ReadError
          resource="harnesses"
          error={loadFailure}
          testId="harnesses-error"
          onRetry={namespaceFailure ? namespaces.refresh : harnesses.refresh}
        />
      ) : null}

      {namespaces.isLoading || harnesses.isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} data-testid="harnesses-loading" />
      ) : showEmpty ? (
        <QuickstartEmptyState
          testId="harnesses-empty"
          icon={Container}
          title="No harnesses yet"
          description="Create example harnesses with the Quickstart."
        />
      ) : (
        <Table<Harness>
          data-testid="harnesses-table"
          rowKey={(row) => row.ref}
          columns={columns}
          dataSource={loadFailure ? [] : filtered}
          locale={{
            emptyText: loadFailure || !view.isNarrowed ? " " : "No harnesses match those filters.",
          }}
          pagination={false}
          size="small"
        />
      )}
    </Space>
  );
}
