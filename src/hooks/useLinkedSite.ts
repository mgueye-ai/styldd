import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteData } from '../context/SiteDataContext';
import { LinkedSite, resolveLinkedSite } from '../lib/linkedSites';

export function useLinkedSite(): LinkedSite | null {
  const { user, profile } = useAuth();
  const { linkedSite } = useSiteData();

  return useMemo(
    () =>
      resolveLinkedSite(
        linkedSite,
        user?.id,
        profile?.business_name ?? profile?.full_name,
      ),
    [linkedSite, user?.id, profile?.business_name, profile?.full_name],
  );
}
