'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { provisionEntityMold } from '@/lib/mold/entityMold';

import { usePathname } from 'next/navigation';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    activeEntity: string | null;
    setActiveEntity: (entity: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    loading: true,
    activeEntity: null,
    setActiveEntity: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeEntity, setActiveEntity] = useState<string | null>(null);
    const pathname = usePathname();

    useEffect(() => {
        const parts = pathname?.split('/') || [];
        // Example: /nucleo/life -> parts = ["", "nucleo", "life"]
        if (parts.length >= 3 && parts[1] === 'nucleo') {
            const entityUrl = parts[2];
            setActiveEntity(entityUrl);
            localStorage.setItem('roosevelt_active_entity', entityUrl);
        } else {
            const saved = localStorage.getItem('roosevelt_active_entity');
            if (saved) {
                setActiveEntity(saved);
            } else {
                setActiveEntity('life');
            }
        }
    }, [pathname]);

    useEffect(() => {
        try {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    try {
                        const userDocRef = doc(db, 'users', user.uid);
                        const docSnap = await getDoc(userDocRef);
                        if (!docSnap.exists()) {
                            // 1. Root Document
                            await setDoc(userDocRef, {
                                name: user.displayName || 'Unnamed User',
                                email: user.email,
                                createdAt: new Date(),
                                lastLogin: new Date()
                            });
                            
                            const randomCompanyId = `company_${Math.random().toString(36).substring(2, 9)}`;

                            // 2. Seed Entities ('life', and one dynamic company)
                            const initialEntities = [
                                { id: 'life', name: 'Personal', desc: 'Personal OS', type: 'persona' },
                                { id: randomCompanyId, name: 'Mi Primera Empresa', desc: 'Business OS', type: 'empresa' }
                            ];

                            // Seed entities and settings in parallel
                            await Promise.all(initialEntities.map(async (entity) => {
                                await Promise.all([
                                    setDoc(doc(db, `users/${user.uid}/entities/${entity.id}`), {
                                        initialized: true,
                                        name: entity.name,
                                        type: entity.type,
                                        description: entity.desc,
                                        createdAt: new Date()
                                    }),
                                    setDoc(doc(db, `users/${user.uid}/entities/${entity.id}/settings/general`), {
                                        theme: 'dark'
                                    }),
                                    setDoc(doc(db, `users/${user.uid}/entities/${entity.id}/integrations/_init`), {
                                        encrypted: false,
                                        updatedAt: new Date()
                                    })
                                ]);
                                await provisionEntityMold(db, user.uid, entity.id);
                            }));
                        } else {
                            // If user already exists, only update their last login
                            await updateDoc(userDocRef, {
                                lastLogin: new Date()
                            });
                        }
                    } catch (error) {
                        console.error("Error creating isolated user document:", error);
                    }
                }
                setCurrentUser(user);
                setLoading(false);
            });
            return unsubscribe;
        } catch (err) {
            console.error("AuthContext: Error in onAuthStateChanged setup:", err);
            setLoading(false);
        }
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, loading, activeEntity, setActiveEntity }}>
            {children}
        </AuthContext.Provider>
    );
};

