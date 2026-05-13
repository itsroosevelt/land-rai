'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function CTORedirect() {
    const router = useRouter();
    const params = useParams();
    useEffect(() => {
        router.replace(`/nucleo/${params.entityId}/workspace?role=cto`);
    }, [router, params.entityId]);
    return null;
}
