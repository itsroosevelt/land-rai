'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  EntityRouteProvider,
  type EntityRouteContextValue,
} from '@/contexts/EntityRouteContext';
import { db } from '@/lib/firebase';
import {
  getEntityRouteSegment,
  resolveEntityFromSegmentWithIndex,
  type EntitySlugRecord,
} from '@/lib/entitySlug';

interface EntityRouteResolverProps {
  segment: string;
  children: React.ReactNode;
}

export function EntityRouteResolver({ segment, children }: EntityRouteResolverProps) {
  const { currentUser, loading, setActiveEntity } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [ready, setReady] = useState(false);
  const [routeContext, setRouteContext] = useState<EntityRouteContextValue | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    setReady(false);
    setRouteContext(null);
  }, [segment]);

  useEffect(() => {
    if (loading) return;
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    if (!segment) {
      router.replace('/home');
      return;
    }

    let cancelled = false;
    const unsub = onSnapshot(
      collection(db, `users/${currentUser.uid}/entities`),
      (snapshot) => {
        if (cancelled) return;

        const entities: EntitySlugRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          slug: d.data().slug,
        }));

        void (async () => {
          const resolved = await resolveEntityFromSegmentWithIndex(
            currentUser.uid,
            entities,
            segment
          );

          if (cancelled) return;

          if (!resolved) {
            router.replace('/home');
            return;
          }

          const docData = snapshot.docs.find((d) => d.id === resolved.id)?.data();
          const entityType = docData?.type || (resolved as any).type;

          const routeSegment = getEntityRouteSegment(resolved);
          const contextValue: EntityRouteContextValue = {
            firestoreId: resolved.id,
            routeSegment,
            entityName: resolved.name,
            entityType,
          };

          setActiveEntity(resolved.id, routeSegment);
          setRouteContext(contextValue);

          const currentPath = pathnameRef.current;
          if (segment !== routeSegment && (currentPath?.startsWith(`/home/${segment}`) || currentPath?.startsWith(`/nucleo/${segment}`))) {
            const prefix = currentPath.startsWith(`/home/${segment}`) ? `/home/${segment}` : `/nucleo/${segment}`;
            const rest = currentPath.slice(prefix.length);
            router.replace(`/home/${routeSegment}${rest}`);
            return;
          }

          // Verify if this entity has an active subscription (Personal is free and exempt)
          const isPersonal = docData?.type === 'persona';

          if (!isPersonal) {
            const isEntityUnlocked = typeof window !== 'undefined' && localStorage.getItem('roosevelt_entity_unlocked_' + resolved.id) === 'roosevelt2025';
            if (!isEntityUnlocked) {
              try {
                const subRef = doc(db, `users/${currentUser.uid}/entities/${resolved.id}/subscriptions/current`);
                const subSnap = await getDoc(subRef);
                const data = subSnap.exists() ? subSnap.data() : null;
                const isExpired = data?.expiresAt ? new Date(data.expiresAt) < new Date() : false;
                const isActive = data?.status === 'active' && !isExpired;
                if (!isActive) {
                  const targetRedirect = currentPath || `/home/${routeSegment}`;
                  router.replace(`/subscriptions?entityId=${resolved.id}&redirect=${encodeURIComponent(targetRedirect)}`);
                  return;
                }
              } catch (subErr) {
                console.error('[EntityRouteResolver] Error checking subscription:', subErr);
              }
            }
          }

          setReady(true);
        })();
      },
      (error) => {
        console.error('[EntityRouteResolver]', error);
        router.replace('/home');
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [currentUser, loading, segment, router, setActiveEntity]);

  if (!ready || !routeContext) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/40 text-sm tracking-widest uppercase">
        Cargando entidad...
      </div>
    );
  }

  return (
    <EntityRouteProvider value={routeContext}>
      {children}
    </EntityRouteProvider>
  );
}
