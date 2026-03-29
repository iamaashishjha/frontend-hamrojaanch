import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getStoredUser, logout } from "@/lib/auth-api";
import { resolveApiAssetUrl } from "@/lib/file-vault-api";

/**
 * Display name from user: "First Last" → "First L." or fallback "Student".
 */
function displayName(name: string | null | undefined): string {
  if (!name?.trim()) return "Student";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function StudentNavUser() {
  const user = getStoredUser();
  const name = displayName(user?.name);
  const avatarSrc = user?.avatarUrl ? resolveApiAssetUrl(user.avatarUrl) : null;
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarSrc]);

  const handleLogout = () => {
    logout("/auth");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="profile-pill student-nav-user-trigger"
          aria-label="Account menu"
        >
          <div className="profile-avatar">
            {avatarSrc && !avatarLoadFailed ? (
              <img
                src={avatarSrc}
                alt={`${name} avatar`}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <User size={18} />
            )}
          </div>
          <div>
            <strong>{name}</strong>
            <span>Student</span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to="/student-profile">My Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleLogout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
