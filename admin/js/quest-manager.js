class QuestManager {
  constructor() {
    this.npcTemplates = [];
    this.npcSpawns = [];
    this.questDefinitions = [];
    this.npcQuestDefinitions = [];
    this.cards = [];
    this.selectedNpcTemplateId = null;
    this.questSearch = '';
    this.questPage = 1;
    this.questLimit = 50;
    this.questTotal = 0;
    this.prerequisiteDraft = [];
    this.prerequisiteCandidates = [];
    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('btn-refresh-quests')?.addEventListener('click', () => this.loadData());
    document.getElementById('btn-seed-initial-npc-quest')?.addEventListener('click', () => this.seedInitial());
    document.getElementById('btn-new-npc-template')?.addEventListener('click', () => this.showNpcTemplateModal());
    document.getElementById('btn-new-npc-spawn')?.addEventListener('click', () => this.showNpcSpawnModal());
    document.getElementById('btn-new-quest-definition')?.addEventListener('click', () => this.showQuestModal());
    document.getElementById('btn-cancel-npc-template')?.addEventListener('click', () => this.hideModal('npc-template-modal'));
    document.getElementById('btn-cancel-npc-spawn')?.addEventListener('click', () => this.hideModal('npc-spawn-modal'));
    document.getElementById('btn-cancel-quest-definition')?.addEventListener('click', () => this.hideModal('quest-definition-modal'));
    document.getElementById('npc-template-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.saveNpcTemplate();
    });
    document.getElementById('npc-spawn-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.saveNpcSpawn();
    });
    document.getElementById('quest-definition-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.saveQuestDefinition();
    });
    document.getElementById('quest-search')?.addEventListener('input', (event) => {
      this.questSearch = String(event?.target?.value || '').trim();
      this.questPage = 1;
      this.loadData();
    });
    document.getElementById('quest-search-limit')?.addEventListener('change', (event) => {
      this.questLimit = Math.max(1, Number(event?.target?.value || 50));
      this.questPage = 1;
      this.loadData();
    });
    document.getElementById('quest-search-npc')?.addEventListener('change', (event) => {
      const npcTemplateId = Number(event?.target?.value || 0);
      this.selectedNpcTemplateId = Number.isFinite(npcTemplateId) && npcTemplateId > 0 ? npcTemplateId : null;
      this.questPage = 1;
      this.loadData();
    });
    document.getElementById('npc-chain-list')?.addEventListener('click', (event) => {
      const target = event.target.closest?.('.npc-chain-item');
      if (!target) return;
      const npcTemplateId = Number(target.dataset.npcId || 0);
      if (!Number.isFinite(npcTemplateId) || npcTemplateId <= 0) return;
      this.selectedNpcTemplateId = npcTemplateId;
      const npcSearchSelect = document.getElementById('quest-search-npc');
      if (npcSearchSelect) {
        npcSearchSelect.value = String(npcTemplateId);
      }
      this.questPage = 1;
      this.loadData();
    });
    document.getElementById('quest-pagination')?.addEventListener('click', (event) => {
      const target = event.target.closest?.('button[data-page]');
      if (!target) return;
      const nextPage = Number(target.dataset.page || 0);
      if (!Number.isFinite(nextPage) || nextPage <= 0 || nextPage === this.questPage) return;
      this.questPage = nextPage;
      this.loadData();
    });
    document.getElementById('quest-prereq-search')?.addEventListener('input', () => {
      this.loadPrerequisiteCandidates();
    });
    document.getElementById('btn-add-quest-prereq')?.addEventListener('click', () => {
      this.addSelectedPrerequisiteFromPicker();
    });
    document.getElementById('quest-prereq-selected')?.addEventListener('click', (event) => {
      const target = event.target.closest?.('button[data-prereq-ref]');
      if (!target) return;
      const ref = String(target.dataset.prereqRef || '').trim();
      if (ref === '') return;
      this.prerequisiteDraft = this.prerequisiteDraft.filter((item) => String(item.reference_value || '').trim() !== ref);
      this.renderPrerequisiteDraft();
    });
  }

  async loadData() {
    const [templatesRes, spawnsRes, questsRes, cardsRes] = await Promise.all([
      apiClient.getNpcTemplates(),
      apiClient.getNpcSpawns('shadowland'),
      apiClient.getQuestDefinitions({
        page: this.questPage,
        limit: this.questLimit,
        search: this.questSearch,
        giver_npc_template_id: this.selectedNpcTemplateId || '',
        include_inactive: true
      }),
      apiClient.getCards()
    ]);
    this.npcTemplates = templatesRes.templates || [];
    this.npcSpawns = spawnsRes.spawns || [];
    this.questDefinitions = questsRes.definitions || [];
    this.questTotal = Number(questsRes.total || this.questDefinitions.length || 0);
    this.questPage = Math.max(1, Number(questsRes.page || this.questPage || 1));
    this.cards = cardsRes.cards || [];
    if (!this.selectedNpcTemplateId && this.npcTemplates.length > 0) {
      this.selectedNpcTemplateId = Number(this.npcTemplates[0].id);
    }
    await this.loadNpcQuestDefinitions();
    this.render();
    this.populateTemplateSelects();
    this.populateRewardCardOptions();
  }

  async loadNpcQuestDefinitions() {
    if (!this.selectedNpcTemplateId) {
      this.npcQuestDefinitions = [];
      return;
    }
    try {
      const npcQuestRes = await apiClient.getNpcQuests(this.selectedNpcTemplateId);
      this.npcQuestDefinitions = npcQuestRes.definitions || [];
    } catch (error) {
      console.error('Failed to load npc quests', error);
      this.npcQuestDefinitions = [];
    }
  }

  render() {
    const npcTemplateList = document.getElementById('npc-templates-list');
    const npcSpawnList = document.getElementById('npc-spawns-list');
    const questList = document.getElementById('quest-definitions-list');
    if (npcTemplateList) {
      npcTemplateList.innerHTML = this.npcTemplates.map((npc) => `
        <tr>
          <td>${npc.id}</td>
          <td>${npc.code}</td>
          <td>${npc.name}</td>
          <td>${npc.sprite_ref || '-'}</td>
          <td>${npc.frame_count}</td>
          <td><button class="btn-edit" onclick="questManager.editNpcTemplate(${npc.id})">Editar</button></td>
        </tr>
      `).join('');
    }
    if (npcSpawnList) {
      npcSpawnList.innerHTML = this.npcSpawns.map((spawn) => `
        <tr>
          <td>${spawn.spawn_uid}</td>
          <td>${spawn.template?.name || spawn.npc_template_id}</td>
          <td>${spawn.zone}</td>
          <td>${Math.round(spawn.x)}, ${Math.round(spawn.y)}</td>
          <td>${Math.round(spawn.interaction_radius || 90)}</td>
          <td>
            <button class="btn-edit" onclick="questManager.editNpcSpawn('${spawn.spawn_uid}')">Editar</button>
            <button class="btn-danger" onclick="questManager.deleteNpcSpawn('${spawn.spawn_uid}')">Remover</button>
          </td>
        </tr>
      `).join('');
    }
    if (questList) {
      questList.innerHTML = this.questDefinitions.map((quest) => `
        <tr>
          <td>${quest.id}</td>
          <td>${quest.code}</td>
          <td>${quest.title}</td>
          <td>${quest.objectives?.length || 0}</td>
          <td>${quest.rewards?.length || 0}</td>
          <td>${quest.is_active ? 'Sim' : 'Nao'}</td>
          <td><button class="btn-edit" onclick="questManager.editQuestDefinition(${quest.id})">Editar</button></td>
        </tr>
      `).join('');
    }
    this.renderNpcChainNavigator();
    this.renderNpcQuestChain();
    this.renderQuestPagination();
  }

  renderNpcChainNavigator() {
    const list = document.getElementById('npc-chain-list');
    if (!list) return;
    list.innerHTML = this.npcTemplates.map((npc) => {
      const isActive = Number(this.selectedNpcTemplateId || 0) === Number(npc.id);
      return `
        <div class="npc-chain-item ${isActive ? 'active' : ''}" data-npc-id="${npc.id}">
          <div><strong>${npc.name}</strong></div>
          <div class="npc-chain-meta">${npc.code} (#${npc.id})</div>
        </div>
      `;
    }).join('');
  }

  renderNpcQuestChain() {
    const tbody = document.getElementById('npc-quest-chain-list');
    if (!tbody) return;
    if (!this.selectedNpcTemplateId) {
      tbody.innerHTML = '<tr><td colspan="6">Selecione um NPC.</td></tr>';
      return;
    }
    if (!Array.isArray(this.npcQuestDefinitions) || this.npcQuestDefinitions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhuma quest vinculada a este NPC.</td></tr>';
      return;
    }
    tbody.innerHTML = this.npcQuestDefinitions.map((quest) => {
      const prerequisitesCount = Array.isArray(quest.prerequisites) ? quest.prerequisites.length : 0;
      return `
        <tr>
          <td>${quest.id}</td>
          <td>${quest.code}</td>
          <td>${quest.title}</td>
          <td>${prerequisitesCount}</td>
          <td>${quest.is_active ? 'Ativa' : 'Inativa'}</td>
          <td><button class="btn-edit" onclick="questManager.editQuestDefinition(${quest.id})">Editar</button></td>
        </tr>
      `;
    }).join('');
  }

  renderQuestPagination() {
    const container = document.getElementById('quest-pagination');
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil(Number(this.questTotal || 0) / Number(this.questLimit || 1)));
    const prevPage = Math.max(1, this.questPage - 1);
    const nextPage = Math.min(totalPages, this.questPage + 1);
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn-secondary" data-page="${prevPage}" ${this.questPage <= 1 ? 'disabled' : ''}>Anterior</button>
        <span>Página ${this.questPage} de ${totalPages} (${this.questTotal} quests)</span>
        <button class="btn-secondary" data-page="${nextPage}" ${this.questPage >= totalPages ? 'disabled' : ''}>Próxima</button>
      </div>
    `;
  }

  populateTemplateSelects() {
    const selectIds = ['npc-spawn-template-id', 'quest-giver-npc-id', 'quest-turnin-npc-id'];
    for (const selectId of selectIds) {
      const select = document.getElementById(selectId);
      if (!select) continue;
      const previous = select.value;
      const placeholder = '<option value="">Nenhum</option>';
      select.innerHTML = placeholder + this.npcTemplates
        .map((npc) => `<option value="${npc.id}">${npc.name} (#${npc.id})</option>`)
        .join('');
      if (previous) select.value = previous;
    }
    const npcSearchSelect = document.getElementById('quest-search-npc');
    if (npcSearchSelect) {
      const selectedValue = this.selectedNpcTemplateId ? String(this.selectedNpcTemplateId) : '';
      npcSearchSelect.innerHTML = '<option value="">Todos os NPCs</option>' + this.npcTemplates
        .map((npc) => `<option value="${npc.id}">${npc.name} (#${npc.id})</option>`)
        .join('');
      if (selectedValue !== '') {
        npcSearchSelect.value = selectedValue;
      }
    }
  }

  showNpcTemplateModal(template = null) {
    const form = document.getElementById('npc-template-form');
    if (!form) return;
    form.reset();
    form.elements.id.value = template?.id || '';
    form.elements.code.value = template?.code || '';
    form.elements.name.value = template?.name || '';
    form.elements.sprite_ref.value = template?.sprite_ref || 'res://assets/NPC/wandering_trader1.png';
    form.elements.frame_count.value = template?.frame_count || 6;
    form.elements.frame_cols.value = template?.frame_cols || 6;
    form.elements.frame_rows.value = template?.frame_rows || 1;
    form.elements.idle_start.value = template?.idle_start || 0;
    form.elements.idle_count.value = template?.idle_count || 6;
    form.elements.dialogue_json.value = template?.dialogue_json || '["Ola aventureiro!"]';
    this.showModal('npc-template-modal');
  }

  showNpcSpawnModal(spawn = null) {
    const form = document.getElementById('npc-spawn-form');
    if (!form) return;
    form.reset();
    form.elements.spawn_uid.value = spawn?.spawn_uid || '';
    form.elements.zone.value = spawn?.zone || 'shadowland';
    form.elements.spawn_x.value = spawn?.x ?? spawn?.spawn_x ?? 0;
    form.elements.spawn_y.value = spawn?.y ?? spawn?.spawn_y ?? 0;
    form.elements.interaction_radius.value = spawn?.interaction_radius || 90;
    form.elements.npc_template_id.value = spawn?.npc_template_id || '';
    this.showModal('npc-spawn-modal');
  }

  showQuestModal(definition = null) {
    const form = document.getElementById('quest-definition-form');
    if (!form) return;
    form.reset();
    form.elements.id.value = definition?.id || '';
    form.elements.code.value = definition?.code || '';
    form.elements.title.value = definition?.title || '';
    form.elements.description.value = definition?.description || '';
    form.elements.giver_npc_template_id.value = definition?.giver_npc_template_id || '';
    form.elements.turnin_npc_template_id.value = definition?.turnin_npc_template_id || '';
    form.elements.min_level.value = definition?.min_level || 1;
    form.elements.recurrence_type.value = definition?.recurrence_type || 'none';
    form.elements.auto_track.checked = definition ? !!definition.auto_track : true;
    form.elements.objective_logic.value = definition?.objective_logic || 'all';
    form.elements.is_active.checked = definition ? !!definition.is_active : true;
    form.elements.objectives_json.value = JSON.stringify(definition?.objectives || [
      {
        objective_type: 'WIN_DUEL_VS_MONSTER_TEMPLATE',
        target_ref: 'duelista iniciante',
        required_count: 3,
        order_index: 0
      }
    ], null, 2);
    this.prerequisiteDraft = this.normalizePrerequisites(definition?.prerequisites || []);
    form.elements.prerequisites_json.value = JSON.stringify(this.prerequisiteDraft, null, 2);
    this.renderPrerequisiteDraft();
    this.loadPrerequisiteCandidates();
    const rewards = Array.isArray(definition?.rewards) ? definition.rewards : [];
    const expReward = rewards.find((reward) => String(reward.reward_type || '').toUpperCase() === 'EXP');
    const expMeta = this.tryParseMetadata(expReward?.metadata_json);
    form.elements.reward_exp_amount.value = expReward ? Math.max(0, Number(expReward.amount || 0)) : 3;
    form.elements.reward_exp_match_type.value = String(expMeta.match_type || 'ai');

    this.populateRewardCardOptions();
    const selectedCardIds = new Set(
      rewards
        .filter((reward) => String(reward.reward_type || '').toUpperCase() === 'CARD_UNLOCK')
        .map((reward) => String(reward.reward_ref || '').trim())
        .filter((cardId) => cardId !== '')
    );
    const rewardCardsSelect = form.elements.reward_card_ids;
    if (rewardCardsSelect && rewardCardsSelect.options) {
      for (const option of rewardCardsSelect.options) {
        option.selected = selectedCardIds.has(option.value);
      }
    }

    const extraRewards = rewards.filter((reward) => {
      const type = String(reward.reward_type || '').toUpperCase();
      return type !== 'EXP' && type !== 'CARD_UNLOCK';
    });
    form.dataset.extraRewardsJson = JSON.stringify(extraRewards);
    form.elements.extra_rewards_json.value = JSON.stringify(extraRewards, null, 2);
    this.showModal('quest-definition-modal');
  }

  async saveNpcTemplate() {
    const form = document.getElementById('npc-template-form');
    if (!form) return;
    const payload = {
      code: String(form.elements.code.value || '').trim(),
      name: String(form.elements.name.value || '').trim(),
      sprite_ref: String(form.elements.sprite_ref.value || '').trim(),
      frame_count: Number(form.elements.frame_count.value || 6),
      frame_cols: Number(form.elements.frame_cols.value || 6),
      frame_rows: Number(form.elements.frame_rows.value || 1),
      idle_start: Number(form.elements.idle_start.value || 0),
      idle_count: Number(form.elements.idle_count.value || 6),
      dialogue_json: this.tryParseJson(form.elements.dialogue_json.value, [])
    };
    if (form.elements.id.value) {
      await apiClient.updateNpcTemplate(form.elements.id.value, payload);
    } else {
      await apiClient.createNpcTemplate(payload);
    }
    this.hideModal('npc-template-modal');
    await this.loadData();
  }

  async saveNpcSpawn() {
    const form = document.getElementById('npc-spawn-form');
    if (!form) return;
    const payload = {
      npc_template_id: Number(form.elements.npc_template_id.value || 0),
      zone: String(form.elements.zone.value || 'shadowland').trim().toLowerCase(),
      spawn_x: Number(form.elements.spawn_x.value || 0),
      spawn_y: Number(form.elements.spawn_y.value || 0),
      interaction_radius: Number(form.elements.interaction_radius.value || 90)
    };
    if (form.elements.spawn_uid.value) {
      await apiClient.updateNpcSpawn(form.elements.spawn_uid.value, payload);
    } else {
      await apiClient.createNpcSpawn(payload);
    }
    this.hideModal('npc-spawn-modal');
    await this.loadData();
  }

  async saveQuestDefinition() {
    const form = document.getElementById('quest-definition-form');
    if (!form) return;
    this.syncPrerequisitesJsonField();
    const rewards = this.buildQuestRewardsPayload(form);
    const payload = {
      code: String(form.elements.code.value || '').trim(),
      title: String(form.elements.title.value || '').trim(),
      description: String(form.elements.description.value || ''),
      giver_npc_template_id: form.elements.giver_npc_template_id.value ? Number(form.elements.giver_npc_template_id.value) : null,
      turnin_npc_template_id: form.elements.turnin_npc_template_id.value ? Number(form.elements.turnin_npc_template_id.value) : null,
      min_level: Number(form.elements.min_level.value || 1),
      recurrence_type: String(form.elements.recurrence_type.value || 'none'),
      auto_track: !!form.elements.auto_track.checked,
      objective_logic: String(form.elements.objective_logic.value || 'all'),
      is_active: !!form.elements.is_active.checked,
      objectives: this.tryParseJson(form.elements.objectives_json.value, []),
      prerequisites: this.tryParseJson(form.elements.prerequisites_json.value, []),
      rewards
    };
    if (form.elements.id.value) {
      await apiClient.updateQuestDefinition(form.elements.id.value, payload);
    } else {
      await apiClient.createQuestDefinition(payload);
    }
    this.hideModal('quest-definition-modal');
    await this.loadData();
  }

  normalizePrerequisites(rawList) {
    if (!Array.isArray(rawList)) return [];
    const normalized = [];
    const unique = new Set();
    for (const raw of rawList) {
      if (!raw || typeof raw !== 'object') continue;
      const prerequisiteType = String(raw.prerequisite_type || raw.type || 'QUEST_COMPLETED').trim().toUpperCase();
      const referenceValue = String(raw.reference_value || raw.quest_id || raw.quest_code || '').trim();
      if (!referenceValue) continue;
      const key = `${prerequisiteType}:${referenceValue.toLowerCase()}`;
      if (unique.has(key)) continue;
      unique.add(key);
      normalized.push({
        prerequisite_type: prerequisiteType,
        reference_value: referenceValue,
        operator: String(raw.operator || 'eq'),
        required_count: Math.max(1, Number(raw.required_count || 1))
      });
    }
    return normalized;
  }

  syncPrerequisitesJsonField() {
    const form = document.getElementById('quest-definition-form');
    if (!form) return;
    form.elements.prerequisites_json.value = JSON.stringify(this.prerequisiteDraft, null, 2);
  }

  renderPrerequisiteDraft() {
    const container = document.getElementById('quest-prereq-selected');
    if (!container) return;
    if (!Array.isArray(this.prerequisiteDraft) || this.prerequisiteDraft.length === 0) {
      container.innerHTML = '<small>Nenhum pré-requisito configurado.</small>';
      this.syncPrerequisitesJsonField();
      return;
    }
    container.innerHTML = this.prerequisiteDraft.map((item) => `
      <span class="quest-prereq-pill">
        ${item.reference_value}
        <button type="button" data-prereq-ref="${item.reference_value}" title="Remover">✕</button>
      </span>
    `).join('');
    this.syncPrerequisitesJsonField();
  }

  async loadPrerequisiteCandidates() {
    const searchInput = document.getElementById('quest-prereq-search');
    const search = String(searchInput?.value || '').trim();
    try {
      const result = await apiClient.getQuestDefinitions({
        page: 1,
        limit: 50,
        search,
        include_inactive: true
      });
      this.prerequisiteCandidates = Array.isArray(result.definitions) ? result.definitions : [];
    } catch (error) {
      console.error('Failed to load prerequisite candidates', error);
      this.prerequisiteCandidates = [];
    }
    this.renderPrerequisiteCandidateOptions();
  }

  renderPrerequisiteCandidateOptions() {
    const select = document.getElementById('quest-prereq-select');
    if (!select) return;
    const form = document.getElementById('quest-definition-form');
    const currentQuestId = Number(form?.elements?.id?.value || 0);
    const candidates = (this.prerequisiteCandidates || []).filter((quest) => Number(quest.id) !== currentQuestId);
    select.innerHTML = candidates
      .map((quest) => `<option value="${quest.code}">${quest.title} (${quest.code})</option>`)
      .join('');
  }

  addSelectedPrerequisiteFromPicker() {
    const select = document.getElementById('quest-prereq-select');
    if (!select) return;
    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption) return;
    const referenceValue = String(selectedOption.value || '').trim();
    if (referenceValue === '') return;
    const exists = this.prerequisiteDraft.some(
      (item) => String(item.prerequisite_type || '').toUpperCase() === 'QUEST_COMPLETED'
        && String(item.reference_value || '').trim().toLowerCase() === referenceValue.toLowerCase()
    );
    if (exists) return;
    this.prerequisiteDraft.push({
      prerequisite_type: 'QUEST_COMPLETED',
      reference_value: referenceValue,
      operator: 'eq',
      required_count: 1
    });
    this.renderPrerequisiteDraft();
  }

  editNpcTemplate(id) {
    const template = this.npcTemplates.find((item) => Number(item.id) === Number(id));
    if (!template) return;
    this.showNpcTemplateModal(template);
  }

  editNpcSpawn(spawnUid) {
    const spawn = this.npcSpawns.find((item) => String(item.spawn_uid) === String(spawnUid));
    if (!spawn) return;
    this.showNpcSpawnModal(spawn);
  }

  editQuestDefinition(id) {
    const definition = this.questDefinitions.find((item) => Number(item.id) === Number(id))
      || this.npcQuestDefinitions.find((item) => Number(item.id) === Number(id));
    if (!definition) return;
    this.showQuestModal(definition);
  }

  async deleteNpcSpawn(spawnUid) {
    if (!confirm('Remover este spawn de NPC?')) return;
    await apiClient.deleteNpcSpawn(spawnUid);
    await this.loadData();
  }

  async seedInitial() {
    const result = await apiClient.seedInitialNpcQuest();
    alert(`Seed concluido. NPC=${result.npc_template_id} Quest=${result.quest_id}`);
    await this.loadData();
  }

  showModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
  }

  hideModal(id) {
    document.getElementById(id)?.classList.add('hidden');
  }

  tryParseJson(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed;
    } catch {
      return fallback;
    }
  }

  tryParseMetadata(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  populateRewardCardOptions() {
    const select = document.getElementById('quest-reward-card-ids');
    if (!select) return;
    const previousSelected = new Set(Array.from(select.selectedOptions || []).map((option) => option.value));
    const options = (this.cards || [])
      .map((card) => `<option value="${card.id}">${card.name} (${card.id})</option>`)
      .join('');
    select.innerHTML = options;
    for (const option of select.options) {
      option.selected = previousSelected.has(option.value);
    }
  }

  buildQuestRewardsPayload(form) {
    const rewards = [];
    const expAmount = Number(form.elements.reward_exp_amount.value || 0);
    const expMatchType = String(form.elements.reward_exp_match_type.value || 'ai').trim() || 'ai';
    if (expAmount > 0) {
      rewards.push({
        reward_type: 'EXP',
        reward_ref: expMatchType,
        amount: Math.floor(expAmount),
        metadata_json: JSON.stringify({ match_type: expMatchType })
      });
    }

    const selectedCardIds = new Set(
      Array.from(form.elements.reward_card_ids.selectedOptions || [])
        .map((option) => String(option.value || '').trim())
        .filter((cardId) => cardId !== '')
    );
    selectedCardIds.forEach((cardId) => {
      rewards.push({
        reward_type: 'CARD_UNLOCK',
        reward_ref: cardId,
        amount: 1,
        metadata_json: null
      });
    });

    const extraRewardsRaw = form.dataset.extraRewardsJson || form.elements.extra_rewards_json.value || '[]';
    const extraRewards = this.tryParseJson(extraRewardsRaw, []);
    if (Array.isArray(extraRewards)) {
      for (const reward of extraRewards) {
        rewards.push(reward);
      }
    }
    return rewards;
  }
}

const questManager = new QuestManager();
window.questManager = questManager;
