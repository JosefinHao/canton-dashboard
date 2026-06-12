import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  gradient?: boolean;
}
export const StatCard = ({ title, value, icon: Icon, trend, gradient }: StatCardProps) => {
  return (
    <div className={`glass-card p-4 sm:p-6 transition-smooth ${gradient ? "glow-primary" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="micro-title mb-3" style={{ letterSpacing: "3px" }}>{title}</p>
          <p className="stat-num color-canton-yellow mb-1 truncate">{value}</p>
          {trend && trend.value}
        </div>
        <div className={`p-3 rounded-full ${gradient ? "gradient-primary" : "bg-muted"}`}>
          <Icon className={`h-6 w-6 ${gradient ? "text-primary-foreground" : "color-canton-yellow"}`} />
        </div>
      </div>
    </div>
  );
};
