import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { get } from "@/lib/apiClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StudentNotificationItem = {
  id: string;
  subject?: string | null;
  message?: string | null;
  sentAt?: string | null;
  read?: boolean;
};

type StudentNotificationsBellProps = {
  triggerClassName: string;
  iconSize?: number;
  ariaLabel?: string;
};

function formatCount(value: number): string {
  return value > 99 ? "99+" : String(value);
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString();
}

export function StudentNotificationsBell({
  triggerClassName,
  iconSize = 18,
  ariaLabel = "Notifications",
}: StudentNotificationsBellProps) {
  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["student", "me", "notifications", "bell"],
    queryFn: async () => {
      const res = await get<{ items?: StudentNotificationItem[] }>("/students/me/notifications");
      return res.items ?? [];
    },
    staleTime: 30_000,
  });

  const unreadCount = useMemo(
    () => items.reduce((sum, item) => (item.read === false ? sum + 1 : sum), 0),
    [items]
  );

  const recentItems = useMemo(
    () =>
      [...items]
        .sort((a, b) => toTimestamp(b.sentAt) - toTimestamp(a.sentAt))
        .slice(0, 5),
    [items]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClassName}
          aria-label={ariaLabel}
          style={{ position: "relative" }}
        >
          <Bell size={iconSize} />
          {unreadCount > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                background: "#df4a61",
                color: "#fff",
                border: "2px solid #fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
                fontWeight: 700,
                padding: "0 4px",
                lineHeight: 1,
              }}
            >
              {formatCount(unreadCount)}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuItem asChild>
          <Link to="/student-notifications">Open notifications</Link>
        </DropdownMenuItem>
        {isLoading ? (
          <DropdownMenuItem disabled>Loading notifications...</DropdownMenuItem>
        ) : isError ? (
          <DropdownMenuItem disabled>Unable to load notifications.</DropdownMenuItem>
        ) : recentItems.length === 0 ? (
          <DropdownMenuItem disabled>No notifications yet.</DropdownMenuItem>
        ) : (
          recentItems.map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link to="/student-notifications" className="flex w-full flex-col items-start">
                <span className="line-clamp-1 w-full text-left">
                  {item.subject?.trim() || "Notification"}
                </span>
                <span className="text-xs text-slate-500">{formatWhen(item.sentAt)}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

