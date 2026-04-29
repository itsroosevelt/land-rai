import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const { phoneNumberId, userId, entityId } = await req.json();

        if (!phoneNumberId) {
            return NextResponse.json({ valid: false, message: 'Falta el Phone ID.' });
        }

        // Rule 4 & 7: Paranoid search across all possible integration collection groups
        const collectionsToCheck = ['integrations', 'whatsapp_internal', 'whatsapp-integrations'];
        const fieldsToCheck = ['phoneNumberId', 'phone_number_id', 'id', 'wabaId'];
        
        const numericId = Number(phoneNumberId);
        const stringId = String(phoneNumberId);

        for (const collName of collectionsToCheck) {
            for (const fieldName of fieldsToCheck) {
                // Check for both String and Number types to avoid Firestore type-mismatch misses
                const queries = [
                    db.collectionGroup(collName).where(fieldName, '==', stringId).get()
                ];
                
                if (!isNaN(numericId)) {
                    queries.push(db.collectionGroup(collName).where(fieldName, '==', numericId).get());
                }

                const results = await Promise.all(queries);

                for (const snap of results) {
                    if (!snap.empty) {
                        for (const doc of snap.docs) {
                            const pathParts = doc.ref.path.split('/');
                            const uIdx = pathParts.indexOf('users');
                            const eIdx = pathParts.indexOf('entities');
                            
                            // BLOCK if it's a different tenant OR if it's in a root collection (Rule 7 violation)
                            if (uIdx === -1 || eIdx === -1 || pathParts[uIdx + 1] !== userId || pathParts[eIdx + 1] !== entityId) {
                                console.log(`[Validation] ❌ CRITICAL: Duplicate found in ${doc.ref.path} (Field: ${fieldName})`);
                                return NextResponse.json({ 
                                    valid: false, 
                                    message: `ERROR CRÍTICO: Este número ya está en uso por otra empresa (${pathParts[uIdx + 1] || 'Sistema Global'}). No se permite la vinculación duplicada.` 
                                });
                            }
                        }
                    }
                }
            }
        }

        console.log(`[Validation] ✅ Phone ID ${phoneNumberId} is valid for User: ${userId}, Entity: ${entityId}`);
        return NextResponse.json({ valid: true });

    } catch (error: any) {
        console.error('[Validation API Error]:\n\n====================\nAtención! Copia este error (incluyendo el link si lo hay):\n', error.message, '\n====================\n');
        // Devolvemos 200 para que NextJS no intercepte el 500 con un HTML de error y el frontend pueda leer el JSON.
        return NextResponse.json({ 
            valid: false, 
            message: error.message.includes('index') 
                ? 'Firebase requiere un "Índice (Index)" para validar este número. Revisa la terminal (consola negra) abajo donde corre "npm run dev", y haz clic en el link que Firebase generó para crearlo automáticamente.'
                : error.message 
        }, { status: 200 }); // Status 200 para forzar a la UI a mostrar el mensaje real
    }
}
