/**
 * SpawnMapManager — mapa interativo de spawns de monstros.
 *
 * - Mostra todos os spawns como marcadores coloridos por template
 * - Clique em área vazia → modal para criar novo spawn na posição
 * - Clique em marcador existente → modal com info + botão deletar
 */
class SpawnMapManager {
    constructor() {
        this._spawns = [];
        this._templates = [];
        this._canvas = null;
        this._ctx = null;
        this._templateColors = {};
        this._colorPalette = [
            '#f87171','#fb923c','#fbbf24','#a3e635','#34d399',
            '#22d3ee','#60a5fa','#a78bfa','#f472b6','#e879f9',
            '#94a3b8','#ff6b35','#00cec9','#fdcb6e','#6c5ce7',
        ];
        this._colorIndex = 0;
        this._hoveredSpawn = null;

        // Bounds do mundo ISO (mesmos da RegionsManager)
        this._worldMin = { x: 31775, y: 16 };
        this._worldMax = { x: 95232, y: 32768 };

        this._initCanvas();
        this._bindButtons();
    }

    _initCanvas() {
        const canvas = document.getElementById('spawnmap-canvas');
        if (!canvas) return;
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');
        canvas.addEventListener('mousemove', e => this._onHover(e));
        canvas.addEventListener('click', e => this._onClick(e));
    }

    _bindButtons() {
        document.getElementById('btn-spawnmap-refresh')?.addEventListener('click', () => this.load());
        document.getElementById('spawnmap-zone')?.addEventListener('change', () => this.load());
        document.getElementById('spawnmap-create-cancel')?.addEventListener('click', () => this._closeCreate());
        document.getElementById('spawnmap-create-confirm')?.addEventListener('click', () => this._confirmCreate());
        document.getElementById('spawnmap-info-close')?.addEventListener('click', () => this._closeInfo());
        document.getElementById('spawnmap-info-delete')?.addEventListener('click', () => this._deleteSelected());
    }

    get _zone() { return document.getElementById('spawnmap-zone')?.value || 'shadowland'; }

    async load() {
        this._render(); // mostra loading
        try {
            const [spawnsRes, templatesRes] = await Promise.all([
                apiClient.getMonsterSpawns(this._zone),
                apiClient.getMonsterTemplates()
            ]);
            this._spawns = (spawnsRes.spawns || []);
            // Aceita resposta direta ou embrulhada em .templates / .data
            const rawTemplates = templatesRes.templates ?? templatesRes.data ?? templatesRes;
            this._templates = Array.isArray(rawTemplates) ? rawTemplates : [];
            this._buildColorMap();
            this._renderLegend();
            this._render();
        } catch (e) {
            console.error('[SpawnMap] load error', e);
        }
    }

    _buildColorMap() {
        this._templateColors = {};
        this._colorIndex = 0;
        const seen = new Set();
        for (const s of this._spawns) {
            const name = String(s.template_name || s.name || 'Desconhecido');
            if (!seen.has(name)) {
                seen.add(name);
                this._templateColors[name] = this._colorPalette[this._colorIndex++ % this._colorPalette.length];
            }
        }
    }

    _renderLegend() {
        const el = document.getElementById('spawnmap-legend');
        const total = document.getElementById('spawnmap-total');
        if (!el) return;
        const counts = {};
        for (const s of this._spawns) {
            const n = String(s.template_name || 'Desconhecido');
            counts[n] = (counts[n] || 0) + 1;
        }
        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        el.innerHTML = entries.map(([name, count]) => {
            const color = this._templateColors[name] || '#94a3b8';
            return `<div style="display:flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
                <span>${name} <span style="color:#64748b;">(${count})</span></span>
            </div>`;
        }).join('') || '<span style="color:#64748b;">Nenhum spawn</span>';
        if (total) total.textContent = this._spawns.length;
    }

    // ─── Coordenadas ────────────────────────────────────────────────────────

    _worldToCanvas(wx, wy) {
        const pad = 20;
        const cw = this._canvas.width, ch = this._canvas.height;
        const cx = pad + ((wx - this._worldMin.x) / (this._worldMax.x - this._worldMin.x)) * (cw - pad * 2);
        const cy = pad + ((wy - this._worldMin.y) / (this._worldMax.y - this._worldMin.y)) * (ch - pad * 2);
        return { x: cx, y: cy };
    }

    _canvasToWorld(cx, cy) {
        const pad = 20;
        const cw = this._canvas.width, ch = this._canvas.height;
        const wx = this._worldMin.x + ((cx - pad) / (cw - pad * 2)) * (this._worldMax.x - this._worldMin.x);
        const wy = this._worldMin.y + ((cy - pad) / (ch - pad * 2)) * (this._worldMax.y - this._worldMin.y);
        return { x: Math.round(wx), y: Math.round(wy) };
    }

    _canvasEventCoords(e) {
        const rect = this._canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this._canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this._canvas.height / rect.height)
        };
    }

    _getSpawnAt(cx, cy, hitRadius = 9) {
        for (const s of this._spawns) {
            const pt = this._worldToCanvas(Number(s.x ?? s.spawn_x), Number(s.y ?? s.spawn_y));
            const dx = cx - pt.x, dy = cy - pt.y;
            if (dx * dx + dy * dy <= hitRadius * hitRadius) return s;
        }
        return null;
    }

    // ─── Render ─────────────────────────────────────────────────────────────

    _render() {
        if (!this._ctx || !this._canvas) return;
        const ctx = this._ctx;
        const cw = this._canvas.width, ch = this._canvas.height;

        ctx.fillStyle = '#0a1a0a';
        ctx.fillRect(0, 0, cw, ch);

        // grade
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < cw; x += 54) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,ch); ctx.stroke(); }
        for (let y = 0; y < ch; y += 28) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cw,y); ctx.stroke(); }

        // bounds do mundo
        const tl = this._worldToCanvas(this._worldMin.x, this._worldMin.y);
        const br = this._worldToCanvas(this._worldMax.x, this._worldMax.y);
        ctx.strokeStyle = 'rgba(100,220,100,0.12)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        ctx.fillStyle = 'rgba(100,220,100,0.03)';
        ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        ctx.fillStyle = 'rgba(100,220,100,0.25)';
        ctx.font = '10px monospace';
        ctx.fillText('Shadowland', tl.x + 4, tl.y + 12);

        if (!this._spawns.length) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Nenhum spawn cadastrado', cw / 2, ch / 2);
            ctx.textAlign = 'left';
            return;
        }

        // Spawns agrupados por template (renderiza por camada)
        const groups = {};
        for (const s of this._spawns) {
            const n = String(s.template_name || 'Desconhecido');
            if (!groups[n]) groups[n] = [];
            groups[n].push(s);
        }

        for (const [name, list] of Object.entries(groups)) {
            const color = this._templateColors[name] || '#94a3b8';
            for (const s of list) {
                const px = Number(s.x ?? s.spawn_x), py = Number(s.y ?? s.spawn_y);
                const pt = this._worldToCanvas(px, py);
                const isHovered = this._hoveredSpawn && this._hoveredSpawn.spawn_uid === s.spawn_uid;

                // raio de movimento (muito pequeno no canvas, só um halo sutil)
                const moveR = Number(s.move_radius || 120);
                const canvasR = moveR / (this._worldMax.x - this._worldMin.x) * (cw - 40);
                if (canvasR > 2) {
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, canvasR, 0, Math.PI * 2);
                    ctx.fillStyle = `${color}18`;
                    ctx.fill();
                }

                // marcador
                const r = isHovered ? 7 : 5;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.fillStyle = isHovered ? '#fff' : color;
                ctx.fill();
                if (isHovered) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }
        }

        // Nome do hover acima do marcador
        if (this._hoveredSpawn) {
            const s = this._hoveredSpawn;
            const pt = this._worldToCanvas(Number(s.x ?? s.spawn_x), Number(s.y ?? s.spawn_y));
            const name = String(s.template_name || 'Desconhecido');
            const color = this._templateColors[name] || '#94a3b8';
            ctx.fillStyle = color;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(name, pt.x, pt.y - 10);
            ctx.fillStyle = 'rgba(148,163,184,0.8)';
            ctx.font = '10px monospace';
            ctx.fillText(`${Math.round(s.x ?? s.spawn_x)}, ${Math.round(s.y ?? s.spawn_y)}`, pt.x, pt.y - 22);
        }
        ctx.textAlign = 'left';
    }

    // ─── Input ──────────────────────────────────────────────────────────────

    _onHover(e) {
        const { x, y } = this._canvasEventCoords(e);
        const found = this._getSpawnAt(x, y);
        const prev = this._hoveredSpawn;
        this._hoveredSpawn = found || null;
        this._canvas.style.cursor = found ? 'pointer' : 'crosshair';

        const hint = document.getElementById('spawnmap-hint');
        if (found) {
            if (hint) hint.textContent = `${found.template_name}  |  uid: ${found.spawn_uid}  |  respawn: ${found.respawn_seconds}s  |  pos: (${Math.round(found.x ?? found.spawn_x)}, ${Math.round(found.y ?? found.spawn_y)})`;
        } else {
            if (hint) {
                const w = this._canvasToWorld(x, y);
                hint.textContent = `Clique para criar spawn em (${w.x}, ${w.y})`;
            }
        }
        if ((prev?.spawn_uid) !== (found?.spawn_uid)) this._render();
    }

    _onClick(e) {
        const { x, y } = this._canvasEventCoords(e);
        const found = this._getSpawnAt(x, y);
        if (found) {
            this._openInfo(found);
        } else {
            const w = this._canvasToWorld(x, y);
            this._openCreate(w.x, w.y);
        }
    }

    // ─── Modal Criar ────────────────────────────────────────────────────────

    _openCreate(wx, wy) {
        document.getElementById('spawnmap-create-x').value = wx;
        document.getElementById('spawnmap-create-y').value = wy;
        document.getElementById('spawnmap-create-pos').textContent = `Posição no mundo: (${wx}, ${wy})`;

        // Preenche select de templates.
        // Fonte primária: this._templates (API /admin/monsters/templates).
        // Fallback: lista deduplificada extraída dos spawns já carregados.
        const sel = document.getElementById('spawnmap-create-template');
        let tplList = this._templates.filter(t => t.is_active !== false && t.is_active !== 0);
        if (!tplList.length) {
            const seen = new Map();
            for (const s of this._spawns) {
                const tid = s.template_id ?? s.deck_id;
                const tname = s.template_name ?? ('Template ' + tid);
                if (tid != null && !seen.has(tid)) seen.set(tid, tname);
            }
            tplList = Array.from(seen.entries())
                .map(([id, name]) => ({ id, name }))
                .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        } else {
            tplList.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        }
        sel.innerHTML = tplList.length
            ? tplList.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
            : '<option value="" disabled>Nenhum template encontrado</option>';

        const modal = document.getElementById('spawnmap-create-modal');
        if (modal) modal.style.display = 'flex';
    }

    _closeCreate() {
        const modal = document.getElementById('spawnmap-create-modal');
        if (modal) modal.style.display = 'none';
    }

    async _confirmCreate() {
        const templateId = Number(document.getElementById('spawnmap-create-template').value);
        const wx = Number(document.getElementById('spawnmap-create-x').value);
        const wy = Number(document.getElementById('spawnmap-create-y').value);
        const respawn = Number(document.getElementById('spawnmap-create-respawn').value) || 300;
        const radius = Number(document.getElementById('spawnmap-create-radius').value) || 120;

        if (!templateId) { alert('Selecione um template.'); return; }

        const btn = document.getElementById('spawnmap-create-confirm');
        btn.disabled = true;
        btn.textContent = 'Criando...';

        try {
            await apiClient.createMonsterSpawn({
                template_id: templateId,
                zone: this._zone,
                spawn_x: wx,
                spawn_y: wy,
                respawn_seconds: respawn,
                move_radius: radius
            });
            this._closeCreate();
            await this.load();
        } catch (err) {
            alert('Erro ao criar spawn: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Criar Spawn';
        }
    }

    // ─── Modal Info/Delete ──────────────────────────────────────────────────

    _openInfo(spawn) {
        this._selectedSpawn = spawn;
        document.getElementById('spawnmap-info-title').textContent = String(spawn.template_name || 'Spawn');
        document.getElementById('spawnmap-info-body').innerHTML = `
            <b>UID:</b> ${spawn.spawn_uid}<br>
            <b>Template:</b> ${spawn.template_name} (id: ${spawn.template_id})<br>
            <b>Posição:</b> (${Math.round(spawn.x ?? spawn.spawn_x)}, ${Math.round(spawn.y ?? spawn.spawn_y)})<br>
            <b>Raio de movimento:</b> ${spawn.move_radius}px<br>
            <b>Respawn:</b> ${spawn.respawn_seconds}s (${Math.round(spawn.respawn_seconds / 60)}min)
        `;
        const modal = document.getElementById('spawnmap-info-modal');
        if (modal) modal.style.display = 'flex';
    }

    _closeInfo() {
        const modal = document.getElementById('spawnmap-info-modal');
        if (modal) modal.style.display = 'none';
        this._selectedSpawn = null;
    }

    async _deleteSelected() {
        if (!this._selectedSpawn) return;
        const { spawn_uid, template_name } = this._selectedSpawn;
        if (!confirm(`Deletar spawn de "${template_name}" (${spawn_uid})?`)) return;
        try {
            await apiClient.deleteMonsterSpawn(spawn_uid);
            this._closeInfo();
            await this.load();
        } catch (err) {
            alert('Erro ao deletar: ' + err.message);
        }
    }
}

const spawnMapManager = new SpawnMapManager();
window.spawnMapManager = spawnMapManager;

// Switch de abas na página de Monstros
function monsterTabSwitch(tab) {
    const isTemplates = tab === 'templates';
    document.getElementById('monsters-tab-templates').style.display = isTemplates ? '' : 'none';
    document.getElementById('monsters-tab-spawnmap').style.display = isTemplates ? 'none' : '';
    document.getElementById('tab-monsters-templates').style.borderBottomColor = isTemplates ? '#6366f1' : 'transparent';
    document.getElementById('tab-monsters-templates').style.color = isTemplates ? '#e2e8f0' : '#94a3b8';
    document.getElementById('tab-monsters-templates').style.fontWeight = isTemplates ? '600' : 'normal';
    document.getElementById('tab-monsters-spawnmap').style.borderBottomColor = !isTemplates ? '#6366f1' : 'transparent';
    document.getElementById('tab-monsters-spawnmap').style.color = !isTemplates ? '#e2e8f0' : '#94a3b8';
    document.getElementById('tab-monsters-spawnmap').style.fontWeight = !isTemplates ? '600' : 'normal';
    if (!isTemplates) spawnMapManager.load();
}
window.monsterTabSwitch = monsterTabSwitch;
