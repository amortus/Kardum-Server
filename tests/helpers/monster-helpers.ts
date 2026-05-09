/**
 * Helpers pra criar MonsterRuntimeState fake e acessar internals do service
 * sem precisar de banco. Usado por unit/regression tests.
 */
import type { MonsterRuntimeState } from '../../src/shared/types';

export function makeMonster(overrides: Partial<MonsterRuntimeState> = {}): MonsterRuntimeState {
  return {
    spawn_uid: 'spawn_test0001',
    template_id: 1,
    template_name: 'Zombie',
    zone: 'shadowland',
    x: 100,
    y: 100,
    spawn_x: 100,
    spawn_y: 100,
    move_radius: 120,
    respawn_seconds: 60,
    status: 'alive',
    engaged_by_user_id: null,
    next_respawn_at: null,
    difficulty: 'normal' as any,
    deck_id: 1,
    sprite_ref: null,
    visual: null,
    ...overrides,
  };
}
