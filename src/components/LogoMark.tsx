import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/components/SiteSettingsProvider";

interface LogoMarkProps {
  className?: string;
}

export default function LogoMark({ className }: LogoMarkProps) {
  const { settings } = useSiteSettings();
  const { resolvedTheme } = useTheme();
  const preferredLogo =
    resolvedTheme === "dark"
      ? settings.branding.logoDark || settings.branding.logoLight
      : settings.branding.logoLight || settings.branding.logoDark;

  return (
    <img
      src={preferredLogo || "/placeholder.svg"}
      alt={settings.branding.siteName}
      className={cn("h-8 w-8 object-contain", className)}
    />
  );
}
