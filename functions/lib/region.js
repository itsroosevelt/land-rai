"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regionalFunctions = void 0;
const functions = require("firebase-functions");
const config_1 = require("./config");
exports.regionalFunctions = functions.region(config_1.FUNCTIONS_REGION);
//# sourceMappingURL=region.js.map