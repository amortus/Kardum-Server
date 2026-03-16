"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const npc_repository_1 = __importDefault(require("./npc.repository"));
const quest_service_1 = __importDefault(require("../quests/quest.service"));
class NpcService {
    async listTemplates() {
        return npc_repository_1.default.listTemplates();
    }
    async createTemplate(payload) {
        return npc_repository_1.default.createTemplate(payload);
    }
    async updateTemplate(templateId, payload) {
        await npc_repository_1.default.updateTemplate(templateId, payload);
    }
    async listZoneSpawns(zone) {
        const [spawns, templates] = await Promise.all([
            npc_repository_1.default.listSpawns(zone),
            npc_repository_1.default.listTemplates()
        ]);
        const templateById = new Map();
        templates.forEach((template) => templateById.set(template.id, template));
        return spawns
            .map((spawn) => {
            const template = templateById.get(spawn.npc_template_id);
            if (!template)
                return null;
            return {
                spawn_uid: spawn.spawn_uid,
                npc_template_id: spawn.npc_template_id,
                zone: spawn.zone,
                x: spawn.spawn_x,
                y: spawn.spawn_y,
                interaction_radius: spawn.interaction_radius,
                template: {
                    id: template.id,
                    code: template.code,
                    name: template.name,
                    sprite_ref: template.sprite_ref,
                    frame_count: template.frame_count,
                    frame_cols: template.frame_cols,
                    frame_rows: template.frame_rows,
                    idle_start: template.idle_start,
                    idle_count: template.idle_count,
                    dialogue: this.parseDialogue(template.dialogue_json)
                }
            };
        })
            .filter((entry) => entry !== null);
    }
    async createSpawn(payload) {
        return npc_repository_1.default.createSpawn(payload);
    }
    async updateSpawn(spawnUid, payload) {
        await npc_repository_1.default.updateSpawn(spawnUid, payload);
    }
    async removeSpawn(spawnUid) {
        await npc_repository_1.default.removeSpawn(spawnUid);
    }
    async interactWithNpc(userId, npcTemplateId) {
        await quest_service_1.default.onNpcTalk(userId, npcTemplateId);
    }
    parseDialogue(value) {
        if (!value)
            return [];
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((line) => String(line));
            }
            return [];
        }
        catch {
            return [];
        }
    }
}
exports.default = new NpcService();
//# sourceMappingURL=npc.service.js.map