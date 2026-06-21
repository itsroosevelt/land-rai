import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { moveCardBetweenGroups } from '@/lib/kanban/moveCardClient';
import { useAuth } from '@/contexts/AuthContext';

export const useKanbanBoard = (filterTerm: string = '') => {
    const { currentUser, activeEntity } = useAuth();
    const [groups, setGroups] = useState<any[]>([]);
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Get multi-tenant root path
    const getTenantPath = () => {
        if (!currentUser?.uid || !activeEntity) return null;
        return `users/${currentUser.uid}/entities/${activeEntity}`;
    };

    // Load Groups
    useEffect(() => {
        const tenantPath = getTenantPath();
        if (!tenantPath) return;

        const q = query(collection(db, `${tenantPath}/kanban-groups`), orderBy('order', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const groupsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setGroups(groupsData);
        });
        return () => unsubscribe();
    }, []);

    // Load Cards
    useEffect(() => {
        const tenantPath = getTenantPath();
        if (!tenantPath || groups.length === 0) {
            setLoading(false);
            return;
        }

        const unsubscribes: (() => void)[] = [];

        // Track cards by ID to prevent flicker and race conditions
        const cardRegistry = new Map<string, any>();

        groups.forEach(group => {
            const q = query(collection(db, `${tenantPath}/kanban-groups/${group.id}/cards`));
            const unsub = onSnapshot(q, (snapshot) => {
                snapshot.docs.forEach(doc => {
                    console.log(`[useKanbanBoard] 🎴 Found Card: ${doc.id} at Path: ${doc.ref.path}`);
                    cardRegistry.set(doc.id, {
                        id: doc.id,
                        groupId: group.id,
                        ...doc.data()
                    });
                });

                // Handle deletions: if a card is not in current group snapshot but was in registry with this groupId, remove it
                // (Unless it was moved to another group, which will be handled by its own snapshot)
                const currentIds = new Set(snapshot.docs.map(d => d.id));
                cardRegistry.forEach((card, id) => {
                    if (card.groupId === group.id && !currentIds.has(id)) {
                        cardRegistry.delete(id);
                    }
                });

                setCards(Array.from(cardRegistry.values()));
                setLoading(false);
            });
            unsubscribes.push(unsub);
        });

        return () => unsubscribes.forEach(u => u());
    }, [groups, currentUser?.uid, activeEntity]);

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        const movedCard = cards.find(c => c.id === activeId);
        if (!movedCard) return;

        const sourceGroupId = movedCard.groupId;
        const tenantPath = getTenantPath();
        if (!tenantPath || !currentUser?.uid) return;

        let destGroupId = overId;
        const isOverGroup = groups.some(g => g.id === overId);
        if (!isOverGroup) {
            const overCard = cards.find(c => c.id === overId);
            if (overCard) destGroupId = overCard.groupId;
            else return;
        }

        if (sourceGroupId === destGroupId) return;

        setCards(prev => prev.map(c =>
            c.id === activeId ? { ...c, groupId: destGroupId } : c
        ));

        const destGroup = groups.find(g => g.id === destGroupId);

        try {
            await moveCardBetweenGroups({
                tenantPath,
                cardId: activeId,
                sourceGroupId,
                destGroupId,
                destGroupName: destGroup?.name,
                authorName: currentUser.displayName || 'Usuario',
            });
            toast.success(`Movido a ${destGroup?.name || 'grupo'}`);
        } catch (error) {
            console.error('Move failed', error);
            toast.error('Error al mover');
            setCards(prev => prev.map(c =>
                c.id === activeId ? { ...c, groupId: sourceGroupId } : c
            ));
        }
    };

    const handleUpdateColor = async (groupId: string, color: string) => {
        try {
            const tenantPath = getTenantPath();
            if (!tenantPath) return;

            await updateDoc(doc(db, `${tenantPath}/kanban-groups/${groupId}`), { color });
        } catch (error) {
            console.error('Error updating color:', error);
            toast.error('Error al cambiar el color.');
        }
    };

    return {
        groups,
        cards,
        loading,
        handleDragEnd,
        handleUpdateColor,
        setCards
    };
};

