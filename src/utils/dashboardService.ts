export interface RawDashboardTile {
  key: string;
  i: string;
  index?: 0 | 1;
  h: number;
  w: number;
  x: number;
  y: number;
  query: string;
  title: string;
  dataConfig: any;
  displayType: string;
  skipQueryValidation: boolean;
  queryResponse?: any;
  secondQueryResponse?: any;
}

export interface RawDashboard {
  id: string;
  source: string;
  version: string;
  exportDate: string;
  dashboard: {
    title: string;
    props: Record<string, any>;
    tiles: RawDashboardTile[];
  };
}

const API_BASE_URL = "https://backend.chata.io/public/api/v1";

const buildHeaders = (): HeadersInit => ({
  Accept: "application/json",
  "X-API-Key": import.meta.env.VITE_DASHBOARD_API_KEY as string,
});

// Response is { data: { [dashboardId]: RawDashboard, ... } }
const extractItems = (body: any): RawDashboard[] => {
  if (
    body?.data &&
    typeof body.data === "object" &&
    !Array.isArray(body.data)
  ) {
    return Object.values(body.data);
  }
  if (Array.isArray(body?.data?.dashboards)) return body.data.dashboards;
  if (Array.isArray(body?.dashboards)) return body.dashboards;
  if (Array.isArray(body)) return body;
  return [];
};

export const fetchDashboards = async (): Promise<RawDashboard[]> => {
  const response = await fetch(`${API_BASE_URL}/dashboards`, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboards: ${response.statusText}`);
  }

  const body = await response.json().catch(() => null);
  return extractItems(body);
};

// Fetches query response data for a single tile.
// index=0 → queryResponse, index=1 → secondQueryResponse
// Returns an axios-shaped response ({ data: ... }) since react-autoql expects that format.
export const fetchTileData = async (
  dashboardId: string,
  tileKey: string,
  index: 0 | 1,
): Promise<any> => {
  const url = `${API_BASE_URL}/dashboards/${dashboardId}/tiles/${tileKey}/query?index=${index}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch tile data (${dashboardId}/${tileKey}?index=${index}): ${response.statusText}`,
    );
  }

  const body = await response.json();
  return { data: body.query_response };
};
