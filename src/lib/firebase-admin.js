"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin = exports.auth = exports.db = void 0;
var admin = __importStar(require("firebase-admin"));
exports.admin = admin;
var path = __importStar(require("path"));
var fs = __importStar(require("fs"));
// Patrón Singleton para evitar múltiples inicializaciones
if (!admin.apps.length) {
    try {
        var projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        var serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        var serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
        var possiblePaths = [
            path.join(process.cwd(), 'serviceAccountKey.json'),
            path.join(__dirname, '..', '..', '..', 'serviceAccountKey.json'),
        ];
        var serviceAccountPath = possiblePaths.find(function (p) { return fs.existsSync(p); });
        var initialized = false;
        // Bypasses all Vercel UI formatting issues completely
        if (serviceAccountBase64) {
            try {
                var decodedToken = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
                var parsedServiceAccount = JSON.parse(decodedToken);
                // Ensure project_id exactly as other methods
                if (!parsedServiceAccount.project_id) {
                    parsedServiceAccount.project_id = projectId || process.env.FIREBASE_PROJECT_ID;
                }
                admin.initializeApp({
                    credential: admin.credential.cert(parsedServiceAccount),
                    projectId: projectId
                });
                console.log("[Firebase Admin] \uD83C\uDFC6 SUCCESS: Initialized from BASE64 ENV (Ultra-Safe Mode).");
                initialized = true;
            }
            catch (b64Err) {
                console.error('[Firebase Admin] ❌ Error initializing from BASE64 ENV:', b64Err.message);
            }
        }
        if (!initialized && serviceAccountEnv) {
            try {
                // Remove possible wrapping quotes (handles some OS/env issues)
                var cleanedEnv = serviceAccountEnv.trim();
                while ((cleanedEnv.startsWith("'") && cleanedEnv.endsWith("'")) ||
                    (cleanedEnv.startsWith('"') && cleanedEnv.endsWith('"'))) {
                    cleanedEnv = cleanedEnv.slice(1, -1);
                }
                var parsedServiceAccount = void 0;
                try {
                    // Strategy 1: Standard JSON parsing
                    parsedServiceAccount = JSON.parse(cleanedEnv);
                    // Strategy 2: SUPER PEM CLEANER (AFTER PARSING)
                    // Vercel/CI environment variables are notorious for escape issues (\n, \\n, or literal breaks)
                    if (parsedServiceAccount.private_key && typeof parsedServiceAccount.private_key === 'string') {
                        var key = parsedServiceAccount.private_key;
                        // Rule A: Remove any wrapping quotes that survived JSON.parse (rare but happens in some shells)
                        key = key.trim().replace(/^['"]|['"]$/g, '');
                        // Rule B: Unescape any literal \n sequences. Use a loop to handle multiple escapes like \\n
                        while (key.includes('\\n')) {
                            key = key.replace(/\\n/g, '\n');
                        }
                        // Rule C: Ensure standard PEM format (headers/footers must be on their own lines)
                        // If it's a single line, we must wrap it correctly
                        if (!key.includes('\n') && key.includes('-----BEGIN PRIVATE KEY-----')) {
                            key = key.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
                                .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
                        }
                        parsedServiceAccount.private_key = key;
                    }
                }
                catch (firstErr) {
                    // Fallback Strategy: If Vercel has somehow mangled the whole string (rare)
                    console.warn('[Firebase Admin] 🟡 ENV is not valid JSON, trying emergency unescape.');
                    var fixedRaw = cleanedEnv.replace(/\\n/g, '\n');
                    parsedServiceAccount = JSON.parse(fixedRaw);
                }
                // Ensure project_id is present because cert() absolutely requires it
                if (!parsedServiceAccount.project_id) {
                    parsedServiceAccount.project_id = projectId;
                }
                // Ensure project_id is present because cert() absolutely requires it
                if (!parsedServiceAccount.project_id) {
                    parsedServiceAccount.project_id = projectId || process.env.FIREBASE_PROJECT_ID;
                }
                if (!parsedServiceAccount.project_id) {
                    console.warn('[Firebase Admin] ⚠️ WARNING: No project_id found in service account object or environment. This may cause cert() to fail.');
                }
                admin.initializeApp({
                    credential: admin.credential.cert(parsedServiceAccount),
                    projectId: projectId
                });
                console.log("[Firebase Admin] \u2705 SUCCESS: Initialized from ENV.");
                initialized = true;
            }
            catch (jsonError) {
                console.error('[Firebase Admin] ❌ Error initializing from ENV (Is the object malformed?):', jsonError.message);
                // Do not throw here, fallback to next strategy
            }
        }
        if (!initialized && serviceAccountPath) {
            try {
                var serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    projectId: projectId
                });
                console.log("[Firebase Admin] \u2705 SUCCESS: Initialized from file (".concat(serviceAccountPath, ")."));
                initialized = true;
            }
            catch (fileErr) {
                console.error('[Firebase Admin] ❌ Error loading from serviceAccountKey.json:', fileErr.message);
            }
        }
        if (!initialized) {
            admin.initializeApp({ projectId: projectId });
            console.log("[Firebase Admin] Initialized with default credentials (ADC).");
        }
    }
    catch (error) {
        console.error('[Firebase Admin] ❌ CRITICAL ERROR:', error.message);
    }
}
// Exportar instancias directas
exports.db = admin.firestore();
exports.auth = admin.auth();
