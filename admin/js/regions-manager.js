/**
 * RegionsManager — gerencia a aba de Regiões do admin.
 *
 * Funcionalidades:
 *  - Listar regiões com opção de editar raio/nome e deletar
 *  - Canvas mostrando o mapa do mundo com círculos representando os raios
 *  - Highlight de região ao clicar na tabela
 */
class RegionsManager {
    constructor() {
        this._regions = [];
        this._selectedId = null;
        this._canvas = null;
        this._ctx = null;

        // Bounds do mundo ISO (calculados de map_to_local nos chunks bakeados).
        // center_x/center_y das regiões são armazenados nessas coords.
        this._worldMin = { x: 31775, y: 16 };
        this._worldMax = { x: 95232, y: 32768 };

        this._creating = false; // modo de posicionamento via canvas

        document.getElementById('btn-regions-refresh')?.addEventListener('click', () => this.loadRegions());
        document.getElementById('regions-zone-filter')?.addEventListener('change', () => this.loadRegions());
        document.getElementById('region-edit-cancel')?.addEventListener('click', () => this._closeEditModal());
        document.getElementById('region-edit-save')?.addEventListener('click', () => this._saveEdit());
        document.getElementById('btn-region-new')?.addEventListener('click', () => this._openCreateModal());
        document.getElementById('region-create-cancel')?.addEventListener('click', () => this._closeCreateModal());
        document.getElementById('region-create-save')?.addEventListener('click', () => this._saveCreate());

        const canvas = document.getElementById('regions-map-canvas');
        if (canvas) {
            this._canvas = canvas;
            this._ctx = canvas.getContext('2d');
            canvas.addEventListener('mousemove', (e) => this._onCanvasHover(e));
            canvas.addEventListener('click', (e) => this._onCanvasClick(e));
        }
    }

    get _zone() {
        return document.getElementById('regions-zone-filter')?.value || 'shadowland';
    }

    async loadRegions() {
        const tbody = document.getElementById('regions-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="padding:12px 4px;color:#64748b;">Carregando...</td></tr>';
        try {
            const data = await apiClient.getAdminRegions(this._zone);
            this._regions = data.regions || [];
            this._renderTable();
            this._renderCanvas();
        } catch (e) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="color:#f87171;">Erro: ${e.message}</td></tr>`;
        }
    }

    _renderTable() {
        const tbody = document.getElementById('regions-table-body');
        if (!tbody) return;
        if (!this._regions.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:12px 4px;color:#64748b;">Nenhuma região cadastrada. Use /spawnpoint no jogo.</td></tr>';
            return;
        }
        tbody.innerHTML = this._regions.map(r => `
            <tr data-id="${r.id}" style="border-bottom:1px solid #1e293b;cursor:pointer;transition:background 0.15s;"
                onmouseenter="this.style.background='#1e293b'" onmouseleave="this.style.background=''"
                onclick="regionsManager.selectRegion(${r.id})">
                <td style="padding:8px 4px;font-weight:500;color:${r.is_active ? '#e2e8f0' : '#64748b'};">
                    ${r.is_active ? '' : '<span style="color:#f87171;font-size:0.75rem;">[inativa] </span>'}${r.name}
                </td>
                <td style="padding:8px 4px;text-align:right;color:#94a3b8;">${r.radius}</td>
                <td style="padding:8px 4px;text-align:right;color:#64748b;font-size:0.8rem;">${Math.round(r.x)}</td>
                <td style="padding:8px 4px;text-align:right;color:#64748b;font-size:0.8rem;">${Math.round(r.y)}</td>
                <td style="padding:8px 4px;text-align:right;">
                    <button onclick="event.stopPropagation();regionsManager.editRegion(${r.id})"
                        style="background:#1e40af;color:#fff;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.78rem;margin-right:4px;">Editar</button>
                    <button onclick="event.stopPropagation();regionsManager.deleteRegion(${r.id},'${r.name.replace(/'/g,"\\'")}')"
                        style="background:#7f1d1d;color:#fff;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.78rem;">Deletar</button>
                </td>
            </tr>
        `).join('');
    }

    // ─── Canvas ──────────────────────────────────────────────────────────────

    _worldToCanvas(wx, wy) {
        const { x: wMinX, y: wMinY } = this._worldMin;
        const { x: wMaxX, y: wMaxY } = this._worldMax;
        const cw = this._canvas.width;
        const ch = this._canvas.height;
        const pad = 16;
        const cx = pad + ((wx - wMinX) / (wMaxX - wMinX)) * (cw - pad * 2);
        const cy = pad + ((wy - wMinY) / (wMaxY - wMinY)) * (ch - pad * 2);
        return { x: cx, y: cy };
    }

    _radiusToCanvas(radius) {
        const { x: wMinX } = this._worldMin;
        const { x: wMaxX } = this._worldMax;
        const cw = this._canvas.width;
        const pad = 16;
        return radius / (wMaxX - wMinX) * (cw - pad * 2);
    }

    _renderCanvas() {
        if (!this._ctx || !this._canvas) return;
        const ctx = this._ctx;
        const cw = this._canvas.width;
        const ch = this._canvas.height;

        // Fundo — gradiente evocando o mapa do mundo
        ctx.fillStyle = '#0a1a0a';
        ctx.fillRect(0, 0, cw, ch);

        // Grade sutil
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < cw; gx += 54) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ch); ctx.stroke(); }
        for (let gy = 0; gy < ch; gy += 28) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke(); }

        // Borda do mundo jogável
        const topL = this._worldToCanvas(this._worldMin.x, this._worldMin.y);
        const botR = this._worldToCanvas(this._worldMax.x, this._worldMax.y);
        ctx.strokeStyle = 'rgba(100,220,100,0.15)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(topL.x, topL.y, botR.x - topL.x, botR.y - topL.y);
        ctx.fillStyle = 'rgba(100,220,100,0.04)';
        ctx.fillRect(topL.x, topL.y, botR.x - topL.x, botR.y - topL.y);

        // Label mundo
        ctx.fillStyle = 'rgba(100,220,100,0.3)';
        ctx.font = '10px monospace';
        ctx.fillText('Shadowland', topL.x + 4, topL.y + 12);

        if (!this._regions.length) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Nenhuma região cadastrada', cw / 2, ch / 2);
            ctx.textAlign = 'left';
            return;
        }

        // Regiões
        this._regions.forEach(r => {
            if (!r.is_active) return;
            const pt = this._worldToCanvas(r.x, r.y);
            const cr = this._radiusToCanvas(r.radius);
            const isSelected = r.id === this._selectedId;
            const alpha = isSelected ? 0.55 : 0.22;
            const strokeA = isSelected ? 0.9 : 0.55;
            const color = isSelected ? '255,180,50' : '80,180,255';

            // Círculo de raio
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, Math.max(cr, 3), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color},${alpha})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(${color},${strokeA})`;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.stroke();

            // Ponto central
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, isSelected ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color},1)`;
            ctx.fill();

            // Nome
            ctx.fillStyle = isSelected ? '#ffb432' : 'rgba(220,240,255,0.85)';
            ctx.font = `${isSelected ? 'bold ' : ''}11px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(r.name, pt.x, pt.y - Math.max(cr, 5) - 4);

            // Raio em px se selecionado
            if (isSelected) {
                ctx.fillStyle = 'rgba(255,200,80,0.7)';
                ctx.font = '10px monospace';
                ctx.fillText(`r=${r.radius}`, pt.x, pt.y + Math.max(cr, 5) + 12);
            }
        });
        ctx.textAlign = 'left';
    }

    _getRegionAtCanvas(canvasX, canvasY) {
        for (const r of this._regions) {
            if (!r.is_active) continue;
            const pt = this._worldToCanvas(r.x, r.y);
            const cr = Math.max(this._radiusToCanvas(r.radius), 6);
            const dx = canvasX - pt.x, dy = canvasY - pt.y;
            if (dx * dx + dy * dy <= cr * cr) return r;
        }
        return null;
    }

    _canvasEventCoords(e) {
        const rect = this._canvas.getBoundingClientRect();
        const scaleX = this._canvas.width / rect.width;
        const scaleY = this._canvas.height / rect.height;
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }

    _onCanvasHover(e) {
        const { x, y } = this._canvasEventCoords(e);
        const r = this._getRegionAtCanvas(x, y);
        const hint = document.getElementById('regions-map-hint');
        if (r) {
            this._canvas.style.cursor = 'pointer';
            if (hint) hint.textContent = `${r.name}  —  raio: ${r.radius}px  |  pos: (${Math.round(r.x)}, ${Math.round(r.y)})`;
        } else {
            this._canvas.style.cursor = 'crosshair';
            if (hint) hint.textContent = '—';
        }
    }

    _onCanvasClick(e) {
        const { x, y } = this._canvasEventCoords(e);
        const r = this._getRegionAtCanvas(x, y);
        if (r) {
            this.selectRegion(r.id);
            return;
        }
        // Clique em área vazia → pré-preenche posição no modal de criar
        const wx = Math.round(this._worldMin.x + ((x - 16) / (this._canvas.width - 32)) * (this._worldMax.x - this._worldMin.x));
        const wy = Math.round(this._worldMin.y + ((y - 16) / (this._canvas.height - 32)) * (this._worldMax.y - this._worldMin.y));
        this._openCreateModal(wx, wy);
    }

    selectRegion(id) {
        this._selectedId = this._selectedId === id ? null : id;
        // Highlight na tabela
        document.querySelectorAll('#regions-table-body tr').forEach(tr => {
            tr.style.background = String(tr.dataset.id) === String(id) && this._selectedId ? '#1e3a5f' : '';
        });
        this._renderCanvas();
    }

    // ─── CRUD ──────────────────────────────────────────────────────────────

    // ─── Criar ───────────────────────────────────────────────────────────────

    _openCreateModal(wx = null, wy = null) {
        document.getElementById('region-create-name').value = '';
        document.getElementById('region-create-radius').value = 800;
        if (wx !== null) {
            document.getElementById('region-create-x').value = wx;
            document.getElementById('region-create-y').value = wy;
            document.getElementById('region-create-pos-hint').textContent = `Posição selecionada no mapa: (${wx}, ${wy}) — pode editar abaixo.`;
        } else {
            document.getElementById('region-create-x').value = '';
            document.getElementById('region-create-y').value = '';
            document.getElementById('region-create-pos-hint').textContent = 'Preencha os campos ou clique no mapa para posicionar.';
        }
        const modal = document.getElementById('region-create-modal');
        if (modal) modal.style.display = 'flex';
        setTimeout(() => document.getElementById('region-create-name')?.focus(), 50);
    }

    _closeCreateModal() {
        const modal = document.getElementById('region-create-modal');
        if (modal) modal.style.display = 'none';
    }

    async _saveCreate() {
        const name   = (document.getElementById('region-create-name').value || '').trim();
        const x      = Number(document.getElementById('region-create-x').value);
        const y      = Number(document.getElementById('region-create-y').value);
        const radius = Number(document.getElementById('region-create-radius').value) || 800;
        if (!name)             { alert('Nome é obrigatório.'); return; }
        if (!x && !y)          { alert('Informe a posição X/Y ou clique no mapa.'); return; }
        if (radius < 50)       { alert('Raio mínimo: 50.'); return; }
        const btn = document.getElementById('region-create-save');
        btn.disabled = true; btn.textContent = 'Criando...';
        try {
            await apiClient.createRegion({ name, zone: this._zone, x, y, radius });
            this._closeCreateModal();
            await this.loadRegions();
        } catch (err) {
            alert('Erro ao criar região: ' + err.message);
        } finally {
            btn.disabled = false; btn.textContent = 'Criar Região';
        }
    }

    editRegion(id) {
        const r = this._regions.find(r => r.id === id);
        if (!r) return;
        document.getElementById('region-edit-id').value = id;
        document.getElementById('region-edit-title').textContent = `Editar — ${r.name}`;
        document.getElementById('region-edit-name').value = r.name;
        document.getElementById('region-edit-radius').value = r.radius;
        const modal = document.getElementById('region-edit-modal');
        if (modal) modal.style.display = 'flex';
    }

    _closeEditModal() {
        const modal = document.getElementById('region-edit-modal');
        if (modal) modal.style.display = 'none';
    }

    async _saveEdit() {
        const id = Number(document.getElementById('region-edit-id').value);
        const name = document.getElementById('region-edit-name').value.trim();
        const radius = Number(document.getElementById('region-edit-radius').value);
        if (!name || !radius || radius < 50) { alert('Nome e raio (mín. 50) são obrigatórios.'); return; }
        try {
            await apiClient.updateRegion(id, { name, radius });
            this._closeEditModal();
            await this.loadRegions();
        } catch (e) { alert('Erro ao salvar: ' + e.message); }
    }

    async deleteRegion(id, name) {
        if (!confirm(`Deletar a região "${name}"?\n\nIsso remove o marcador e o efeito Dark Souls para todos os jogadores.`)) return;
        try {
            await apiClient.deleteRegion(id);
            if (this._selectedId === id) this._selectedId = null;
            await this.loadRegions();
        } catch (e) { alert('Erro ao deletar: ' + e.message); }
    }
}

const regionsManager = new RegionsManager();
window.regionsManager = regionsManager;
