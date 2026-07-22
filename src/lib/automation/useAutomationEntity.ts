'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/** Entity doc id (Firestore). Prefer AuthContext over raw URL segment (may be slug). */
export function useAutomationEntity() {
  const params = useParams();
  const { currentUser, activeEntity, loading: authLoading } = useAuth();

  const entityId = activeEntity ||
    (typeof params?.entityId === 'string' ? params.entityId : '') ||
    '';

  const isReady = !authLoading && !!currentUser && !!entityId;

  return {
    currentUser,
    entityId,
    authLoading,
    isReady,
  };
}
