/**
 * Global setup para todos os testes.
 * - Define env vars seguras (sem contaminar produção)
 * - Inicializa mocks globais básicos
 */
import { beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Evita que qualquer código de teste tente conectar em banco/Redis real.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-never-use-in-prod';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? '';
process.env.REDIS_URL = process.env.REDIS_URL ?? '';
process.env.SKIP_DB_INIT = '1';
process.env.SKIP_SOCKET_INIT = '1';

beforeAll(() => {
  // Hook para setup global. Ex: levantar um banco em memória, mock de cartas, etc.
});

afterAll(() => {
  // Cleanup global.
});

beforeEach(() => {
  vi.useRealTimers();
});
