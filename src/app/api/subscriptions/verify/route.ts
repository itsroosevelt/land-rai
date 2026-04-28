import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { db } from '@/lib/firebase-admin';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET;

export async function POST(request: NextRequest) {
  try {
    const { signature, plan, paymentMethod, userId, entityId, planPrice, billingData } = await request.json();

    if (!signature || !plan || !paymentMethod || !userId || !entityId || !planPrice) {
      return NextResponse.json(
        { error: 'Missing required fields (signature, plan, paymentMethod, userId, entityId, planPrice)' },
        { status: 400 }
      );
    }

    if (!TREASURY_WALLET) {
      return NextResponse.json(
        { error: 'Treasury wallet not configured' },
        { status: 500 }
      );
    }

    // Verify transaction on Solana blockchain
    const connection = new Connection(RPC_URL, 'confirmed');
    const transaction = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify the transaction went to the treasury wallet
    const treasuryPublicKey = new PublicKey(TREASURY_WALLET);
    const transactionAccounts = transaction.transaction.message.getAccountKeys();
    const hasValidDestination = transactionAccounts.staticAccountKeys.some(
      (key) => key.toString() === treasuryPublicKey.toString()
    );

    if (!hasValidDestination) {
      return NextResponse.json(
        { error: 'Transaction destination invalid' },
        { status: 400 }
      );
    }

    // Calculate expiration date (30 days from now)
    const activatedAt = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Save subscription to Firestore (respecting Molde Maestro multi-tenant structure)
    await db.doc(`users/${userId}/entities/${entityId}/subscriptions/current`).set(
      {
        status: 'active',
        plan: plan,
        priceUSD: planPrice,
        paymentMethod: paymentMethod,
        paymentSignature: signature,
        activatedAt: activatedAt,
        expiresAt: expiresAt.toISOString(),
        updatedAt: activatedAt,
        ...(billingData && { billing: billingData }),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: {
        status: 'active',
        plan: plan,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[API] subscriptions/verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Error verifying subscription' },
      { status: 500 }
    );
  }
}
