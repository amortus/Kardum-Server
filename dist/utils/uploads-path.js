"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUploadsCandidates = getUploadsCandidates;
exports.resolveReadableUploadsDir = resolveReadableUploadsDir;
exports.resolveCardImagesDir = resolveCardImagesDir;
exports.resolveCardBasesDir = resolveCardBasesDir;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function unique(paths) {
    const out = [];
    const seen = new Set();
    for (const p of paths) {
        const normalized = path_1.default.resolve(p);
        if (seen.has(normalized))
            continue;
        seen.add(normalized);
        out.push(normalized);
    }
    return out;
}
function getUploadsCandidates() {
    const fromEnv = (process.env.UPLOADS_DIR || '').trim();
    const cwd = process.cwd();
    const __dirnameCandidate = path_1.default.resolve(__dirname, '..', '..');
    return unique([
        fromEnv,
        path_1.default.join(cwd, 'uploads'),
        path_1.default.join(cwd, 'storage', 'uploads'),
        path_1.default.join(__dirnameCandidate, 'uploads')
    ].filter((p) => p && p.length > 0));
}
function resolveReadableUploadsDir() {
    const candidates = getUploadsCandidates();
    for (const candidate of candidates) {
        if (!fs_1.default.existsSync(candidate))
            continue;
        try {
            const stat = fs_1.default.statSync(candidate);
            if (stat.isDirectory())
                return candidate;
        }
        catch {
            // Ignore inaccessible path and keep searching.
        }
    }
    return candidates[0] || path_1.default.join(process.cwd(), 'uploads');
}
function resolveCardImagesDir() {
    return path_1.default.join(resolveReadableUploadsDir(), 'card_images');
}
function resolveCardBasesDir() {
    return path_1.default.join(resolveReadableUploadsDir(), 'card_bases');
}
//# sourceMappingURL=uploads-path.js.map