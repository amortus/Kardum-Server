/**
 * Unit tests: lógica pura de personality/movement do MonsterService.
 * Não tocam em banco/rede — só validam determinismo e invariantes.
 *
 * Por que é crítico: se o spawnHash não for determinístico, os monstros
 * mudam de "personalidade" a cada restart do servidor, quebrando cache
 * do cliente e a sensação de mundo consistente.
 */
import { describe, it, expect } from 'vitest';
import { makeMonster } from '../helpers/monster-helpers';

// Import *privado* do service via cast. Alternativa limpa: extrair as funções
// puras pra um módulo `monster.movement.ts`. Por enquanto testamos via reflection.
import { default as monsterService } from '../../src/modules/monsters/monster.service';
const svc = monsterService as any;

describe('MonsterService — spawnHash', () => {
  it('é determinístico pra mesmo spawn_uid', () => {
    const h1 = svc.spawnHash('spawn_abc123');
    const h2 = svc.spawnHash('spawn_abc123');
    expect(h1).toBe(h2);
  });

  it('produz valores diferentes pra spawn_uids diferentes', () => {
    const h1 = svc.spawnHash('spawn_a');
    const h2 = svc.spawnHash('spawn_b');
    expect(h1).not.toBe(h2);
  });

  it('sempre retorna uint32 não-negativo', () => {
    const h = svc.spawnHash('spawn_xyz');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xFFFFFFFF);
  });
});

describe('MonsterService — getMovementPersonality', () => {
  it('zumbi tem cooldown mais longo que goblin', () => {
    const zombie = svc.getMovementPersonality(makeMonster({ template_name: 'Zombie', spawn_uid: 'spawn_z1' }));
    const goblin = svc.getMovementPersonality(makeMonster({ template_name: 'Goblin', spawn_uid: 'spawn_g1' }));
    expect(zombie.cooldownMin).toBeGreaterThanOrEqual(goblin.cooldownMin);
    expect(zombie.cooldownMax).toBeGreaterThan(goblin.cooldownMax);
  });

  it('stepMin/stepMax formam faixa válida (>=6, max > min)', () => {
    const p = svc.getMovementPersonality(makeMonster({ spawn_uid: 'spawn_step_test' }));
    expect(p.stepMin).toBeGreaterThanOrEqual(6);
    expect(p.stepMax).toBeGreaterThan(p.stepMin);
    expect(p.stepMax).toBeLessThan(100); // sanity
  });

  it('tipo desconhecido cai no default e ainda é válido', () => {
    const p = svc.getMovementPersonality(makeMonster({ template_name: 'XYZ_UNKNOWN', spawn_uid: 'spawn_unknown' }));
    expect(p.cooldownMin).toBeGreaterThanOrEqual(0);
    expect(p.cooldownMax).toBeGreaterThan(0);
    expect(p.stepMin).toBeGreaterThan(0);
  });
});
