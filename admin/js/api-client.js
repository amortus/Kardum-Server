// API Client for Admin Dashboard
class AdminAPI {
  constructor() {
    this.baseURL = '/api';
    this.token = localStorage.getItem('admin_token');
  }

  async request(endpoint, options = {}) {
    this.token = localStorage.getItem('admin_token');
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers
      }
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const rawText = await response.text();
      let data = null;
      if (rawText && (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('['))) {
        try {
          data = JSON.parse(rawText);
        } catch (_e) {
          data = null;
        }
      }

      if (!response.ok) {
        const errorMessage =
          (data && (data.error || data.message)) ||
          `HTTP ${response.status}: ${rawText ? rawText.slice(0, 180) : 'Request failed'}`;
        // Token expirado ou inválido: limpar e redirecionar ao login
        if (response.status === 401 || response.status === 403) {
          const msg = String((data && data.error) || errorMessage || '');
          if (msg.includes('token') || msg.includes('Token')) {
            localStorage.removeItem('admin_token');
            alert('Sessão expirada. Faça login novamente.');
            location.reload();
            return;
          }
        }
        throw new Error(errorMessage);
      }

      // Some endpoints may return empty body on success; normalize to {}
      return data || {};
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Cards
  async getCards() {
    return this.request('/cards?include_locked=true');
  }

  async getCardsFiltered(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') {
        params.set(k, String(v));
      }
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const joiner = suffix ? '&' : '?';
    return this.request(`/cards${suffix}${joiner}include_locked=true`);
  }

  async getCard(id) {
    return this.request(`/cards/${id}`);
  }

  async getCardLayout(id) {
    return this.request(`/admin/cards/${id}/layout`);
  }

  async getGlobalVfxLayout() {
    return this.request('/admin/card-layouts/global-vfx');
  }

  async updateGlobalVfxLayout(layout) {
    return this.request('/admin/card-layouts/global-vfx', {
      method: 'PUT',
      body: { layout }
    });
  }

  async uploadGlobalCardbase(imageData) {
    return this.request('/admin/card-layouts/global-cardbase', {
      method: 'POST',
      body: { image: imageData }
    });
  }

  async createCard(card) {
    return this.request('/admin/cards', {
      method: 'POST',
      body: card
    });
  }

  async updateCard(id, card) {
    return this.request(`/admin/cards/${id}`, {
      method: 'PUT',
      body: card
    });
  }

  async deleteCard(id) {
    return this.request(`/admin/cards/${id}`, {
      method: 'DELETE'
    });
  }

  async getAssets() {
    return this.request('/admin/assets');
  }

  async uploadCardImage(id, imageData) {
    // imageData é um data URL (base64)
    return this.request(`/admin/cards/${id}/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: { image: imageData }
    });
  }

  /** Imagem completa (full-bleed); HUD é desenhada no cliente Godot. */
  async uploadCardFullImage(id, imageData) {
    return this.request(`/admin/cards/${id}/card-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: { image: imageData }
    });
  }

  async getOverviewStats() {
    return this.request('/admin/overview-stats');
  }

  async getAdminCommands() {
    return this.request('/admin/commands');
  }

  // Users
  async getUsers() {
    return this.request('/admin/users');
  }

  async getUser(id) {
    return this.request(`/admin/users/${id}`);
  }

  async getUserDecks(id) {
    return this.request(`/admin/users/${id}/decks`);
  }

  // Boosters
  async getBoosters() {
    return this.request('/admin/boosters');
  }

  async getBooster(id) {
    return this.request(`/admin/boosters/${id}`);
  }

  async createBooster(booster) {
    return this.request('/admin/boosters', {
      method: 'POST',
      body: booster
    });
  }

  async updateBooster(id, booster) {
    return this.request(`/admin/boosters/${id}`, {
      method: 'PUT',
      body: booster
    });
  }

  async deleteBooster(id) {
    return this.request(`/admin/boosters/${id}`, {
      method: 'DELETE'
    });
  }

  // Card collections
  async getCardCollections() {
    return this.request('/admin/card-collections');
  }

  async createCardCollection(payload) {
    return this.request('/admin/card-collections', { method: 'POST', body: payload });
  }

  async updateCardCollection(id, payload) {
    return this.request(`/admin/card-collections/${id}`, { method: 'PUT', body: payload });
  }

  // Monsters
  async getMonsterTemplates() {
    return this.request('/admin/monsters/templates');
  }

  async createMonsterTemplate(payload) {
    return this.request('/admin/monsters/templates', { method: 'POST', body: payload });
  }

  async updateMonsterTemplate(id, payload) {
    return this.request(`/admin/monsters/templates/${id}`, { method: 'PUT', body: payload });
  }

  async getMonsterTemplateDrops(templateId) {
    return this.request(`/admin/monsters/templates/${templateId}/drops`);
  }

  async upsertMonsterTemplateDrop(templateId, payload) {
    return this.request(`/admin/monsters/templates/${templateId}/drops`, { method: 'POST', body: payload });
  }

  async deleteMonsterTemplateDrop(templateId, cardId) {
    return this.request(`/admin/monsters/templates/${templateId}/drops/${encodeURIComponent(cardId)}`, {
      method: 'DELETE'
    });
  }

  async getMonsterSpawns(zone = 'shadowland') {
    return this.request(`/admin/monsters/spawns?zone=${encodeURIComponent(zone)}`);
  }

  async createMonsterSpawn(payload) {
    return this.request('/admin/monsters/spawns', { method: 'POST', body: payload });
  }

  async updateMonsterSpawn(spawnUid, payload) {
    return this.request(`/admin/monsters/spawns/${spawnUid}`, { method: 'PUT', body: payload });
  }

  async deleteMonsterSpawn(spawnUid) {
    return this.request(`/admin/monsters/spawns/${spawnUid}`, { method: 'DELETE' });
  }

  async seedMonsterCards() {
    return this.request('/admin/monsters/seed-cards', { method: 'POST' });
  }

  async seedShadowlandCards() {
    return this.request('/admin/monsters/seed-shadowland-cards', { method: 'POST' });
  }

  async seedGoblinsCards() {
    return this.request('/admin/goblins/seed-cards', { method: 'POST' });
  }

  async seedDwarvesCards() {
    return this.request('/admin/dwarves/seed-cards', { method: 'POST' });
  }

  async seedElvesCards() {
    return this.request('/admin/elves/seed-cards', { method: 'POST' });
  }

  async seedAntsCards() {
    return this.request('/admin/ants/seed-cards', { method: 'POST' });
  }

  async seedNecromancersCards() {
    return this.request('/admin/necromancers/seed-cards', { method: 'POST' });
  }

  async seedMonsterArchetypes() {
    return this.request('/admin/monsters/seed-archetypes', { method: 'POST' });
  }

  async createRegion(payload) {
    return this.request('/admin/world/regions', { method: 'POST', body: payload });
  }

  async getAdminRegions(zone = 'shadowland') {
    return this.request(`/admin/world/regions?zone=${encodeURIComponent(zone)}`);
  }

  async updateRegion(id, payload) {
    return this.request(`/admin/world/regions/${id}`, { method: 'PUT', body: payload });
  }

  async deleteRegion(id) {
    return this.request(`/admin/world/regions/${id}`, { method: 'DELETE' });
  }

  // NPCs
  async getNpcTemplates() {
    return this.request('/admin/npcs/templates');
  }

  async createNpcTemplate(payload) {
    return this.request('/admin/npcs/templates', { method: 'POST', body: payload });
  }

  async updateNpcTemplate(id, payload) {
    return this.request(`/admin/npcs/templates/${id}`, { method: 'PUT', body: payload });
  }

  async getNpcSpawns(zone = 'shadowland') {
    return this.request(`/admin/npcs/spawns?zone=${encodeURIComponent(zone)}`);
  }

  async createNpcSpawn(payload) {
    return this.request('/admin/npcs/spawns', { method: 'POST', body: payload });
  }

  async updateNpcSpawn(spawnUid, payload) {
    return this.request(`/admin/npcs/spawns/${spawnUid}`, { method: 'PUT', body: payload });
  }

  async deleteNpcSpawn(spawnUid) {
    return this.request(`/admin/npcs/spawns/${spawnUid}`, { method: 'DELETE' });
  }

  // Quests
  async getQuestDefinitions(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || String(value).trim() === '') return;
      params.set(key, String(value));
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/admin/quests/definitions${suffix}`);
  }

  async createQuestDefinition(payload) {
    return this.request('/admin/quests/definitions', { method: 'POST', body: payload });
  }

  async updateQuestDefinition(id, payload) {
    return this.request(`/admin/quests/definitions/${id}`, { method: 'PUT', body: payload });
  }

  async getNpcQuests(npcTemplateId) {
    return this.request(`/admin/npcs/${npcTemplateId}/quests`);
  }

  async seedInitialNpcQuest() {
    return this.request('/admin/quests/seed-initial', { method: 'POST' });
  }

  async seedShadowlandQuestChain() {
    return this.request('/admin/quests/seed-shadowland-chain', { method: 'POST' });
  }

  async seedShadowlandMonsters() {
    return this.request('/admin/monsters/seed-shadowland-templates', { method: 'POST' });
  }

  // ===== Mail =====
  async listMailCampaigns() {
    return this.request('/admin/mail/campaigns');
  }

  async createMailCampaign(payload) {
    return this.request('/admin/mail/campaigns', { method: 'POST', body: payload });
  }

  async cancelMailCampaign(id) {
    return this.request(`/admin/mail/campaigns/${id}/cancel`, { method: 'POST' });
  }

  async sendUserMail(payload) {
    return this.request('/admin/mail/send-user', { method: 'POST', body: payload });
  }

  // ===== Daily login calendar =====
  async getDailyLoginConfig(month) {
    return this.request(`/admin/daily-login/config?month=${encodeURIComponent(month)}`);
  }

  async upsertDailyLoginConfig(payload) {
    return this.request('/admin/daily-login/config', { method: 'POST', body: payload });
  }
}

const apiClient = new AdminAPI();
window.apiClient = apiClient;
