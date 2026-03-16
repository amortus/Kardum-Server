// Booster Manager - Gerenciamento de boosters
class BoosterManager {
  constructor() {
    this.boosters = [];
    this.cards = [];
  }

  async init() {
    await this.loadBoosters();
    await this.loadCards();
    this.setupEventListeners();
  }

  async loadBoosters() {
    try {
      const response = await apiClient.getBoosters();
      this.boosters = response.boosters || [];
      this.renderBoosters();
    } catch (error) {
      console.error('Failed to load boosters:', error);
    }
  }

  async loadCards() {
    try {
      const response = await apiClient.getCards();
      this.cards = response.cards || [];
    } catch (error) {
      console.error('Failed to load cards:', error);
    }
  }

  setupEventListeners() {
    document.getElementById('btn-new-booster')?.addEventListener('click', () => {
      this.showBoosterForm();
    });
  }

  renderBoosters() {
    const container = document.getElementById('boosters-list');
    if (!container) return;

    if (this.boosters.length === 0) {
      container.innerHTML = '<p style="color: #ccc; padding: 20px;">Nenhum booster criado ainda.</p>';
      return;
    }

    container.innerHTML = this.boosters.map(booster => `
      <div class="booster-card">
        <div class="booster-header">
          <h3>${booster.name}</h3>
          <div class="booster-actions">
            <button class="btn-small" onclick="boosterManager.editBooster('${booster.id}')">Editar</button>
            <button class="btn-small btn-danger" onclick="boosterManager.deleteBooster('${booster.id}')">Deletar</button>
          </div>
        </div>
        <div class="booster-info">
          <p><strong>Descrição:</strong> ${booster.description || 'N/A'}</p>
          <p><strong>Cartas por pack:</strong> ${booster.cards_per_pack}</p>
          <p><strong>Preço:</strong> ${booster.price}</p>
          <p><strong>Cartas na coleção:</strong> ${booster.card_collection?.length || 0}</p>
          <p><strong>Status:</strong> ${booster.is_active ? 'Ativo' : 'Inativo'}</p>
          <div class="rarity-weights">
            <strong>Pesos de Raridade:</strong>
            <ul>
              <li>Comum: ${booster.rarity_weights?.common || 0}%</li>
              <li>Rara: ${booster.rarity_weights?.rare || 0}%</li>
              <li>Épica: ${booster.rarity_weights?.epic || 0}%</li>
              <li>Lendária: ${booster.rarity_weights?.legendary || 0}%</li>
            </ul>
          </div>
        </div>
      </div>
    `).join('');
  }

  showBoosterForm(boosterId = null) {
    const booster = boosterId ? this.boosters.find(b => b.id === boosterId) : null;
    
    // Criar modal de formulário
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <h2>${booster ? 'Editar Booster' : 'Novo Booster'}</h2>
        <form id="booster-form">
          <div class="form-group">
            <label>ID</label>
            <input type="text" name="id" value="${booster?.id || ''}" required ${booster ? 'readonly' : ''} />
          </div>
          <div class="form-group">
            <label>Nome</label>
            <input type="text" name="name" value="${booster?.name || ''}" required />
          </div>
          <div class="form-group">
            <label>Descrição</label>
            <textarea name="description" rows="3">${booster?.description || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Cartas por Pack</label>
            <input type="number" name="cards_per_pack" value="${booster?.cards_per_pack || 5}" min="1" max="10" required />
          </div>
          <div class="form-group">
            <label>Preço</label>
            <input type="number" name="price" value="${booster?.price || 100}" min="0" required />
          </div>
          <div class="form-group">
            <label>Coleção de Cartas</label>
            <div id="card-selection" style="max-height: 200px; overflow-y: auto; border: 1px solid #444; padding: 10px; border-radius: 4px;">
              ${this.renderCardSelection(booster?.card_collection || [])}
            </div>
          </div>
          <div class="form-group">
            <label>Pesos de Raridade (%)</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label>Comum</label>
                <input type="number" name="rarity_common" value="${booster?.rarity_weights?.common || 70}" min="0" max="100" />
              </div>
              <div>
                <label>Rara</label>
                <input type="number" name="rarity_rare" value="${booster?.rarity_weights?.rare || 20}" min="0" max="100" />
              </div>
              <div>
                <label>Épica</label>
                <input type="number" name="rarity_epic" value="${booster?.rarity_weights?.epic || 8}" min="0" max="100" />
              </div>
              <div>
                <label>Lendária</label>
                <input type="number" name="rarity_legendary" value="${booster?.rarity_weights?.legendary || 2}" min="0" max="100" />
              </div>
            </div>
            <small style="color: #999;">Total deve somar 100%</small>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Salvar</button>
            <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());

    // Setup form submission
    modal.querySelector('#booster-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveBooster(modal, booster);
    });
  }

  renderCardSelection(selectedIds = []) {
    if (this.cards.length === 0) {
      return '<p style="color: #999;">Carregando cartas...</p>';
    }

    return this.cards.map(card => `
      <label style="display: flex; align-items: center; padding: 5px; cursor: pointer;">
        <input type="checkbox" name="card_ids" value="${card.id}" ${selectedIds.includes(card.id) ? 'checked' : ''} />
        <span style="margin-left: 8px;">${card.name} (${card.type})</span>
      </label>
    `).join('');
  }

  async saveBooster(modal, existingBooster) {
    const form = modal.querySelector('#booster-form');
    const formData = new FormData(form);
    
    const selectedCards = Array.from(form.querySelectorAll('input[name="card_ids"]:checked')).map(cb => cb.value);

    const booster = {
      id: formData.get('id'),
      name: formData.get('name'),
      description: formData.get('description'),
      card_collection: selectedCards,
      cards_per_pack: parseInt(formData.get('cards_per_pack')),
      price: parseInt(formData.get('price')),
      rarity_weights: {
        common: parseInt(formData.get('rarity_common')),
        rare: parseInt(formData.get('rarity_rare')),
        epic: parseInt(formData.get('rarity_epic')),
        legendary: parseInt(formData.get('rarity_legendary'))
      },
      is_active: true
    };

    try {
      if (existingBooster) {
        await apiClient.updateBooster(existingBooster.id, booster);
      } else {
        await apiClient.createBooster(booster);
      }
      
      modal.remove();
      await this.loadBoosters();
    } catch (error) {
      console.error('Failed to save booster:', error);
      alert('Erro ao salvar booster: ' + error.message);
    }
  }

  async editBooster(boosterId) {
    this.showBoosterForm(boosterId);
  }

  async deleteBooster(boosterId) {
    if (!confirm('Tem certeza que deseja deletar este booster?')) {
      return;
    }

    try {
      await apiClient.deleteBooster(boosterId);
      await this.loadBoosters();
    } catch (error) {
      console.error('Failed to delete booster:', error);
      alert('Erro ao deletar booster: ' + error.message);
    }
  }
}

const boosterManager = new BoosterManager();
window.boosterManager = boosterManager;
