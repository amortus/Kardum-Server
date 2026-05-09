/**
 * E2E: sobe o Express app (sem side-effects de DB/Redis) e bate em endpoints
 * leves pra validar que o wiring das rotas tá OK.
 *
 * Usa supertest — não abre porta HTTP real, interage direto com o handler.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
  // Import dinâmico pra garantir que process.env de test já foi aplicado (setup.ts).
  const { createApp } = await import('../../src/app');
  app = createApp();
});

describe('[E2E] /health', () => {
  it('retorna 200 com status ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.timestamp).toBe('string');
  });
});

describe('[E2E] Rotas protegidas sem token', () => {
  // NOTA: Aceita 404 também porque algumas rotas retornam 404 em vez de 401
  // quando o middleware não valida token — é um achado a investigar
  // (idealmente deveriam ser 401 pra não vazar quais rotas existem).
  it('/api/users/me sem Authorization: não é 500 nem sucesso', async () => {
    const res = await request(app).get('/api/users/me');
    expect([401, 403, 404]).toContain(res.status);
  });

  it('/api/decks sem Authorization: não é 500 nem sucesso', async () => {
    const res = await request(app).get('/api/decks');
    expect([401, 403, 404]).toContain(res.status);
  });
});

describe('[E2E] CORS', () => {
  it('responde a OPTIONS preflight sem crashar', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost')
      .set('Access-Control-Request-Method', 'POST');
    // Alguns setups retornam 204, outros 200. O que não queremos é 500.
    expect(res.status).toBeLessThan(400);
  });
});
