import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { API_BASE } from "@/lib/apiClient";
import {
  getFileVaultAssetUrl,
  listFileVaultAssets,
  type FileVaultAsset,
  updateFileVaultAssetStatus,
} from "@/lib/file-vault-api";

interface FileVaultQuickTriageCardProps {
  title?: string;
  description?: string;
  kind?: string;
  pageSize?: number;
}

export default function FileVaultQuickTriageCard({
  title = "Evidence file quick triage",
  description = "Recent evidence assets from File Vault.",
  kind = "evidence_video",
  pageSize = 6,
}: FileVaultQuickTriageCardProps) {
  const [items, setItems] = useState<FileVaultAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await listFileVaultAssets({ kind, page: 1, pageSize });
      setItems(result.items);
    } catch {
      // non-blocking for page UX
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, pageSize]);

  const handleOpen = async (id: string) => {
    try {
      const url = await getFileVaultAssetUrl(id);
      const full = url.startsWith("http") ? url : `${API_BASE}${url}`;
      window.open(full, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Open failed",
        description: e instanceof Error ? e.message : "Could not open file.",
      });
    }
  };

  const handleStatus = async (id: string, status: "safe" | "quarantined") => {
    setActionId(id);
    try {
      await updateFileVaultAssetStatus(id, status);
      await load();
      toast({ title: "File updated", description: `Marked ${status}.` });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: e instanceof Error ? e.message : "Could not update file status.",
      });
    } finally {
      setActionId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">No files.</p>
        ) : (
          items.map((asset) => (
            <div key={asset.id} className="rounded-lg border p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{asset.kind}</Badge>
                <Badge
                  variant={
                    asset.status === "quarantined"
                      ? "destructive"
                      : asset.status === "safe"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {asset.status}
                </Badge>
              </div>
              <p className="mt-1 break-all text-muted-foreground">{asset.storageKey}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void handleOpen(asset.id)}>
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionId === asset.id || asset.status === "safe"}
                  onClick={() => void handleStatus(asset.id, "safe")}
                >
                  Mark Safe
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={actionId === asset.id || asset.status === "quarantined"}
                  onClick={() => void handleStatus(asset.id, "quarantined")}
                >
                  Quarantine
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

