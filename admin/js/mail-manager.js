// admin/js/mail-manager.js
class MailManager {
  constructor() {
    this._wired = false;
  }

  wireOnce() {
    if (this._wired) return;
    this._wired = true;

    document.getElementById('btn-mail-send-user')?.addEventListener('click', () => this.sendUserMail());
    document.getElementById('btn-mail-create-campaign')?.addEventListener('click', () => this.createCampaign());
    document.getElementById('btn-mail-refresh-campaigns')?.addEventListener('click', () => this.refreshCampaigns());
    document.getElementById('btn-mail-refresh-campaigns-2')?.addEventListener('click', () => this.refreshCampaigns());
  }

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  _readJson(id) {
    const el = document.getElementById(id);
    const raw = String(el?.value || '').trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error('JSON inválido em audiência');
    }
  }

  async init() {
    this.wireOnce();
    await this.refreshCampaigns();
  }

  async sendUserMail() {
    try {
      this._setText('mail-user-result', '');
      const userId = Number(document.getElementById('mail-user-id')?.value || 0);
      const subject = String(document.getElementById('mail-user-subject')?.value || '').trim();
      const body = String(document.getElementById('mail-user-body')?.value || '').trim();
      const deliverAtRaw = String(document.getElementById('mail-user-deliver-at')?.value || '').trim();
      const cardId = String(document.getElementById('mail-user-card-id')?.value || '').trim();

      if (!userId || !subject || !body) {
        this._setText('mail-user-result', 'Preencha userId, assunto e mensagem.');
        return;
      }
      const attachments = [];
      if (cardId) attachments.push({ type: 'card_unlock', cardId });

      const payload = {
        userId,
        subject,
        body,
        deliverAt: deliverAtRaw || undefined,
        attachments
      };
      const res = await apiClient.sendUserMail(payload);
      this._setText('mail-user-result', `Enviado. mailId=${res.mailId}`);
    } catch (e) {
      this._setText('mail-user-result', `Erro: ${e.message || e}`);
    }
  }

  async createCampaign() {
    try {
      this._setText('mail-campaign-result', '');
      const name = String(document.getElementById('mail-campaign-name')?.value || '').trim();
      const subject = String(document.getElementById('mail-campaign-subject')?.value || '').trim();
      const body = String(document.getElementById('mail-campaign-body')?.value || '').trim();
      const deliverAt = String(document.getElementById('mail-campaign-deliver-at')?.value || '').trim();
      const audienceType = String(document.getElementById('mail-campaign-audience-type')?.value || 'all_users');
      const audienceExtra = this._readJson('mail-campaign-audience-json');
      const cardId = String(document.getElementById('mail-campaign-card-id')?.value || '').trim();

      if (!name || !subject || !body || !deliverAt) {
        this._setText('mail-campaign-result', 'Preencha nome, assunto, mensagem e deliverAt (ISO).');
        return;
      }
      const audience = { type: audienceType, ...audienceExtra };
      const attachments = [];
      if (cardId) attachments.push({ type: 'card_unlock', cardId });

      const res = await apiClient.createMailCampaign({ name, subject, body, deliverAt, audience, attachments });
      this._setText('mail-campaign-result', `Agendado. campaignId=${res.campaignId}`);
      await this.refreshCampaigns();
    } catch (e) {
      this._setText('mail-campaign-result', `Erro: ${e.message || e}`);
    }
  }

  async refreshCampaigns() {
    const tbody = document.getElementById('mail-campaigns-table');
    if (!tbody) return;
    try {
      const res = await apiClient.listMailCampaigns();
      const rows = res.campaigns || [];
      tbody.innerHTML = '';
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan=\"5\">Nenhuma campanha.</td></tr>';
        return;
      }
      for (const c of rows) {
        const tr = document.createElement('tr');
        const deliver = c.deliver_at || c.deliverAt || '';
        tr.innerHTML = `
          <td>${c.id}</td>
          <td>${(c.name || '').toString()}</td>
          <td>${(c.status || '').toString()}</td>
          <td><code>${deliver}</code></td>
          <td>
            <button class=\"btn-secondary\" data-action=\"cancel\" data-id=\"${c.id}\">Cancelar</button>
          </td>
        `;
        tbody.appendChild(tr);
      }
      tbody.querySelectorAll('button[data-action=\"cancel\"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.getAttribute('data-id') || 0);
          if (!id) return;
          if (!confirm(`Cancelar campanha ${id}?`)) return;
          try {
            await apiClient.cancelMailCampaign(id);
            await this.refreshCampaigns();
          } catch (e) {
            alert(`Erro ao cancelar: ${e.message || e}`);
          }
        });
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan=\"5\">Falha ao carregar: ${(e.message || e)}</td></tr>`;
    }
  }
}

window.mailManager = new MailManager();

