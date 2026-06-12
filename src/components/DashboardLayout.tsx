import { ReactNode, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import cantonLogo from "@/assets/logo.svg";
import { Link, useLocation } from "react-router-dom";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import {
  BarChart3,
  Coins,
  Database,
  Zap,
  Vote,
  Award,
  Ticket,
  GitBranch,
  CandlestickChart,
  Network,
  TrendingUp,
  DollarSign,
  ChevronDown,
  Radio,
  Layers,
  Lock,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { SyncInsightsIcon } from "./icons/SyncInsightsIcon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useDashboards } from "@/hooks/use-dashboards";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const baseNavigationGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/", icon: BarChart3 },
      { name: "Issuance Curve", href: "/issuance-curve", icon: TrendingUp },
      { name: "Protocol Fees", href: "/protocol-fees", icon: DollarSign },
      { name: "Price Votes", href: "/price-votes", icon: DollarSign },
      { name: "Tokens", href: "/tokens", icon: Layers },
    ],
  },
  {
    label: "Governance",
    items: [
      { name: "Governance", href: "/governance", icon: Vote },
      { name: "Governance Flow", href: "/governance-flow", icon: GitBranch },
      { name: "Dev Fund", href: "/dev-fund", icon: Coins },
      // { name: "SV Locking", href: "/sv-locking", icon: Lock },
    ],
  },
  // {
  //   label: "Burn/Mint",
  //   items: [
  //     { name: "Mint", href: "/supply", icon: Coins },
  //     { name: "Transactions", href: "/transactions", icon: Activity },
  //     { name: "Transfers", href: "/transfers", icon: ArrowRightLeft },
  //     { name: "Rich List", href: "/rich-list", icon: Wallet },
  //   ],
  // },
  {
    label: "Network",
    items: [
      { name: "Super Validators", href: "/validators", icon: Zap },
      { name: "Validators", href: "/validator-licenses", icon: Ticket },
      { name: "Sequencers", href: "/sequencers", icon: Network },
      { name: "SV Status", href: "/sv-status", icon: Radio },
    ],
  },
  // {
  //   label: "Exchange Data",
  //   items: [
  //     { name: "Kaiko Feed", href: "/kaiko-feed", icon: CandlestickChart },
  //   ],
  // },
  // {
  //   label: "Services",
  //   items: [
  //     { name: "ANS", href: "/ans", icon: Globe },
  //     { name: "Featured Apps", href: "/apps", icon: Package },
  //     { name: "Subscriptions", href: "/subscriptions", icon: Package },
  //   ],
  // },
  {
    label: "Statistics",
    items: [
      { name: "Statistics", href: "/stats", icon: Database },
    ],
  },
];

const NavDropdown = ({ group }: { group: NavGroup }) => {
  const location = useLocation();
  const isGroupActive = group.items.some(item => location.pathname === item.href);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-active={isGroupActive}
          className={`nav-link flex items-center gap-1.5 px-3 pt-1 text-[14px] font-normal uppercase tracking-[0.7px] ${
            isGroupActive
              ? "text-white"
              : "text-white/85 hover:text-primary"
          }`}
        >
          {group.label}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[120] w-56 p-1.5 bg-popover border border-border shadow-xl"
        align="start"
        sideOffset={16}
      >
        <div className="flex flex-col gap-0.5">
          {group.items.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-2 px-3 py-2 rounded-md text-sm transition-smooth ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="break-words min-w-0">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const MobileNav = ({ groups }: { groups: NavGroup[] }) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetTrigger asChild>
        <button className="md:hidden p-2 text-foreground" aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="z-[110] w-72 p-0 bg-card border-border flex flex-col [&>button]:z-[111]"
        aria-describedby={undefined}
        onInteractOutside={() => setOpen(false)}
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <div className="p-4 border-b border-border pr-12">
          <img src={cantonLogo} alt="Canton Network" className="h-8" />
        </div>
        <nav className="flex-1 min-h-0 flex flex-col gap-1 p-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-smooth ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="break-words min-w-0">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const { data: dashboards = [], error: dashboardsError } = useDashboards();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (dashboardsError) {
    console.warn("⚠️ Error loading dashboards:", dashboardsError);
  }

  const navigationGroups = useMemo(() => {
    const groups = baseNavigationGroups.map(group => ({
      ...group,
      items: [...group.items],
    }));

    const overviewGroup = groups.find(g => g.label === "Overview");
    if (overviewGroup && dashboards.length > 0) {
      const seenNames = new Set<string>();
      const dashboardItems: NavItem[] = dashboards
        .map((dashboard) => ({
          name: dashboard.dashboard.title,
          href: `/dashboard/${encodeURIComponent(dashboard.id)}`,
          icon: SyncInsightsIcon as LucideIcon,
        }))
        .filter((item) => {
          if (seenNames.has(item.name)) return false;
          seenNames.add(item.name);
          return true;
        });

      overviewGroup.items = [...overviewGroup.items, ...dashboardItems];
    }

    return groups;
  }, [dashboards]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-[100]"
        style={{
          background: "#0a0528",
        }}
      >
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            {/* Mobile hamburger */}
            <MobileNav groups={navigationGroups} />

            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 group">
              <img src={cantonLogo} alt="Canton Network" className="h-8 md:h-10" />
            </Link>

            {/* Desktop Navigation / mobile spacer for logo centering */}
            <nav className="hidden md:flex items-center gap-1">
              {navigationGroups.map((group) => (
                <NavDropdown key={group.label} group={group} />
              ))}
            </nav>
            <div className="w-10 md:hidden" />
          </div>
        </div>
      </header>
      {/* Spacer for fixed header */}
      <div className="h-14 md:h-[72px]" />

      {/* Main Content */}
      <main className="container mx-auto px-4 md:px-6 py-4 md:py-8">
        <ErrorBoundary title="Dashboard failed to render">
          {children}
        </ErrorBoundary>
      </main>
      
      {/* Connection Status Indicator */}
      <ConnectionStatusIndicator />
    </div>
  );
};
