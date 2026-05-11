'use client';

export default function CFOLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-black min-h-screen font-sans relative">
            <main className="w-full h-screen overflow-hidden">
                {children}
            </main>
        </div>
    );
}
