"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOSEVELT_API_BASE = exports.FUNCTIONS_REGION = void 0;
/** Cloud Functions region — Salt Lake City (closest to Roosevelt HQ). */
exports.FUNCTIONS_REGION = 'us-west3';
/** Primary Next.js API (Vercel). Webhooks and bot engine run here. */
exports.ROOSEVELT_API_BASE = process.env.ROOSEVELT_API_BASE || 'https://www.byroosevelt.com';
//# sourceMappingURL=config.js.map