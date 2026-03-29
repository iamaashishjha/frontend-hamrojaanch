import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import {
  getFileVaultAssetUrl,
  listFileVaultAssets,
  resolveApiAssetUrl,
  type FileVaultAsset,
  updateFileVaultAssetStatus,
} from "@/lib/file-vault-api";

type StatusFilter = "all" | "pending_scan" | "safe" | "quarantined";

export default function FileVaultPage() {
  const [items, setItems] = useState<FileVaultAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listFileVaultAssets({
        q: query || undefined,
        kind: kind !== "all" ? kind : undefined,
        status: status !== "all" ? status : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        pageSize,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Load failed",
        description: error instanceof Error ? error.message : "Unable to load assets.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kind, status, fromDate, toDate, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, kind, status, fromDate, toDate, pageSize]);

  const summary = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending_scan").length;
    const safe = items.filter((i) => i.status === "safe").length;
    const quarantined = items.filter((i) => i.status === "quarantined").length;
    return { pending, safe, quarantined };
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleStatus = async (id: string, next: "safe" | "quarantined") => {
    setActionId(id);
    try {
      await updateFileVaultAssetStatus(id, next);
      await load();
      toast({ title: "Status updated", description: `Asset marked ${next}.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unable to update status.",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleOpen = async (id: string) => {
    try {
      const url = await getFileVaultAssetUrl(id);
      window.open(resolveApiAssetUrl(url), "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Open failed",
        description: error instanceof Error ? error.message : "Could not open asset.",
      });
    }
  };

  const handleExportCsv = () => {
    const header = [
      "ID",
      "Kind",
      "Status",
      "Storage Key",
      "SHA256",
      "Size Bytes",
      "MIME Type",
      "Created At",
      "Updated At",
    ];
    const rows = items.map((item) =>
      [
        item.id,
        item.kind,
        item.status,
        item.storageKey,
        item.sha256 ?? "",
        String(item.sizeBytes ?? ""),
        item.mimeType ?? "",
        item.createdAt,
        item.updatedAt,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `file-vault-page-${page}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportFullCsv = async () => {
    try {
      const first = await listFileVaultAssets({
        q: query || undefined,
        kind: kind !== "all" ? kind : undefined,
        status: status !== "all" ? status : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page: 1,
        pageSize: 200,
      });
      const all: FileVaultAsset[] = [...first.items];
      const pages = Math.max(1, Math.ceil(first.total / 200));
      for (let p = 2; p <= pages; p++) {
        const next = await listFileVaultAssets({
          q: query || undefined,
          kind: kind !== "all" ? kind : undefined,
          status: status !== "all" ? status : undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          page: p,
          pageSize: 200,
        });
        all.push(...next.items);
      }

      const header = [
        "ID",
        "Kind",
        "Status",
        "Storage Key",
        "SHA256",
        "Size Bytes",
        "MIME Type",
        "Created At",
        "Updated At",
      ];
      const rows = all.map((item) =>
        [
          item.id,
          item.kind,
          item.status,
          item.storageKey,
          item.sha256 ?? "",
          String(item.sizeBytes ?? ""),
          item.mimeType ?? "",
          item.createdAt,
          item.updatedAt,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
      const csv = [header.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "file-vault-full-filtered.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "CSV exported", description: `${all.length} rows exported.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export full CSV.",
      });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
        <h1 className="text-2xl font-semibold text-foreground">File Vault</h1>
        <p className="text-sm text-muted-foreground">
          Central index of uploaded assets with scan status control.
        </p>
      </div>

      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={items.length === 0}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV (page)
          </Button>
          <Button variant="outline" onClick={() => void handleExportFullCsv()} disabled={total === 0}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV (all filtered)
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total</CardDescription><CardTitle>{total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Pending</CardDescription><CardTitle>{summary.pending}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Safe</CardDescription><CardTitle>{summary.safe}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Quarantined</CardDescription><CardTitle>{summary.quarantined}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative w-full sm:max-w-[260px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search storage key..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Kind" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              <SelectItem value="question_media">Question media</SelectItem>
              <SelectItem value="evidence_video">Evidence video</SelectItem>
              <SelectItem value="certificate_pdf">Certificate PDF</SelectItem>
              <SelectItem value="id_doc">ID docs</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending_scan">Pending scan</SelectItem>
              <SelectItem value="safe">Safe</SelectItem>
              <SelectItem value="quarantined">Quarantined</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full sm:w-[170px]"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full sm:w-[170px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assets</CardTitle>
          <CardDescription>
            {loading ? "Loading..." : `${items.length} shown • page ${page} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{item.kind}</Badge>
                <Badge variant={item.status === "quarantined" ? "destructive" : item.status === "safe" ? "secondary" : "outline"}>
                  {item.status}
                </Badge>
                <span className="text-muted-foreground">{format(new Date(item.createdAt), "PPp")}</span>
              </div>
              <p className="mt-1 break-all text-sm">{item.storageKey}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void handleOpen(item.id)}>
                  <Download className="mr-1 h-4 w-4" />
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionId === item.id || item.status === "safe"}
                  onClick={() => void handleStatus(item.id, "safe")}
                >
                  Mark Safe
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={actionId === item.id || item.status === "quarantined"}
                  onClick={() => void handleStatus(item.id, "quarantined")}
                >
                  Quarantine
                </Button>
              </div>
            </div>
          ))}
          {!loading && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assets found.</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="text-xs text-muted-foreground">
              Total {total} asset{total === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
