import { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useDashboards } from "@/hooks/use-dashboards";

// Don't import react-autoql at module level - it's causing bundling issues
// We'll load it dynamically when needed
let Dashboard: any = null;
let configureTheme: any = null;
let isAutoQLLoaded = false;
import type { RawDashboard, RawDashboardTile } from "@/utils/dashboardService";
import { fetchTileData, fetchDashboards } from "@/utils/dashboardService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
const loadTiles = (dashboardId: string, rawTiles: RawDashboardTile[]) =>
  Promise.allSettled(
    rawTiles.map(async (tile) => {
      const queryIndex: 0 | 1 = tile.index ?? 0;
      const response = await fetchTileData(dashboardId, tile.key, queryIndex);
      const prop = queryIndex === 0 ? "queryResponse" : "secondQueryResponse";
      return { ...tile, [prop]: response };
    })
  ).then((results) =>
    results.map((result, idx) =>
      result.status === "fulfilled" ? result.value : rawTiles[idx]
    )
  );

function DashboardWrapper({ tiles }: { tiles: any[] }) {
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const dashboardRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Load react-autoql dynamically
  useEffect(() => {
    mountedRef.current = true;
    
    if (isAutoQLLoaded) {
      setDashboardLoaded(true);
      return;
    }
    
    let cancelled = false;
    
    import("react-autoql")
      .then((module) => {
        if (cancelled || !mountedRef.current) return;
        
        Dashboard = module.Dashboard || module.default?.Dashboard || module.default;
        configureTheme = module.configureTheme || (module as any).configureTheme;
        
        if (configureTheme) {
          configureTheme({
            theme: "dark",
            fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif",
            textColor: "hsl(0, 0.00%, 100.00%)",
            backgroundColorPrimary: "#030206",
            backgroundColorSecondary: "hsl(225, 25%, 12%)",
            chartColors: [
              "#F3FF97",  // Primary yellow - most important
              "#D5A5E3",  // Accent lilac
              "#5BA3E8",  // Vibrant blue
              "#7BC8C8",  // Bright teal
              "#8FA8B8",  // Sophisticated slate-blue
            ],
          });
        }
        
        isAutoQLLoaded = true;
        if (mountedRef.current) {
          setDashboardLoaded(true);
        }
      })
      .catch((error) => {
        if (!cancelled && mountedRef.current) {
          console.error("Failed to load react-autoql:", error);
          setLoadError(String(error));
        }
      });
    
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);
  
  if (loadError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load Dashboard component: {loadError}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!dashboardLoaded || !Dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-sm text-muted-foreground">Loading Dashboard component...</p>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      id="dashboard-mount-point"
      className="dashboard-container w-full" 
      style={{ 
        width: 'calc(100% + 40px)',
        minWidth: 0,
        marginLeft: '-20px',
        marginRight: '-20px',
      }}
    >
      <Dashboard
        ref={(ref) => {
          dashboardRef.current = ref;
        }}
        tiles={tiles}
        notExecutedText="Queries will not execute in view-only mode"
        offline
        isEditable={false}
      />
    </div>
  );
}

export default function DashboardViewer() {
  const { name } = useParams<{ name: string }>();
  
  const { data: dashboards = [], isLoading: isLoadingDashboards } = useDashboards();

  const dashboardData = useMemo<RawDashboard | null>(() => {
    if (!name || isLoadingDashboards) return null;
    const decodedId = decodeURIComponent(name);
    return dashboards.find((d) => d.id === decodedId) ?? null;
  }, [name, isLoadingDashboards, dashboards]);

  const [tiles, setTiles] = useState<any[]>([]);
  const [isLoadingTiles, setIsLoadingTiles] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportDate, setExportDate] = useState<string | null>(null);

  // Keep exportDate in sync when dashboardData loads or its exportDate changes
  useEffect(() => {
    setExportDate(dashboardData?.exportDate ?? null);
  }, [dashboardData?.exportDate]);

  useEffect(() => {
    const rawTiles = dashboardData?.dashboard?.tiles;
    if (!rawTiles?.length) {
      setTiles([]);
      setIsLoadingTiles(false);
      return;
    }

    let cancelled = false;
    setTiles([]);
    setIsLoadingTiles(true);

    const dashboardId = dashboardData!.id;

    loadTiles(dashboardId, rawTiles).then((resolved) => {
      if (cancelled) return;
      setTiles(resolved);
      setRefreshKey((k) => k + 1);
      setIsLoadingTiles(false);
    });

    return () => {
      cancelled = true;
    };
  }, [dashboardData]);

  // Silent background refresh — fires every 30 minutes
  useEffect(() => {
    const rawTiles = dashboardData?.dashboard?.tiles;
    if (!rawTiles?.length) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const dashboardId = dashboardData!.id;

    const refresh = () => {
      // Refresh exportDate independently — fetching the dashboard list won't affect
      // dashboardData's object identity so it won't retrigger the tile-fetch effect.
      fetchDashboards()
        .then((list) => {
          if (cancelled) return;
          const updated = list.find((d) => d.id === dashboardId);
          if (updated?.exportDate) setExportDate(updated.exportDate);
        })
        .catch((err) => { console.warn("Failed to refresh export date:", err); });

      loadTiles(dashboardId, rawTiles)
        .then((resolved) => {
          if (cancelled) return;
          setTiles(resolved);
          setRefreshKey((k) => k + 1);
          schedule();
        })
        .catch((err) => {
          console.warn("Failed to refresh tile data:", err);
          if (!cancelled) schedule();
        });
    };

    const schedule = () => {
      timeoutId = setTimeout(refresh, 30 * 60 * 1000);
    };

    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [dashboardData]);

  const [shouldRenderDashboard, setShouldRenderDashboard] = useState(false);

  useEffect(() => {
    if (!isLoadingTiles && tiles.length > 0) {
      const timer = setTimeout(() => setShouldRenderDashboard(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShouldRenderDashboard(false);
    }
  }, [isLoadingTiles, tiles]);

  if (isLoadingDashboards || isLoadingTiles) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {isLoadingDashboards ? "Loading dashboards..." : "Loading dashboard data..."}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboardData) {
    return (
      <DashboardLayout>
        <Alert>
          <AlertDescription>No dashboard data available</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{dashboardData.dashboard.title}</h1>
            {/* TODO: wire up refreshed_at from the API response once available
            {refreshedAt && (
              <p className="text-sm text-muted-foreground mt-1">
                Last updated: {(() => {
                  const date = new Date(refreshedAt);
                  if (isNaN(date.getTime())) return refreshedAt;
                  return date.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZoneName: "short",
                  });
                })()}
              </p>
            )}
            */}
          </div>
          <a
            href="https://syncinsights.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Powered by</span>
            <img
              src="/sync-insights-logo-01.png"
              alt="Sync Insights"
              className="h-6 w-auto"
            />
          </a>
        </div>

        {tiles.length > 0 ? (
          shouldRenderDashboard ? (
            <ErrorBoundary title="Dashboard rendering error">
              <DashboardWrapper tiles={tiles.map(t => ({ ...t, i: `${t.i}-${refreshKey}`, key: `${t.key}-${refreshKey}` }))} />
            </ErrorBoundary>
          ) : (
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-sm text-muted-foreground">Waiting to render dashboard...</p>
            </div>
          )
        ) : (
          <Alert>
            <AlertDescription>This dashboard has no tiles to display.</AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  );
}
