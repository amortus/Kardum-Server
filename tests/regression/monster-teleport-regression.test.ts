/**
 * REGRESSION: Monstros NÃO devem teleportar para spawn_x/spawn_y quando
 * ultrapassam o move_radius.
 *
 * Bug original: em `tickMovement`, quando dist > move_radius, o código setava
 *   monster.x = monster.spawn_x; monster.y = monster.spawn_y;
 * Isso causava:
 *  1. Visualmente: o monstro "teleportava" no cliente (reset visible).
 *  2. AOI: se spawn estava fora do raio do player, disparava MMO_MONSTER_DESPAWN
 *     e o monstro simplesmente sumia da tela.
 *
 * Fix (commit 73f5018): walk-back gradual via atan2 + returnStep 12–32px.
 *
 * Este teste trava se alguém reintroduzir o teleporte.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { default as monsterService } from '../../src/modules/monsters/monster.service';
import { makeMonster } from '../helpers/monster-helpers';

const svc = monsterService as any;

describe('[REGRESSION] Monster não teleporta pra spawn ao sair do raio', () => {
  beforeEach(() => {
    svc.runtimeBySpawnUid.clear();
    svc.movementState.clear();
  });

  it('quando força posição perto da borda, o monstro caminha de volta ao invés de pular', () => {
    const m = makeMonster({
      spawn_uid: 'spawn_regress_teleport',
      template_name: 'Skeleton',
      spawn_x: 500,
      spawn_y: 500,
      x: 700,  // já fora do raio (200px de dist, radius=120)
      y: 500,
      move_radius: 120,
    });
    svc.runtimeBySpawnUid.set(m.spawn_uid, m);

    // Força a state pra não ficar em cooldown.
    svc.movementState.set(m.spawn_uid, {
      cooldown: 0,
      stepMin: 15,
      stepMax: 30,
    });

    const posBefore = { x: m.x, y: m.y };
    svc.tickMovement();

    // Invariante: o delta de UM TICK tem que ser pequeno (step), não um pulo pro spawn.
    const delta = Math.sqrt(
      (m.x - posBefore.x) ** 2 + (m.y - posBefore.y) ** 2
    );
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(60); // step máx ~32px + margin

    // Direção deve ser EM DIREÇÃO ao spawn (aproximou).
    const distBefore = Math.sqrt(
      (posBefore.x - m.spawn_x) ** 2 + (posBefore.y - m.spawn_y) ** 2
    );
    const distAfter = Math.sqrt(
      (m.x - m.spawn_x) ** 2 + (m.y - m.spawn_y) ** 2
    );
    expect(distAfter).toBeLessThan(distBefore);
  });
});
