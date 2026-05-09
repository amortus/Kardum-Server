class MonsterManager {
  constructor() {
    this.templates = [];
    this.spawns = [];
    this.collections = [];
    this.cards = [];
    this.currentTemplateDrops = [];
    this.currentEditingTemplateId = null;
    this.visualPresets = {
      Monstro1: { badge: 'M1', title: 'Monstro1', subtitle: 'Male • leather_armor • male_head2' },
      Monstro2: { badge: 'M2', title: 'Monstro2', subtitle: 'Male • steel_armor • male_head3' },
      Monstro3: { badge: 'M3', title: 'Monstro3', subtitle: 'Female • leather_armor • head_long' }
    };
    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('btn-new-monster-template')?.addEventListener('click', () => {
      this.showTemplateForm();
    });
    document.getElementById('btn-new-monster-spawn')?.addEventListener('click', () => {
      this.showSpawnForm();
    });
    document.getElementById('btn-refresh-monsters')?.addEventListener('click', () => {
      this.loadData();
    });
    document.getElementById('btn-seed-shadowland-monsters')?.addEventListener('click', () => {
      this.seedShadowlandMonsters();
    });
    document.getElementById('btn-cancel-monster-template')?.addEventListener('click', () => {
      this.hideTemplateForm();
    });
    document.getElementById('btn-cancel-monster-spawn')?.addEventListener('click', () => {
      this.hideSpawnForm();
    });
    document.getElementById('monster-template-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveTemplate();
    });
    document.getElementById('monster-spawn-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSpawn();
    });
    document.getElementById('monster-search')?.addEventListener('input', () => this.render());
    document.getElementById('monster-filter-difficulty')?.addEventListener('change', () => this.render());
    document.getElementById('monster-filter-collection')?.addEventListener('change', () => this.render());
    document.getElementById('monster-visual-preset')?.addEventListener('change', (e) => {
      const preset = e?.target?.value || '';
      const form = document.getElementById('monster-template-form');
      if (!form) return;
      if (preset) {
        form.elements.visual.value = preset;
      }
      this.updateVisualPreview();
    });
    document.querySelector('#monster-template-form input[name="visual"]')?.addEventListener('input', () => {
      this.updateVisualPreview();
    });
    document.getElementById('btn-add-monster-drop')?.addEventListener('click', () => {
      this.saveTemplateDrop();
    });
  }

  async seedShadowlandMonsters() {
    try {
      const result = await apiClient.seedShadowlandMonsters();
      alert(`Seed Shadowland Monsters concluído. created=${result.created} updated=${result.updated} total=${result.total}`);
      await this.loadData();
    } catch (error) {
      console.error('[MonsterManager] seedShadowlandMonsters error:', error);
      alert(`Falha ao seedar monsters: ${error?.message || error}`);
    }
  }

  async loadData() {
    try {
      const [templateRes, spawnRes, collectionRes, cardsRes] = await Promise.all([
        apiClient.getMonsterTemplates(),
        apiClient.getMonsterSpawns('shadowland'),
        apiClient.getCardCollections(),
        apiClient.getCardsFiltered({})
      ]);
      this.templates = templateRes.templates || [];
      this.spawns = spawnRes.spawns || [];
      this.collections = collectionRes.collections || [];
      this.cards = cardsRes.cards || [];
      this.populateCollections();
      this.populateTemplateOptions();
      this.populateDropCardSelect();
      this.render();
    } catch (error) {
      console.error('[MonsterManager] loadData error:', error);
    }
  }

  render() {
    const templatesEl = document.getElementById('monster-templates-list');
    const spawnsEl = document.getElementById('monster-spawns-list');
    if (!templatesEl || !spawnsEl) return;
    const search = (document.getElementById('monster-search')?.value || '').toLowerCase().trim();
    const difficulty = document.getElementById('monster-filter-difficulty')?.value || '';
    const collection = document.getElementById('monster-filter-collection')?.value || '';

    const filteredTemplates = this.templates.filter((t) => {
      if (search && !String(t.name || '').toLowerCase().includes(search)) return false;
      if (difficulty && t.difficulty !== difficulty) return false;
      if (collection && (t.collection_id || '') !== collection) return false;
      return true;
    });

    templatesEl.innerHTML = filteredTemplates.map((t) => `
      <tr>
        <td>${t.id}</td>
        <td>${t.name}</td>
        <td>${t.collection_id || '-'}</td>
        <td>${t.visual || t.sprite_ref || '-'}</td>
        <td>${t.deck_id}</td>
        <td>${t.difficulty}</td>
        <td>${t.deck_mode || 'hybrid'}</td>
        <td><button class="btn-edit" onclick="monsterManager.editTemplate(${t.id})">Editar</button></td>
      </tr>
    `).join('');

    spawnsEl.innerHTML = this.spawns.map((s) => `
      <tr>
        <td>${s.spawn_uid}</td>
        <td>${s.template_name}</td>
        <td>${s.x}, ${s.y}</td>
        <td>${s.move_radius}</td>
        <td>${s.respawn_seconds}s</td>
        <td>
          <button class="btn-edit" onclick="monsterManager.editSpawn('${s.spawn_uid}')">Editar</button>
          <button class="btn-danger" onclick="monsterManager.removeSpawn('${s.spawn_uid}')">Remover</button>
        </td>
      </tr>
    `).join('');
  }

  populateCollections() {
    const selects = ['monster-template-collection', 'monster-filter-collection'];
    for (const selectId of selects) {
      const select = document.getElementById(selectId);
      if (!select) continue;
      const current = select.value;
      const placeholder = selectId.includes('filter')
        ? '<option value="">Todas as Coleções</option>'
        : '';
      select.innerHTML = placeholder + this.collections.map((c) => (
        `<option value="${c.id}">${c.name}</option>`
      )).join('');
      if (current) select.value = current;
    }
  }

  showTemplateForm(template = null) {
    const form = document.getElementById('monster-template-form');
    const modal = document.getElementById('monster-template-modal');
    const title = document.getElementById('monster-template-modal-title');
    if (!form || !modal || !title) {
      console.error('[MonsterManager] modal/form/title element missing', { form: !!form, modal: !!modal, title: !!title });
      return;
    }
    // Abre o modal ANTES de popular os campos para que falha em qualquer
    // assignment não impeça o usuário de ver/cancelar o form.
    modal.classList.remove('hidden');
    try {
      form.reset();
    } catch (err) {
      console.error('[MonsterManager] form.reset() falhou', err);
    }
    this.currentTemplateDrops = [];
    this.currentEditingTemplateId = null;
    const setField = (name, value) => {
      try {
        const el = form.elements[name];
        if (el) el.value = value;
      } catch (err) {
        console.error(`[MonsterManager] erro setando campo ${name}`, err);
      }
    };
    if (template) {
      title.textContent = 'Editar Monstro';
      setField('id', template.id);
      setField('name', template.name || '');
      setField('difficulty', template.difficulty || 'medium');
      setField('collection_id', template.collection_id || 'monsters_1');
      setField('deck_mode', template.deck_mode || 'hybrid');
      setField('visual', template.visual || template.sprite_ref || '');
      const presetSelect = document.getElementById('monster-visual-preset');
      if (presetSelect) {
        const visual = String((form.elements.visual && form.elements.visual.value) || '').toLowerCase();
        if (visual === 'monstro1') presetSelect.value = 'Monstro1';
        else if (visual === 'monstro2') presetSelect.value = 'Monstro2';
        else if (visual === 'monstro3') presetSelect.value = 'Monstro3';
        else presetSelect.value = '';
      }
      const rawManual = template.manual_deck_cards;
      const manualArr = Array.isArray(rawManual)
        ? rawManual
        : (typeof rawManual === 'string' && rawManual ? rawManual.split(',').map((s) => s.trim()).filter(Boolean) : []);
      setField('manual_deck_cards', manualArr.join(','));
      this.currentEditingTemplateId = Number(template.id);
    } else {
      title.textContent = 'Novo Monstro';
      setField('collection_id', 'monsters_1');
      setField('deck_mode', 'hybrid');
      const presetSelect = document.getElementById('monster-visual-preset');
      if (presetSelect) presetSelect.value = 'Monstro1';
      setField('visual', 'Monstro1');
    }
    try {
      this.populateDropCardSelect();
      this.renderTemplateDrops();
      if (this.currentEditingTemplateId) {
        this.loadTemplateDrops(this.currentEditingTemplateId);
      }
      this.updateVisualPreview();
    } catch (err) {
      console.error('[MonsterManager] erro pós-populacao', err);
    }
  }

  hideTemplateForm() {
    document.getElementById('monster-template-modal')?.classList.add('hidden');
  }

  async saveTemplate() {
    const form = document.getElementById('monster-template-form');
    if (!form) return;
    const payload = {
      name: form.elements.name.value.trim(),
      difficulty: form.elements.difficulty.value,
      collection_id: form.elements.collection_id.value || 'monsters_1',
      deck_mode: form.elements.deck_mode.value || 'hybrid',
      visual: form.elements.visual.value.trim(),
      manual_deck_cards: String(form.elements.manual_deck_cards.value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    };
    const id = form.elements.id.value;
    if (id) {
      await apiClient.updateMonsterTemplate(id, payload);
      this.currentEditingTemplateId = Number(id);
    } else {
      const created = await apiClient.createMonsterTemplate(payload);
      this.currentEditingTemplateId = Number(created.id || 0) || null;
    }
    this.hideTemplateForm();
    await this.loadData();
  }

  editTemplate(templateId) {
    const idNum = Number(templateId);
    const current = this.templates.find((t) => Number(t.id) === idNum);
    if (!current) {
      console.error('[MonsterManager] editTemplate: template não encontrado', { templateId, available: this.templates.map((t) => t.id) });
      alert(`Template ${templateId} não encontrado em memória. Atualize a lista (botão "Atualizar").`);
      return;
    }
    this.showTemplateForm(current);
  }

  populateTemplateOptions() {
    const select = document.getElementById('monster-spawn-template');
    if (!select) return;
    select.innerHTML = this.templates.map((template) => (
      `<option value="${template.id}">${template.name} (#${template.id})</option>`
    )).join('');
  }

  showSpawnForm(spawn = null) {
    const form = document.getElementById('monster-spawn-form');
    const modal = document.getElementById('monster-spawn-modal');
    const title = document.getElementById('monster-spawn-modal-title');
    if (!form || !modal || !title) return;
    form.reset();
    if (spawn) {
      title.textContent = 'Editar Spawn';
      form.elements.spawn_uid.value = spawn.spawn_uid;
      form.elements.template_id.value = spawn.template_id;
      form.elements.zone.value = spawn.zone || 'shadowland';
      form.elements.spawn_x.value = spawn.spawn_x ?? spawn.x ?? 0;
      form.elements.spawn_y.value = spawn.spawn_y ?? spawn.y ?? 0;
      form.elements.move_radius.value = spawn.move_radius ?? 120;
      form.elements.respawn_seconds.value = spawn.respawn_seconds ?? 60;
    } else {
      title.textContent = 'Novo Spawn';
      form.elements.zone.value = 'shadowland';
    }
    modal.classList.remove('hidden');
  }

  hideSpawnForm() {
    document.getElementById('monster-spawn-modal')?.classList.add('hidden');
  }

  async saveSpawn() {
    const form = document.getElementById('monster-spawn-form');
    if (!form) return;
    const payload = {
      template_id: parseInt(form.elements.template_id.value || '0', 10),
      zone: form.elements.zone.value || 'shadowland',
      spawn_x: parseFloat(form.elements.spawn_x.value || '0'),
      spawn_y: parseFloat(form.elements.spawn_y.value || '0'),
      move_radius: parseFloat(form.elements.move_radius.value || '120'),
      respawn_seconds: parseInt(form.elements.respawn_seconds.value || '60', 10)
    };
    const spawnUid = form.elements.spawn_uid.value;
    if (spawnUid) {
      await apiClient.updateMonsterSpawn(spawnUid, payload);
    } else {
      await apiClient.createMonsterSpawn(payload);
    }
    this.hideSpawnForm();
    await this.loadData();
  }

  editSpawn(spawnUid) {
    const current = this.spawns.find((s) => s.spawn_uid === spawnUid);
    if (!current) return;
    this.showSpawnForm(current);
  }

  async removeSpawn(spawnUid) {
    if (!confirm(`Remover spawn ${spawnUid}?`)) return;
    await apiClient.deleteMonsterSpawn(spawnUid);
    await this.loadData();
  }

  updateVisualPreview() {
    const form = document.getElementById('monster-template-form');
    if (!form) return;
    const visualValue = String(form.elements.visual.value || '').trim();
    const normalized = visualValue.toLowerCase();
    let presetKey = '';
    if (normalized === 'monstro1') presetKey = 'Monstro1';
    else if (normalized === 'monstro2') presetKey = 'Monstro2';
    else if (normalized === 'monstro3') presetKey = 'Monstro3';

    const badgeEl = document.getElementById('monster-visual-preview-badge');
    const titleEl = document.getElementById('monster-visual-preview-title');
    const subtitleEl = document.getElementById('monster-visual-preview-subtitle');
    if (!badgeEl || !titleEl || !subtitleEl) return;

    if (presetKey && this.visualPresets[presetKey]) {
      const data = this.visualPresets[presetKey];
      badgeEl.textContent = data.badge;
      titleEl.textContent = data.title;
      subtitleEl.textContent = data.subtitle;
      return;
    }

    badgeEl.textContent = 'V';
    titleEl.textContent = visualValue || 'Visual customizado';
    subtitleEl.textContent = visualValue
      ? 'Caminho/preset customizado salvo como visual do monstro'
      : 'Informe um preset (Monstro1/2/3) ou caminho res://...';
  }

  populateDropCardSelect() {
    const select = document.getElementById('monster-drop-card-select');
    if (!select) return;
    const current = select.value;
    const options = this.cards.map((card) => (
      `<option value="${card.id}">${card.name} (${card.id})</option>`
    )).join('');
    select.innerHTML = `<option value="">Selecione uma carta...</option>${options}`;
    if (current) select.value = current;
  }

  async loadTemplateDrops(templateId) {
    if (!templateId) return;
    try {
      const response = await apiClient.getMonsterTemplateDrops(templateId);
      this.currentTemplateDrops = response.drops || [];
      this.renderTemplateDrops();
    } catch (error) {
      console.error('[MonsterManager] loadTemplateDrops error:', error);
      this.currentTemplateDrops = [];
      this.renderTemplateDrops();
    }
  }

  renderTemplateDrops() {
    const list = document.getElementById('monster-template-drops-list');
    const hint = document.getElementById('monster-drops-hint');
    if (!list || !hint) return;
    if (!this.currentEditingTemplateId) {
      list.innerHTML = '<tr><td colspan="3">Salve o template para configurar os drops.</td></tr>';
      hint.textContent = 'Salve o template primeiro para editar drops.';
      return;
    }
    hint.textContent = 'Dica: cada drop rola chance e a batalha concede no máximo 1 carta.';
    list.innerHTML = this.currentTemplateDrops.map((drop) => `
      <tr>
        <td>${drop.card_id}</td>
        <td>${Number(drop.drop_chance_percent || 0).toFixed(2)}%</td>
        <td><button type="button" class="btn-danger" onclick="monsterManager.removeTemplateDrop('${drop.card_id}')">Remover</button></td>
      </tr>
    `).join('');
    if (!this.currentTemplateDrops.length) {
      list.innerHTML = '<tr><td colspan="3">Nenhum drop configurado.</td></tr>';
    }
  }

  async saveTemplateDrop() {
    if (!this.currentEditingTemplateId) {
      alert('Salve o template antes de adicionar drops.');
      return;
    }
    const cardSelect = document.getElementById('monster-drop-card-select');
    const chanceInput = document.getElementById('monster-drop-chance-input');
    const cardId = String(cardSelect?.value || '').trim();
    const chance = Number(chanceInput?.value || 0);
    if (!cardId) {
      alert('Selecione uma carta para o drop.');
      return;
    }
    if (!Number.isFinite(chance) || chance < 0 || chance > 100) {
      alert('A chance deve estar entre 0 e 100.');
      return;
    }
    await apiClient.upsertMonsterTemplateDrop(this.currentEditingTemplateId, {
      card_id: cardId,
      drop_chance_percent: chance
    });
    if (chanceInput) chanceInput.value = '';
    await this.loadTemplateDrops(this.currentEditingTemplateId);
  }

  async removeTemplateDrop(cardId) {
    if (!this.currentEditingTemplateId) return;
    if (!confirm(`Remover drop da carta ${cardId}?`)) return;
    await apiClient.deleteMonsterTemplateDrop(this.currentEditingTemplateId, cardId);
    await this.loadTemplateDrops(this.currentEditingTemplateId);
  }
}

const monsterManager = new MonsterManager();
window.monsterManager = monsterManager;
