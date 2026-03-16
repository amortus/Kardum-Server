class QuestManager {
  constructor() {
    this.npcTemplates = [];
    this.npcSpawns = [];
    this.questDefinitions = [];
    this.cards = [];
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
  }

  async loadData() {
    const [templatesRes, spawnsRes, questsRes, cardsRes] = await Promise.all([
      apiClient.getNpcTemplates(),
      apiClient.getNpcSpawns('shadowland'),
      apiClient.getQuestDefinitions(),
      apiClient.getCards()
    ]);
    this.npcTemplates = templatesRes.templates || [];
    this.npcSpawns = spawnsRes.spawns || [];
    this.questDefinitions = questsRes.definitions || [];
    this.cards = cardsRes.cards || [];
    this.render();
    this.populateTemplateSelects();
    this.populateRewardCardOptions();
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
    const definition = this.questDefinitions.find((item) => Number(item.id) === Number(id));
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
