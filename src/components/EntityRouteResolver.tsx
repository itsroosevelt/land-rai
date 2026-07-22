'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  const pathnameRef = useRef(pathname);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    setReady(false);
  }, [segment]);

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

        const resolved = resolveEntityFromSegment(entities, segment);
        if (!resolved) {
          router.replace('/nucleo');
          return;
        }

        const routeSegment = getEntityRouteSegment(resolved);
        setActiveEntity(resolved.id, routeSegment);

        const currentPath = pathnameRef.current;
        if (segment !== routeSegment && currentPath?.startsWith(`/nucleo/${segment}`)) {
          const rest = currentPath.slice(`/nucleo/${segment}`.length);
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

    return () => {
      cancelled = true;
      unsub();
    };
  }, [currentUser, loading, segment, router, setActiveEntity]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/40 text-sm tracking-widest uppercase">
        Cargando entidad...
      </div>
    );
  }

  return <>{children}</>;
}
