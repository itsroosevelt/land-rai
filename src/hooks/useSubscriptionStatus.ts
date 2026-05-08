'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SubscriptionData {
  status: 'active' | 'pending' | 'expired' | null;
  plan: string | null;
  expiresAt: string | null;
  isExpired: boolean;
}

export function useSubscriptionStatus(): SubscriptionData & { loading: boolean } {
  const { currentUser, activeEntity } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    status: null,
    plan: null,
    expiresAt: null,
    isExpired: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!currentUser || !activeEntity) {
        setLoading(false);
        return;
      }

      try {
        // Check subscription in user's active entity
        const subscriptionRef = doc(
          db,
          `users/${currentUser.uid}/entities/${activeEntity}/subscriptions/current`
        );
        const docSnap = await getDoc(subscriptionRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
          const isExpired = expiresAt ? expiresAt < new Date() : false;

          setSubscriptionData({
            status: data.status || null,
            plan: data.plan || null,
            expiresAt: data.expiresAt || null,
            isExpired,
          });
        } else {
          setSubscriptionData({
            status: null,
            plan: null,
            expiresAt: null,
            isExpired: false,
          });
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setSubscriptionData({
          status: null,
          plan: null,
          expiresAt: null,
          isExpired: false,
        });
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [currentUser, activeEntity]);

  return { ...subscriptionData, loading };
}
