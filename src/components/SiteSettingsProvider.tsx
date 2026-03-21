import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicSiteSettings } from "@/lib/site-settings-api";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings-types";
import { API_BASE } from "@/lib/apiClient";

interface SiteSettingsContextValue {
  settings: SiteSettings;
  isLoading: boolean;
  refresh: () => void;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["site-settings", API_BASE],
    queryFn: async () => {
      if (!API_BASE) return DEFAULT_SITE_SETTINGS;
      try {
        return await getPublicSiteSettings();
      } catch {
        // Backend down or wrong URL — never throw; use defaults so the app still loads
        return DEFAULT_SITE_SETTINGS;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    // Show UI immediately; use defaults when backend is down or no API URL
    placeholderData: DEFAULT_SITE_SETTINGS,
    initialData: DEFAULT_SITE_SETTINGS,
  });

  const settings = query.data ?? DEFAULT_SITE_SETTINGS;

  return (
    <SiteSettingsContext.Provider
      value={{
        settings,
        isLoading: query.isLoading,
        refresh: () => void query.refetch(),
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  }
  return context;
}
