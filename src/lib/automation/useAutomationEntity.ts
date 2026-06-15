'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/** Entity id from URL (/nucleo/[entityId]/...) with AuthContext fallback. */
export function useAutomationEntity() {
  const params = useParams();
  const { currentUser, activeEntity, loading: authLoading } = useAuth();

  const entityId =
    (typeof params?.entityId === 'string' ? params.entityId : null) ||
    activeEntity ||
    '';

  const isReady = !authLoading && !!currentUser && !!entityId;

  return {
    currentUser,
    entityId,
    authLoading,
    isReady,
  };
}
