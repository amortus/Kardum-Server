/**
 * Dataset-driven validation: compara output do algoritmo vs golden fixtures.
 *
 * Cada entrada do dataset é um "prompt" (input conhecido) com sua resposta
 * esperada. Se o algoritmo mudar sem que o dataset seja regenerado de
 * propósito, o teste falha — útil pra pegar mudanças acidentais.
 *
 * Quando mudar o algoritmo intencionalmente: rode os testes, veja o diff,
 * atualize o JSON manualmente OU crie um script `regen-golden.ts`.
 */
import { describe, it, expect } from 'vitest';
import golden from '../fixtures/monster-personality-golden.json';
import { default as monsterService } from '../../src/modules/monsters/monster.service';
import { makeMonster } from '../helpers/monster-helpers';

const svc = monsterService as any;

describe('Dataset validation — monster personality', () => {
  for (const entry of (golden as any).entries) {
    it(`${entry.template_name} (${entry.spawn_uid}) bate com golden`, () => {
      const p = svc.getMovementPersonality(
        makeMonster({
          spawn_uid: entry.spawn_uid,
          template_name: entry.template_name,
        })
      );
      expect(p.cooldownMin).toBe(entry.expectedCooldownMin);
      expect(p.cooldownMax).toBe(entry.expectedCooldownMax);
      // stepMin/stepMax dependem do hash — só validamos faixa geral.
      expect(p.stepMin).toBeGreaterThanOrEqual(6);
      expect(p.stepMax).toBeLessThanOrEqual(80);
      expect(p.stepMax).toBeGreaterThan(p.stepMin);
    });
  }
});
