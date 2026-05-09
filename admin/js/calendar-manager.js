// admin/js/calendar-manager.js
class CalendarManager {
  constructor() {
    this._wired = false;
    this._daysTotal = 20;
  }

  wireOnce() {
    if (this._wired) return;
    this._wired = true;
    document.getElementById('btn-cal-load')?.addEventListener('click', () => this.load());
    document.getElementById('btn-cal-save')?.addEventListener('click', () => this.save());
  }

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  _month() {
    return String(document.getElementById('cal-month')?.value || '').trim();
  }

  _grid() {
    return document.getElementById('cal-days-grid');
  }

  init() {
    this.wireOnce();
    if (!this._grid().children.length) {
      this._renderDays(20);
    }
  }

  _renderDays(daysTotal) {
    const grid = this._grid();
    if (!grid) return;
    grid.innerHTML = '';
    this._daysTotal = daysTotal;
    for (let day = 1; day <= daysTotal; day++) {
      const box = document.createElement('div');
      box.className = 'card-editor-panel';
      box.style.padding = '10px';
      box.innerHTML = `
        <div style="font-weight:600;margin-bottom:6px;">Dia ${day}</div>
        <div class="form-row">
          <label>Gold</label>
          <input type="number" min="0" step="1" id="cal-gold-${day}" placeholder="0" />
        </div>
        <div class="form-row">
          <label>Card Unlock (cardId)</label>
          <input type="text" id="cal-card-${day}" placeholder="opcional" />
        </div>
      `;
      grid.appendChild(box);
    }
  }

  _collectRewards() {
    const days = [];
    for (let day = 1; day <= this._daysTotal; day++) {
      const gold = Number(document.getElementById(`cal-gold-${day}`)?.value || 0);
      const cardId = String(document.getElementById(`cal-card-${day}`)?.value || '').trim();
      const rewards = [];
      if (Number.isFinite(gold) && gold > 0) rewards.push({ type: 'gold', amount: Math.floor(gold) });
      if (cardId) rewards.push({ type: 'card_unlock', cardId });
      days.push({ day, rewards });
    }
    return days;
  }

  _applyRewards(rewards) {
    const map = new Map();
    (Array.isArray(rewards) ? rewards : []).forEach((r) => {
      if (!r) return;
      map.set(Number(r.day), r.rewards || []);
    });
    for (let day = 1; day <= this._daysTotal; day++) {
      const rr = map.get(day) || [];
      const gold = rr.find((x) => x.type === 'gold');
      const card = rr.find((x) => x.type === 'card_unlock');
      const goldEl = document.getElementById(`cal-gold-${day}`);
      const cardEl = document.getElementById(`cal-card-${day}`);
      if (goldEl) goldEl.value = gold ? Number(gold.amount || 0) : 0;
      if (cardEl) cardEl.value = card ? String(card.cardId || '') : '';
    }
  }

  async load() {
    try {
      this._setText('cal-result', '');
      const month = this._month();
      if (!month) {
        this._setText('cal-result', 'Informe o mês (YYYY-MM).');
        return;
      }
      const res = await apiClient.getDailyLoginConfig(month);
      const cfg = res.config;
      const daysTotal = cfg ? Number(cfg.days_total || 20) : 20;
      const isActive = cfg ? Number(cfg.is_active || 1) : 1;
      document.getElementById('cal-days-total').value = daysTotal;
      document.getElementById('cal-is-active').value = String(isActive);
      this._renderDays(daysTotal);
      let rewards = [];
      if (cfg && cfg.rewards_json) {
        try { rewards = JSON.parse(cfg.rewards_json); } catch (_e) { rewards = []; }
      }
      this._applyRewards(rewards);
      this._setText('cal-result', 'Config carregada.');
    } catch (e) {
      this._setText('cal-result', `Erro: ${e.message || e}`);
    }
  }

  async save() {
    try {
      this._setText('cal-result', '');
      const month = this._month();
      const daysTotal = Number(document.getElementById('cal-days-total')?.value || 20);
      const isActive = Number(document.getElementById('cal-is-active')?.value || 1);
      if (!month) {
        this._setText('cal-result', 'Informe o mês (YYYY-MM).');
        return;
      }
      if (!Number.isFinite(daysTotal) || daysTotal <= 0) {
        this._setText('cal-result', 'Dias inválido.');
        return;
      }
      const rewards = this._collectRewards();
      await apiClient.upsertDailyLoginConfig({
        month,
        days_total: Math.floor(daysTotal),
        is_active: isActive ? 1 : 0,
        rewards
      });
      this._setText('cal-result', 'Salvo com sucesso.');
    } catch (e) {
      this._setText('cal-result', `Erro: ${e.message || e}`);
    }
  }
}

window.calendarManager = new CalendarManager();

