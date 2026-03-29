import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Eye, Mail, Phone, ShieldCheck } from "lucide-react";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { getMe, getStoredUser, updateMe } from "@/lib/auth-api";
import {
  getFileVaultAssetUrl,
  listFileVaultAssets,
  resolveApiAssetUrl,
  uploadFileToVault,
  type FileVaultAsset,
} from "@/lib/file-vault-api";
import { toast } from "sonner";

type AccountProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatarUrl: string | null;
};

function fallbackProfile(user: ReturnType<typeof getStoredUser>): AccountProfile {
  return {
    id: user?.id ?? "",
    name: user?.name ?? "Administrator",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user?.role ?? "admin",
    avatarUrl: user?.avatarUrl ?? null,
  };
}

export default function AdminAccountPage() {
  const { settings } = useSiteSettings();
  const [profile, setProfile] = useState<AccountProfile>(fallbackProfile(getStoredUser()));
  const [idDocs, setIdDocs] = useState<FileVaultAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [idUploading, setIdUploading] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const idInputRef = useRef<HTMLInputElement | null>(null);
  const initials = profile.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";

  const loadAdminIdDocs = async (userId: string) => {
    if (!userId) {
      setIdDocs([]);
      return;
    }
    try {
      const result = await listFileVaultAssets({
        kind: "id_doc",
        q: `admins/${userId}/id-documents`,
        page: 1,
        pageSize: 10,
      });
      setIdDocs(result.items);
    } catch {
      setIdDocs([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const me = await getMe();
        setProfile({
          id: me.id,
          name: me.name ?? "Administrator",
          email: me.email,
          phone: me.phone ?? "",
          role: me.role ?? "admin",
          avatarUrl: me.avatarUrl ?? null,
        });
        await loadAdminIdDocs(me.id);
      } catch (err) {
        const fallback = fallbackProfile(getStoredUser());
        setProfile(fallback);
        await loadAdminIdDocs(fallback.id);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profile.avatarUrl]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateMe({ name: profile.name, phone: profile.phone || null });
      setProfile((prev) => ({
        ...prev,
        name: updated.name ?? prev.name,
        phone: updated.phone ?? "",
        avatarUrl: updated.avatarUrl ?? prev.avatarUrl,
      }));
      toast.success("Admin profile updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update profile.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUploadClick = () => {
    avatarInputRef.current?.click();
  };

  const handleIdUploadClick = () => {
    idInputRef.current?.click();
  };

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      event.target.value = "";
      return;
    }
    setAvatarUploading(true);
    try {
      let uploaded: { asset: FileVaultAsset; url: string };
      try {
        uploaded = await uploadFileToVault({
          file,
          kind: "profile_avatar",
          prefix: `admins/${profile.id || "me"}/profile-avatar`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message.toLowerCase() : "";
        if (!message.includes("invalid file kind")) throw err;
        // Backward compatibility for older backend builds that do not yet allow "profile_avatar".
        uploaded = await uploadFileToVault({
          file,
          kind: "id_doc",
          prefix: `admins/${profile.id || "me"}/profile-avatar`,
        });
      }
      const updated = await updateMe({ avatarUrl: uploaded.url });
      setProfile((prev) => ({ ...prev, avatarUrl: updated.avatarUrl ?? uploaded.url }));
      toast.success("Profile photo updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to upload profile photo.";
      toast.error(message);
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  };

  const handleIdFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIdUploading(true);
    try {
      await uploadFileToVault({
        file,
        kind: "id_doc",
        prefix: `admins/${profile.id || "me"}/id-documents`,
      });
      await loadAdminIdDocs(profile.id);
      toast.success("ID uploaded to File Vault.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to upload ID.";
      toast.error(message);
    } finally {
      setIdUploading(false);
      event.target.value = "";
    }
  };

  const handleOpenLatestId = async () => {
    if (idDocs.length === 0) return;
    try {
      const url = await getFileVaultAssetUrl(idDocs[0].id);
      window.open(resolveApiAssetUrl(url), "_blank", "noopener,noreferrer");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open uploaded ID.";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
        <h1 className="text-2xl font-semibold text-foreground">My Account</h1>
        <p className="text-muted-foreground">
          Manage your profile photo, basic details, and ID uploads.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
              {profile.avatarUrl && !avatarLoadFailed ? (
                <img
                  src={resolveApiAssetUrl(profile.avatarUrl)}
                  alt={`${profile.name} avatar`}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <span className="font-semibold">{initials}</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{profile.name || "Administrator"}</h2>
              <p className="text-sm text-muted-foreground">{settings.branding.siteName} HQ</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
              onClick={handleAvatarUploadClick}
              disabled={avatarUploading || loading}
            >
              <span className="inline-flex items-center gap-1">
                <Camera className="h-4 w-4" />
                {avatarUploading ? "Uploading..." : "Change Photo"}
              </span>
            </button>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
              onClick={handleIdUploadClick}
              disabled={idUploading || loading}
            >
              {idUploading ? "Uploading..." : "Upload ID"}
            </button>
            {idDocs.length > 0 ? (
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                onClick={() => void handleOpenLatestId()}
              >
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  View Latest ID
                </span>
              </button>
            ) : null}
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
          />
          <input
            ref={idInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleIdFileChange}
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Full Name</p>
              <input
                className="mt-2 w-full rounded border bg-background px-3 py-2 text-sm"
                value={profile.name}
                onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Phone</p>
              <input
                className="mt-2 w-full rounded border bg-background px-3 py-2 text-sm"
                value={profile.phone}
                onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="+977-..."
              />
            </label>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Email</p>
              <p className="mt-2 flex items-center gap-2 font-medium text-foreground">
                <Mail className="h-4 w-4 text-primary" />
                {profile.email || "admin@example.com"}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Role</p>
              <p className="mt-2 font-medium capitalize text-foreground">{profile.role || "admin"}</p>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
              onClick={() => void handleSave()}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Security</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-4">
              <div>
                <p className="font-medium text-foreground">Two-factor authentication</p>
                <p className="text-sm text-muted-foreground">Enabled via authenticator app.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="font-medium text-foreground">Password</p>
              <p className="text-sm text-muted-foreground">Last updated 30 days ago.</p>
              <button className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
                Update Password
              </button>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="font-medium text-foreground">Uploaded IDs</p>
              <p className="text-sm text-muted-foreground">
                {idDocs.length} document(s) uploaded.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                You can also review all IDs in <Link className="text-primary underline" to="/admin/file-vault">File Vault</Link> using kind `id_doc`.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="font-medium text-foreground">Contact</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 text-primary" />
                {profile.phone || settings.contact.phone || "+000 000-0000"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
