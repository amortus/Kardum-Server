import npcRepository from './npc.repository';
import questService from '../quests/quest.service';

class NpcService {
  async listTemplates() {
    return npcRepository.listTemplates();
  }

  async createTemplate(payload: {
    code: string;
    name: string;
    sprite_ref: string;
    frame_count?: number;
    frame_cols?: number;
    frame_rows?: number;
    idle_start?: number;
    idle_count?: number;
    dialogue_json?: string | null;
  }) {
    return npcRepository.createTemplate(payload);
  }

  async updateTemplate(
    templateId: number,
    payload: Partial<{
      code: string;
      name: string;
      sprite_ref: string;
      frame_count: number;
      frame_cols: number;
      frame_rows: number;
      idle_start: number;
      idle_count: number;
      dialogue_json: string | null;
      is_active: boolean;
    }>
  ) {
    await npcRepository.updateTemplate(templateId, payload);
  }

  async listZoneSpawns(zone: string) {
    const [spawns, templates] = await Promise.all([
      npcRepository.listSpawns(zone),
      npcRepository.listTemplates()
    ]);
    const templateById = new Map<number, (typeof templates)[number]>();
    templates.forEach((template) => templateById.set(template.id, template));
    return spawns
      .map((spawn) => {
        const template = templateById.get(spawn.npc_template_id);
        if (!template) return null;
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

  async createSpawn(payload: {
    npc_template_id: number;
    zone: string;
    spawn_x: number;
    spawn_y: number;
    interaction_radius?: number;
  }) {
    return npcRepository.createSpawn(payload);
  }

  async updateSpawn(
    spawnUid: string,
    payload: Partial<{
      npc_template_id: number;
      zone: string;
      spawn_x: number;
      spawn_y: number;
      interaction_radius: number;
      is_active: boolean;
    }>
  ) {
    await npcRepository.updateSpawn(spawnUid, payload);
  }

  async removeSpawn(spawnUid: string) {
    await npcRepository.removeSpawn(spawnUid);
  }

  async interactWithNpc(userId: number, npcTemplateId: number): Promise<void> {
    await questService.onNpcTalk(userId, npcTemplateId);
  }

  private parseDialogue(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((line) => String(line));
      }
      return [];
    } catch {
      return [];
    }
  }
}

export default new NpcService();
