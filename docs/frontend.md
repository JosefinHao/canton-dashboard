# Frontend Documentation

Canton Foundation governance dashboard — a React SPA for exploring governance, validators, and network statistics on the Canton Network.

**Live**: https://dashboard.canton.foundation/
**Staging**: https://dashboard.canton.foundation/staging/

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite (SWC compiler) |
| Routing | React Router v6 |
| State / Data | TanStack React Query |
| UI Components | shadcn/ui (Radix primitives) |
| Styling | Tailwind CSS + custom Canton design tokens |
| Charts | Recharts, react-autoql (Sync Insights) |
| Testing | Vitest |

## Project Structure

```
src/
├── App.tsx                  # Route definitions
├── main.tsx                 # Entry point (React root, global error handlers)
├── index.css                # Canton design system (CSS variables, utility classes)
├── components/
│   ├── DashboardLayout.tsx  # Shared page layout (header, nav, mobile drawer)
│   ├── PaginationControls.tsx # Shared pagination component (used by all paginated pages)
│   ├── GovernanceHistoryTable.tsx # Governance vote history table with search/filter
│   ├── StatCard.tsx         # Reusable metric card
│   ├── ErrorBoundary.tsx    # React error boundary with reload button
│   ├── ConnectionStatusIndicator.tsx  # Backend health indicator (bottom-right)
│   ├── icons/               # Custom SVG icon components
│   └── ui/                  # shadcn/ui primitives (button, card, sheet, etc.)
├── pages/                   # One file per route (~40 pages)
├── hooks/                   # React Query hooks for data fetching (~40 hooks)
├── lib/
│   ├── api-client.ts        # Scan API client (all backend calls)
│   ├── backend-config.ts    # Backend URL resolution
│   ├── config-sync.ts       # SV config fetcher (GitHub YAML)
│   ├── duckdb-api-client.ts # DuckDB-specific endpoints
│   └── utils.ts             # Formatting helpers
├── utils/
│   └── dashboardService.ts  # Sync Insights (react-autoql) data fetcher
└── styles/
    └── react-autoql-overrides.css  # CSS overrides for react-autoql charts
```

## Data Flow

### Backend Proxy

All API calls route through the backend proxy at `/api/scan-proxy`. The frontend never calls the Canton Scan API directly.

```
Browser → /api/scan-proxy/v0/... → Backend (port 3001) → Canton Scan API
```

Configured in `src/lib/backend-config.ts`. In development, Vite proxies `/api` to `localhost:3001`.

### React Query

Every data-fetching page uses TanStack React Query. Global defaults in `App.tsx`:

- **retry**: 3 attempts with exponential backoff (1s, 2s, 4s, max 10s)
- **staleTime**: 60s (data considered fresh for 1 minute)
- **gcTime**: 5 minutes (unused cache kept for 5 minutes)
- **refetchOnWindowFocus**: disabled
- **networkMode**: offlineFirst (serve cache, then revalidate)

### Sync Insights Dashboards

Dashboards powered by Sync Insights (react-autoql) fetch data from `https://backend.chata.io/public/api/v1`. Authentication via `VITE_DASHBOARD_API_KEY` env var.

Data flow:
1. `useDashboards()` hook fetches the dashboard list
2. `DashboardViewer` page fetches tile data for each tile via `fetchTileData()`
3. Tile data is passed to the react-autoql `<Dashboard>` component in offline mode
4. Background refresh every 30 minutes re-fetches tile data silently

## Navigation

The layout (`DashboardLayout.tsx`) provides:

- **Desktop**: Dropdown nav groups in the header (Overview, Governance, Network, Statistics)
- **Mobile**: Hamburger menu opening a left-side drawer via Radix Sheet

Navigation groups are defined in `baseNavigationGroups` and augmented with dynamically-loaded Sync Insights dashboards at runtime.

### Key Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | Dashboard | Landing page with live network stats |
| `/governance` | Governance | Vote requests, proposals, governance history |
| `/governance-flow` | Governance Flow | Visual governance lifecycle |
| `/dev-fund` | Dev Fund | Development fund coupon tracking |
| `/validators` | Super Validators | Top validator leaderboard |
| `/validator-licenses` | Validators | Validator licenses and faucet state |
| `/sequencers` | Sequencers | Sequencer nodes |
| `/sv-status` | SV Status | Live SV health monitor across environments |
| `/issuance-curve` | Issuance Curve | Token issuance schedule and reward distribution |
| `/protocol-fees` | Protocol Fees | Fee structure details |
| `/price-votes` | Price Votes | CC/USD price vote tracking |
| `/tokens` | Tokens | Token overview |
| `/stats` | Statistics | Aggregate network statistics |
| `/kaiko-feed` | Kaiko Feed | Exchange market data (Kaiko integration) |
| `/dashboard/:name` | Dashboard Viewer | Sync Insights embedded dashboard |

Admin routes (`/admin`, `/templates`, `/ingestion`, etc.) are accessible but not shown in the main nav.

## Design System

### Canton Brand Tokens

All colors are defined as HSL CSS variables in `src/index.css`:

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `67 100% 80%` | Canton Yellow — dominant signal color |
| `--secondary` | `256 100% 68%` | Canton Purple — supportive |
| `--accent` | `286 53% 77%` | Canton Lilac — supportive |
| `--background` | `268 92% 10%` | Deep purple page background |
| `--card` | `260 70% 6%` | Darker card surfaces |
| `--border` | `255 36% 33%` | Purple-stroke borders (#634BA9) |
| `--destructive` | `4 73% 49%` | Error red |
| `--warning` | `29 79% 52%` | Orange |

### Tailwind Color Remap

`tailwind.config.ts` remaps standard Tailwind colors to the Canton palette so utility classes like `text-green-500` render on-brand (chartreuse-yellow) rather than the default Tailwind green.

### Component Classes

| Class | Usage |
|-------|-------|
| `.glass-card` | Card with purple gradient sheen, #634BA9 border, 20px radius |
| `.micro-title` | Yellow uppercase eyebrow label (letter-spacing: 3-7px) |
| `.stat-num` | Large metric figure with responsive clamp sizing |
| `.nav-link` | Nav item with yellow square indicator on hover/active |
| `.btn-pill-primary` | Yellow pill button that fills to white on hover |
| `.btn-pill-outline` | Outlined pill button that fills yellow on hover |
| `.transition-smooth` | 0.3s ease transition on all properties |

### Font

IBM Plex Sans (loaded from Google Fonts), falling back to system fonts.

## Sync Insights (react-autoql) Integration

The `DashboardViewer` page renders third-party charts from Sync Insights. Key implementation details:

### Dynamic Import

react-autoql is loaded dynamically (`import("react-autoql")`) to avoid bundling issues. The module-level `isAutoQLLoaded` flag prevents re-importing on subsequent navigations.

### Responsive Desktop / Mobile Rendering

On desktop (viewport >= 1024px), charts render responsively at full container width with no horizontal scrolling. On mobile (< 1024px), charts render at fixed 1400px desktop proportions with horizontal scroll.

Two mechanisms enforce mobile rendering:

1. **CSS override**: `react-autoql-overrides.css` overrides the library's `width: 100vw` on chart containers to `width: 100%`, so charts fill their grid tile instead of the viewport.

2. **window.innerWidth override**: A `useLayoutEffect` patches `window.innerWidth` to return 1400 on mobile only (`isMobileRef`), so react-autoql's breakpoint system (`isMobile = window.innerWidth <= 992`) uses desktop thresholds. The override is cleaned up on unmount via `delete window.innerWidth`. On desktop, no override is applied — the library uses the real viewport width.

3. **Conditional container sizing**: The chart container uses `width: 100%` on desktop and `width: 1400px; minWidth: 1400px` on mobile, wrapped in `overflow-x-auto` for horizontal scrolling.

### Theme Configuration

react-autoql theming is set via `configureTheme()` on module load:
- Dark theme with `#030206` primary background
- Chart colors: Yellow `#F3FF97`, Lilac `#D5A5E3`, Blue `#5BA3E8`, Teal `#7BC8C8`, Slate `#8FA8B8`
- Font: IBM Plex Sans

### React StrictMode

StrictMode is disabled in `main.tsx` because react-autoql performs direct DOM manipulation that breaks under double-rendering.

## Shared Components

### PaginationControls

`src/components/PaginationControls.tsx` — shared pagination component used by all paginated pages.

**Props**: `currentPage`, `totalItems`, `pageSize`, `onPageChange`

**Behavior**:
- Renders "Showing X–Y of Z" label on the left, Previous/Next buttons on the right
- Automatically hides when total items fit on a single page (`totalPages <= 1`)
- Responsive: stacks vertically on mobile, horizontal on desktop

**Pages using PaginationControls**: GovernanceHistoryTable, GovernanceFlow (lifecycle + topics), ValidatorLicenses (licenses + faucets), Stats, Elections, Transfers, TransferCounters, Subscriptions, MemberTraffic, ExternalPartyRules, ANS

All paginated views use a page size of 20 records.

### GovernanceHistoryTable

`src/components/GovernanceHistoryTable.tsx` — governance vote history with multi-term search, action type filtering, proposal deep-linking, and pagination.

**Features**:
- Comma-separated search terms with match highlighting (`<mark>` tags)
- Action type filter buttons with per-type counts
- URL parameter `?proposal=<id>` scrolls to and highlights a specific proposal
- Stats row showing total/accepted/rejected/expired counts

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_BASE_PATH` | React Router basename (e.g., `/staging`) | Staging only |
| `VITE_BASE` | Vite asset base path (e.g., `/staging/`) | Staging only |
| `VITE_DASHBOARD_API_KEY` | Sync Insights API key for dashboard data | For SI dashboards |

Production builds use defaults (`/` for both paths).

## Development

```bash
# Install dependencies
npm install

# Start dev server (port 8080)
npm run dev

# Type check
npx tsc --noEmit

# Run tests
npm test

# Build for production
npx vite build

# Build for staging
VITE_BASE_PATH=/staging npx vite build --base=/staging/
```

The dev server proxies `/api` to `localhost:3001`, so the backend must be running locally:

```bash
cd server
npm install
node api/scan-proxy.js   # or use PM2
```

## Deployment

See `deploy/README_DEPLOY.md` for full deployment instructions.

Quick reference:

```bash
# Deploy to staging
./deploy/deploy-frontend.sh --staging

# Deploy to production
./deploy/deploy-frontend.sh
```

Architecture:
```
nginx (80/443)
  ├── /            → /var/www/html/          (production frontend)
  ├── /api/        → localhost:3001          (production backend)
  ├── /staging/    → /var/www/staging/       (staging frontend)
  └── /staging/api/→ localhost:3002          (staging backend)
```

## Key Patterns

### Page Structure

Every page follows the same pattern:

```tsx
export default function MyPage() {
  const { data, isLoading, error } = useQuery({ ... });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Page Title</h1>
        {/* Content */}
      </div>
    </DashboardLayout>
  );
}
```

### Error Handling

- **Component errors**: `<ErrorBoundary>` wraps the app root and individual risky components
- **API errors**: React Query handles retries; pages show error states via `isError`
- **Global errors**: `window.onerror` and `unhandledrejection` listeners in `main.tsx`
- **Connection status**: `<ConnectionStatusIndicator>` pings the backend every 30s

### Mobile Responsiveness

- All pages use responsive Tailwind classes (`text-2xl sm:text-3xl`, `grid-cols-1 md:grid-cols-2`, etc.)
- Tables with many columns wrap in `overflow-x-auto` containers
- The mobile nav drawer uses `modal={false}` on Radix Sheet with manual scroll lock management
- Fixed header uses `position: fixed` with solid `#0a0528` background (no `backdrop-filter`) and `will-change: transform` for GPU compositing
- Cards use solid backgrounds (`bg-card`) without `backdrop-blur` to avoid mobile Safari stacking context issues
- Heavy pages (500+ DOM elements) use pagination (20 items per page) to prevent mobile compositing overload

### Pagination

All paginated pages share the `PaginationControls` component for consistent styling:
- "Showing X–Y of Z" range label
- Plain Previous/Next buttons
- Page counter (e.g., "3 / 12")
- Separated by a `border-t` divider
- Hidden when content fits on one page

### z-index Stacking

| Element | z-index | Notes |
|---------|---------|-------|
| Header | `z-[100]` | Fixed at top, solid background |
| Mobile nav drawer (SheetContent) | `z-[110]` | Above header |
| Popover/dropdown content | `z-[120]` | Above drawer |

### SV Status Tables

Service columns (mediator, scan, sequencer, sv) distribute width equally (80% of table divided evenly), with the Name/Env column using auto width. Data cells are center-aligned under their headers.
