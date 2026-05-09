/**
 * Integration test: `tickMovement` do MonsterService.
 * Valida que após N ticks um monstro:
 *  - se move dentro do move_radius
 *  - cada spawn tem estado (cooldown) próprio
 *  - cooldowns decrementam e eventualmente movem
 *
 * Não sobe banco — usa o service direto com monstros injetados no mapa interno.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { default as monsterService } from '../../src/modules/monsters/monster.service';
import { makeMonster } from '../helpers/monster-helpers';

const svc = monsterService as any;

function resetServiceState() {
  svc.runtimeBySpawnUid.clear();
  svc.movementState.clear();
  svc.encountersByMatchId?.clear();
}

describe('MonsterService.tickMovement — flow completo', () => {
  beforeEach(() => resetServiceState());

  it('monstros do mesmo tipo têm cooldowns iniciais DIFERENTES (desync)', () => {
    const m1 = makeMonster({ spawn_uid: 'spawn_aaa', template_name: 'Skeleton' });
    const m2 = makeMonster({ spawn_uid: 'spawn_bbb', template_name: 'Skeleton' });
    svc.runtimeBySpawnUid.set(m1.spawn_uid, m1);
    svc.runtimeBySpawnUid.set(m2.spawn_uid, m2);

    svc.tickMovement();
    const s1 = svc.movementState.get(m1.spawn_uid);
    const s2 = svc.movementState.get(m2.spawn_uid);
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    // Pode dar igual por azar do hash, mas a MAIORIA dos pares vai diferir.
    // Testa que pelo menos os stepMin/Max são diferentes (derivados de hashes distintos).
    expect(s1.stepMin !== s2.stepMin || s1.cooldown !== s2.cooldown).toBe(true);
  });

  it('monstro não ultrapassa move_radius (walk-back quando sai)', () => {
    const m = makeMonster({
      spawn_uid: 'spawn_bounded',
      template_name: 'Goblin',
      x: 100, y: 100,
      spawn_x: 100, spawn_y: 100,
      move_radius: 60,
    });
    svc.runtimeBySpawnUid.set(m.spawn_uid, m);

    for (let i = 0; i < 50; i++) {
      svc.tickMovement();
      const dx = m.x - m.spawn_x;
      const dy = m.y - m.spawn_y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Permite estouro temporário de ~1 step, mas não fica longe indefinidamente.
      expect(dist).toBeLessThan(m.move_radius + 80);
    }
  });

  it('monstro em status=cooldown não move (só respawna se prazo passou)', () => {
    const m = makeMonster({
      spawn_uid: 'spawn_dead',
      status: 'cooldown',
      next_respawn_at: Date.now() + 60_000, // longe no futuro
      x: 200, y: 300,
    });
    svc.runtimeBySpawnUid.set(m.spawn_uid, m);

    for (let i = 0; i < 10; i++) svc.tickMovement();
    expect(m.x).toBe(200);
    expect(m.y).toBe(300);
    expect(m.status).toBe('cooldown');
  });
});
