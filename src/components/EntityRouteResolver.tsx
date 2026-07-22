'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  getEntityRouteSegment,
  resolveEntityFromSegment,
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    if (!segment) {
      router.replace('/nucleo');
      return;
    }

    setReady(false);
    const unsub = onSnapshot(
      collection(db, `users/${currentUser.uid}/entities`),
      (snapshot) => {
        const entities: EntitySlugRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          slug: d.data().slug,
        }));

        const resolved = resolveEntityFromSegment(entities, segment);
        if (!resolved) {
          router.replace('/nucleo');
          return;
        }

        const routeSegment = getEntityRouteSegment(resolved);
        setActiveEntity(resolved.id, routeSegment);

        if (segment !== routeSegment && pathname?.startsWith(`/nucleo/${segment}`)) {
          const rest = pathname.slice(`/nucleo/${segment}`.length);
          router.replace(`/nucleo/${routeSegment}${rest}`);
          return;
        }

        setReady(true);
      },
      (error) => {
        console.error('[EntityRouteResolver]', error);
        router.replace('/nucleo');
      }
    );

    return () => unsub();
  }, [currentUser, loading, segment, pathname, router, setActiveEntity]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/40 text-sm tracking-widest uppercase">
        Cargando entidad...
      </div>
    );
  }

  return <>{children}</>;
}
