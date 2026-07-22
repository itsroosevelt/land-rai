'use client';

import { useAuth } from '@/contexts/AuthContext';
import { buildEntityPath } from '@/lib/entitySlug';

/** Resolved entity: doc id for Firestore, route segment for URLs. */
export function useEntityRoute() {
  const { activeEntity, activeEntityRoute } = useAuth();
  const entityId = activeEntity || '';
  const routeSegment = activeEntityRoute || activeEntity || '';

  return {
    entityId,
    routeSegment,
    entityPath: (suffix = '') => buildEntityPath(routeSegment, suffix),
  };
}
