'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NucleoRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/home');
    }, [router]);

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center text-xs text-white/40 tracking-widest uppercase">
            Redirigiendo a Home...
        </div>
    );
}
