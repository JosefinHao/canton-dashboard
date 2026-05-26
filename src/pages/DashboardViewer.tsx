import { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useDashboards } from "@/hooks/use-dashboards";

// Don't import react-autoql at module level - it's causing bundling issues
// We'll load it dynamically when needed
let Dashboard: any = null;
let configureTheme: any = null;
let isAutoQLLoaded = false;
import type { RawDashboard } from "@/utils/dashboardService";
import { fetchTileData } from "@/utils/dashboardService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
  
  // Memoize tiles to prevent unnecessary re-renders
  const memoizedTiles = useMemo(() => tiles, [tiles.map(t => t.i || t.key).join('-')]);
  
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
        tiles={memoizedTiles}
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

    Promise.allSettled(
      rawTiles.map(async (tile) => {
        const queryIndex: 0 | 1 = tile.index ?? 0;
        const response = await fetchTileData(dashboardId, tile.key, queryIndex);
        const prop = queryIndex === 0 ? "queryResponse" : "secondQueryResponse";
        return { ...tile, [prop]: response };
      })
    ).then((results) => {
      if (cancelled) return;
      setTiles(
        results.map((result, idx) =>
          result.status === "fulfilled" ? result.value : rawTiles[idx]
        )
      );
      setIsLoadingTiles(false);
    });

    return () => {
      cancelled = true;
    };
  }, [dashboardData]);

  // Silent background refresh — fires at 3 minutes past each hour
  useEffect(() => {
    const rawTiles = dashboardData?.dashboard?.tiles;
    if (!rawTiles?.length) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const msUntilNextRefresh = () => {
      const now = new Date();
      const next = new Date(now);
      next.setMinutes(3, 0, 0);
      if (next <= now) next.setHours(next.getHours() + 1);
      return next.getTime() - now.getTime();
    };

    const refresh = () => {
      Promise.allSettled(
        rawTiles.map(async (tile) => {
          const queryIndex: 0 | 1 = tile.index ?? 0;
          const response = await fetchTileData(dashboardData!.id, tile.key, queryIndex);
          const prop = queryIndex === 0 ? "queryResponse" : "secondQueryResponse";
          return { ...tile, [prop]: response };
        })
      ).then((results) => {
        if (cancelled) return;
        setTiles(
          results.map((result, idx) =>
            result.status === "fulfilled" ? result.value : rawTiles[idx]
          )
        );
        schedule();
      });
    };

    const schedule = () => {
      timeoutId = setTimeout(refresh, msUntilNextRefresh());
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
            <h1 className="text-3xl font-bold">{dashboardData.dashboard.title}</h1>
            {dashboardData.exportDate && (
              <p className="text-sm text-muted-foreground mt-1">
                Exported: {(() => {
                  try {
                    const date = new Date(dashboardData.exportDate);
                    const options: Intl.DateTimeFormatOptions = {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZoneName: "short",
                    };
                    return date.toLocaleDateString("en-US", options);
                  } catch {
                    return new Date(dashboardData.exportDate).toLocaleString();
                  }
                })()}
              </p>
            )}
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
              <DashboardWrapper tiles={tiles} />
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
