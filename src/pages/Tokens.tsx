import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Layers, Search, ArrowUpDown, Clock, Coins, ChevronRight } from "lucide-react";
import { useTokens } from "@/hooks/use-tokens";
import type { TokenInfo } from "@/lib/duckdb-api-client";

type SortField = "symbol" | "totalSupply" | "issuer";
type SortDir = "asc" | "desc";

function formatSupply(supply: string | null, decimals: number): string {
  if (!supply) return "—";
  const num = parseFloat(supply);
  if (isNaN(num)) return "—";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(Math.min(decimals, 4));
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function IssuerLabel({ issuer }: { issuer: string }) {
  const labels: Record<string, string> = {
    DSO: "Global Synchronizer",
    "decentralized-usdc-interchain-rep": "USDC Bridge",
    "excellar-issuer": "Excellar",
    "trakx-issuer": "Trakx",
  };
  return <span>{labels[issuer] || issuer}</span>;
}

export default function Tokens() {
  const { data, isLoading, error } = useTokens();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalSupply");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedIssuers, setExpandedIssuers] = useState<Set<string>>(new Set());

  const tokens = data?.tokens || [];

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    let list = tokens.filter(
      (t) =>
        !term ||
        t.symbol.toLowerCase().includes(term) ||
        t.name.toLowerCase().includes(term) ||
        t.issuer.toLowerCase().includes(term) ||
        t.instrumentId.id.toLowerCase().includes(term)
    );

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "symbol") {
        cmp = a.symbol.localeCompare(b.symbol);
      } else if (sortField === "totalSupply") {
        cmp = (parseFloat(a.totalSupply || "0") || 0) - (parseFloat(b.totalSupply || "0") || 0);
      } else if (sortField === "issuer") {
        cmp = a.issuer.localeCompare(b.issuer);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [tokens, search, sortField, sortDir]);

  const groupedByIssuer = useMemo(() => {
    const groups = new Map<string, TokenInfo[]>();
    for (const token of filtered) {
      const group = groups.get(token.issuer) || [];
      group.push(token);
      groups.set(token.issuer, group);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const totalA = a[1].reduce((s, t) => s + (parseFloat(t.totalSupply || "0") || 0), 0);
      const totalB = b[1].reduce((s, t) => s + (parseFloat(t.totalSupply || "0") || 0), 0);
      return totalB - totalA;
    });
  }, [filtered]);

  useEffect(() => {
    if (search) {
      setExpandedIssuers(new Set(groupedByIssuer.map(([issuer]) => issuer)));
    }
  }, [search, groupedByIssuer]);

  function toggleIssuer(issuer: string) {
    setExpandedIssuers((prev) => {
      const next = new Set(prev);
      if (next.has(issuer)) next.delete(issuer);
      else next.add(issuer);
      return next;
    });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "totalSupply" ? "desc" : "asc");
    }
  }

  const uniqueIssuers = new Set(tokens.map((t) => t.issuer)).size;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Layers className="h-8 w-8 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold">CIP-56 Tokens</h1>
            </div>
          </div>
          <Alert variant="destructive">
            <AlertTitle>Failed to load tokens</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Layers className="h-8 w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold">CIP-56 Tokens</h1>
          </div>
          <p className="text-muted-foreground">
            All assets on the Canton Network implementing the CIP-56 token standard
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                <p className="text-2xl sm:text-3xl font-bold">{tokens.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Token Issuers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                <p className="text-2xl sm:text-3xl font-bold">{uniqueIssuers}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Last Refreshed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <p className="text-xl font-bold">
                  {data?.lastRefreshed ? formatTimeAgo(data.lastRefreshed) : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + Expand All */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, symbol, or issuer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <button
            className="ml-auto text-sm text-muted-foreground hover:text-foreground whitespace-nowrap"
            onClick={() => {
              const allIssuers = groupedByIssuer.map(([issuer]) => issuer);
              const allExpanded = allIssuers.every((i) => expandedIssuers.has(i));
              setExpandedIssuers(allExpanded ? new Set() : new Set(allIssuers));
            }}
          >
            {groupedByIssuer.length > 0 && groupedByIssuer.every(([i]) => expandedIssuers.has(i))
              ? "Collapse All"
              : "Expand All"}
          </button>
        </div>

        {/* Token table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("symbol")} className="flex items-center gap-1 hover:text-foreground">
                    Issuer / Token
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead />
                <TableHead className="text-right">
                  <button onClick={() => toggleSort("totalSupply")} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    Total Supply
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedByIssuer.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {search ? "No tokens match your search" : "No tokens available"}
                  </TableCell>
                </TableRow>
              ) : (
                groupedByIssuer.map(([issuer, issuerTokens]) => {
                  const expanded = expandedIssuers.has(issuer);
                  return (
                    <IssuerGroup
                      key={issuer}
                      issuer={issuer}
                      tokens={issuerTokens}
                      expanded={expanded}
                      onToggle={() => toggleIssuer(issuer)}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Data source:{" "}
          <a
            href="https://github.com/canton-network/wallet/blob/main/api-specs/assets.json"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            canton-network/wallet/api-specs/assets.json
          </a>
          {" "}· Live supply from CIP-56 registry metadata APIs
        </p>
      </div>
    </DashboardLayout>
  );
}

function IssuerGroup({
  issuer,
  tokens,
  expanded,
  onToggle,
}: {
  issuer: string;
  tokens: TokenInfo[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const totalSupply = tokens.reduce((s, t) => s + (parseFloat(t.totalSupply || "0") || 0), 0);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50 bg-muted/20"
        onClick={onToggle}
      >
        <TableCell>
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          />
        </TableCell>
        <TableCell>
          <span className="font-semibold">
            <IssuerLabel issuer={issuer} />
          </span>
          <span className="ml-2 text-sm text-muted-foreground">
            ({tokens.length} {tokens.length === 1 ? "token" : "tokens"})
          </span>
        </TableCell>
        <TableCell />
        <TableCell className="text-right font-mono text-muted-foreground">
          {totalSupply > 0 ? formatSupply(String(totalSupply), 2) : ""}
        </TableCell>
      </TableRow>
      {expanded &&
        tokens.map((token) => (
          <TokenRow key={`${token.instrumentId.admin}::${token.instrumentId.id}`} token={token} />
        ))}
    </>
  );
}

function TokenRow({ token }: { token: TokenInfo }) {
  return (
    <TableRow>
      <TableCell>
        {token.assetLogo ? (
          <img
            src={token.assetLogo}
            alt={token.symbol}
            className="h-8 w-8 rounded-full object-contain bg-muted p-0.5 ml-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground ml-2">
            {token.symbol.slice(0, 2)}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div>
          <span className="font-medium">{token.name}</span>
          {token.name !== token.symbol && (
            <span className="ml-2 text-muted-foreground text-sm">{token.symbol}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]" title={token.instrumentId.id}>
          {token.instrumentId.id}
        </div>
      </TableCell>
      <TableCell />
      <TableCell className="text-right font-mono">
        {formatSupply(token.totalSupply, token.decimals)}
      </TableCell>
    </TableRow>
  );
}
