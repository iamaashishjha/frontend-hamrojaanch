import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/components/SiteSettingsProvider";

interface BrandTextProps {
  className?: string;
}

export default function BrandText({ className }: BrandTextProps) {
  const { settings } = useSiteSettings();
  return <span className={cn(className)}>{settings.branding.siteName}</span>;
}
