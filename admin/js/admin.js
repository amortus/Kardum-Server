// admin/js/admin.js - JavaScript da Dashboard Admin
class AdminDashboard {
    constructor() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.cards = [];
        this.users = [];
        this.collections = [];
        this.editorMode = 'artwork';
        this.currentGlobalVfxLayout = null;

        this.init();
    }

    init() {
        // Setup event listeners
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());
        document.getElementById('btn-new-card')?.addEventListener('click', () => this.showCardForm());
        document.getElementById('btn-open-vfx-universal')?.addEventListener('click', () => this.openGlobalVfxEditor());
        document.getElementById('btn-cancel-card')?.addEventListener('click', () => this.hideCardForm());
        document.getElementById('btn-add-effect')?.addEventListener('click', () => this.addEffectRow());
        document.getElementById('card-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCard();
        });
        document.getElementById('card-search')?.addEventListener('input', () => this.loadCards());
        document.getElementById('filter-type')?.addEventListener('change', () => this.loadCards());
        document.getElementById('filter-race')?.addEventListener('change', () => this.loadCards());
        document.getElementById('filter-collection')?.addEventListener('change', () => this.loadCards());
        document.getElementById('filter-availability')?.addEventListener('change', () => this.loadCards());
        document.getElementById('btn-refresh-commands')?.addEventListener('click', () => this.loadCommands());
        document.getElementById('btn-seed-goblins')?.addEventListener('click', () => this.seedGoblins());
        document.getElementById('btn-seed-dwarves-cards')?.addEventListener('click', () => this.seedDwarves());
        document.getElementById('btn-seed-elves-cards')?.addEventListener('click', () => this.seedElves());
        document.getElementById('btn-seed-ants-cards')?.addEventListener('click', () => this.seedAnts());
        document.getElementById('btn-seed-necromancers-cards')?.addEventListener('click', () => this.seedNecromancers());
        document.getElementById('btn-seed-monster-archetypes')?.addEventListener('click', () => this.seedMonsterArchetypes());
        document.getElementById('btn-seed-shadowland-cards')?.addEventListener('click', () => this.seedShadowlandCards());

        // Card Editor
        document.getElementById('btn-close-editor')?.addEventListener('click', () => this.hideCardEditor());
        document.getElementById('btn-save-layout')?.addEventListener('click', () => this.saveCardLayout());
        document.getElementById('btn-use-saved-layout')?.addEventListener('click', () => this.useSavedLayout());
        document.getElementById('btn-apply-layout-from-card')?.addEventListener('click', () => this.applyLayoutFromOtherCard());
        document.getElementById('btn-preview-card')?.addEventListener('click', () => this.showPreview());
        document.getElementById('btn-update-card-image')?.addEventListener('click', () => this.updateCardImageOnly());
        document.getElementById('btn-reset-layout')?.addEventListener('click', () => cardEditor.reset());
        document.getElementById('btn-load-artwork')?.addEventListener('click', () => this.loadArtwork());
        
        // Zoom controls
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
            cardEditor.zoomIn();
            document.getElementById('zoom-level').textContent = Math.round(cardEditor.zoomLevel * 100) + '%';
        });
        document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
            cardEditor.zoomOut();
            document.getElementById('zoom-level').textContent = Math.round(cardEditor.zoomLevel * 100) + '%';
        });
        document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
            cardEditor.resetZoom();
            document.getElementById('zoom-level').textContent = '100%';
        });
        
        // Preview modal
        document.getElementById('btn-close-preview')?.addEventListener('click', () => this.hidePreview());
        document.getElementById('btn-cancel-preview')?.addEventListener('click', () => this.hidePreview());
        document.getElementById('btn-confirm-save')?.addEventListener('click', () => this.confirmAndSave());
        document.getElementById('btn-load-artwork-file')?.addEventListener('click', () => this.loadArtworkFromFile());
        document.getElementById('btn-load-artwork-select')?.addEventListener('click', () => this.loadArtworkFromSelect());
        document.getElementById('btn-apply-global-cardbase-select')?.addEventListener('click', () => this.applySelectedGlobalCardbase());
        document.getElementById('btn-upload-global-cardbase')?.addEventListener('click', () => this.uploadGlobalCardbaseFromFile());
        document.getElementById('btn-reset-global-cardbase')?.addEventListener('click', () => this.resetGlobalCardbase());
        document.getElementById('global-cardbase-file')?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.uploadGlobalCardbaseFromFile();
            }
        });
        document.getElementById('editor-card-artwork-file')?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.loadArtworkFromFile();
            }
        });
        document.getElementById('btn-upload-full-card-form')?.addEventListener('click', () => this.uploadFullCardImageFromCardForm());
        document.getElementById('btn-save-full-card-url')?.addEventListener('click', () => this.saveFullCardImageUrlFromEditor());
        document.getElementById('btn-upload-full-card-editor')?.addEventListener('click', () => this.uploadFullCardImageFromEditor());
        document.getElementById('editor-card-full-image-url')?.addEventListener('change', () => this.refreshFullCardPreview());
        document.getElementById('editor-card-full-image-file')?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.uploadFullCardImageFromEditor();
            }
        });
        
        // Layout controls
        ['artwork', 'cost', 'attack', 'defense'].forEach(element => {
            ['offset-left', 'offset-top', 'offset-right', 'offset-bottom'].forEach(prop => {
                const input = document.getElementById(`${element}-${prop}`);
                if (input) {
                    input.addEventListener('input', () => this.updateLayoutFromControls());
                }
            });
        });
        
        // Reset e centralizar botões
        ['artwork', 'cost', 'attack', 'defense', 'name', 'description'].forEach(element => {
            const resetBtn = document.getElementById(`btn-reset-${element}`);
            const centerBtn = document.getElementById(`btn-center-${element}`);
            
            if (resetBtn) {
                resetBtn.addEventListener('click', () => this.resetElementPosition(element));
            }
            if (centerBtn) {
                centerBtn.addEventListener('click', () => this.centerElement(element));
            }
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.getAttribute('data-page');
                this.showPage(page);
            });
        });

        // Check if already logged in
        const token = localStorage.getItem('admin_token');
        if (token) {
            this.isAuthenticated = true;
            this.showDashboard();
            this.loadData();
        }
    }

    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.user && data.user.is_admin) {
                this.isAuthenticated = true;
                this.currentUser = data.user;
                localStorage.setItem('admin_token', data.token);
                apiClient.token = data.token;

                errorEl.textContent = '';
                this.showDashboard();
                this.loadData();
            } else {
                errorEl.textContent = 'Acesso negado. Apenas administradores podem acessar.';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorEl.textContent = 'Erro ao fazer login. Verifique suas credenciais.';
        }
    }

    logout() {
        this.isAuthenticated = false;
        this.currentUser = null;
        localStorage.removeItem('admin_token');

        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('login-screen').style.display = 'flex';
    }

    showDashboard() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').classList.remove('hidden');
    }

    setSeedResult(value) {
        const el = document.getElementById('seed-result');
        if (!el) return;
        if (typeof value === 'string') {
            el.textContent = value;
            return;
        }
        try {
            el.textContent = JSON.stringify(value, null, 2);
        } catch (_e) {
            el.textContent = String(value);
        }
    }

    async seedGoblins() {
        try {
            this.setSeedResult('Seeding Goblins...');
            const result = await apiClient.seedGoblinsCards();
            this.setSeedResult(result);
            await this.loadCollections();
            // se o usuário estiver na tela de cartas, atualizar listagem ajuda a validar
            const cardsPageActive = document.getElementById('page-cards')?.classList.contains('active');
            if (cardsPageActive) {
                await this.loadCards();
            }
            alert('Seed Goblins concluído.');
        } catch (error) {
            console.error('Seed goblins error:', error);
            this.setSeedResult({ error: error.message || String(error) });
            alert('Erro ao rodar seed goblins: ' + (error.message || error));
        }
    }

    async seedDwarves() {
        try {
            this.setSeedResult('Seeding Anões...');
            const result = await apiClient.seedDwarvesCards();
            this.setSeedResult(result);
            await this.loadCollections();
            const cardsPageActive = document.getElementById('page-cards')?.classList.contains('active');
            if (cardsPageActive) {
                await this.loadCards();
            }
            alert('Seed Anões concluído.');
        } catch (error) {
            console.error('Seed dwarves error:', error);
            this.setSeedResult({ error: error.message || String(error) });
            alert('Erro ao rodar seed anões: ' + (error.message || error));
        }
    }

    async seedElves() {
        try {
            this.setSeedResult('Seeding Elfos...');
            const result = await apiClient.seedElvesCards();
            this.setSeedResult(result);
            await this.loadCollections();
            const cardsPageActive = document.getElementById('page-cards')?.classList.contains('active');
            if (cardsPageActive) {
                await this.loadCards();
            }
            alert('Seed Elfos concluído.');
        } catch (error) {
            console.error('Seed elves error:', error);
            this.setSeedResult({ error: error.message || String(error) });
            alert('Erro ao rodar seed elfos: ' + (error.message || error));
        }
    }

    async seedAnts() {
        try {
            this.setSeedResult('Seeding Formigas...');
            const result = await apiClient.seedAntsCards();
            this.setSeedResult(result);
            await this.loadCollections();
            const cardsPageActive = document.getElementById('page-cards')?.classList.contains('active');
            if (cardsPageActive) {
                await this.loadCards();
            }
            alert('Seed Formigas concluído.');
        } catch (error) {
            console.error('Seed ants error:', error);
            this.setSeedResult({ error: error.message || String(error) });
            alert('Erro ao rodar seed formigas: ' + (error.message || error));
        }
    }

    async seedNecromancers() {
        try {
            this.setSeedResult('Seeding Necromantes...');
            const result = await apiClient.seedNecromancersCards();
            this.setSeedResult(result);
            await this.loadCollections();
            const cardsPageActive = document.getElementById('page-cards')?.classList.contains('active');
            if (cardsPageActive) {
                await this.loadCards();
            }
            alert('Seed Necromantes concluído.');
        } catch (error) {
            console.error('Seed necromancers error:', error);
            this.setSeedResult({ error: error.message || String(error) });
            alert('Erro ao rodar seed necromantes: ' + (error.message || error));
        }
    }

    async seedMonsterArchetypes() {
        try {
            this.setSeedResult('Configurando decks e drops por arquétipo...');
            const result = await apiClient.seedMonsterArchetypes();
            this.setSeedResult(result);
            alert('Seed Arquétipos concluído. Veja o detalhe abaixo do botão.');
        } catch (error) {
            console.error('Seed monster archetypes error:', error);
            this.setSeedResult({ error: error.message || String(error) });
            alert('Erro ao rodar seed de arquétipos: ' + (error.message || error));
        }
    }

    async seedShadowlandCards() {
        try {
            this.setSeedResult('Seeding Shadowland...');
            const result = await apiClient.seedShadowlandCards();
            this.setSeedResult(result);
            await this.loadCollections();
            const cardsPageActive = document.getElementById('page-cards')?.classList.contains('active');
            if (cardsPageActive) {
                await this.loadCards();
            }
            alert('Seed Shadowland concluído.');
        } catch (error) {
            console.error('Seed shadowland cards error:', error);
            this.setSeedResult({ error: error.message || String(error) });
            alert('Erro ao rodar seed shadowland: ' + (error.message || error));
        }
    }

    showPage(pageName) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageName}"]`)?.classList.add('active');

        // Show page
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(`page-${pageName}`)?.classList.add('active');

        // Load page-specific data
        if (pageName === 'cards') {
            this.loadCollections()
                .catch(() => {})
                .finally(() => this.loadCards());
        } else if (pageName === 'users') {
            this.loadUsers();
        } else if (pageName === 'boosters') {
            if (window.boosterManager) {
                boosterManager.init();
            }
        } else if (pageName === 'monsters') {
            if (window.monsterManager) {
                monsterManager.loadData();
            }
        } else if (pageName === 'commands') {
            this.loadCommands();
        } else if (pageName === 'quests') {
            if (window.questManager) {
                questManager.loadData();
            }
        } else if (pageName === 'mail') {
            if (window.mailManager) {
                mailManager.init();
            }
        } else if (pageName === 'calendar') {
            if (window.calendarManager) {
                calendarManager.init();
            }
        } else if (pageName === 'seeds') {
            this.setSeedResult('—');
        } else if (pageName === 'regions') {
            if (window.regionsManager) regionsManager.loadRegions();
        }
    }

    async loadData() {
        this.loadOverview();
        this.loadCommands();
        await this.loadCollections();
        this.loadCards();
        this.loadUsers();
        if (window.questManager) {
            questManager.loadData();
        }
    }

    async loadCollections() {
        try {
            const response = await apiClient.getCardCollections();
            this.collections = response.collections || [];
            this.populateCollectionSelects();
        } catch (error) {
            console.error('Failed to load card collections:', error);
            this.collections = [];
        }
    }

    populateCollectionSelects() {
        const cardFilterSelect = document.getElementById('filter-collection');
        if (cardFilterSelect) {
            const current = cardFilterSelect.value;
            cardFilterSelect.innerHTML = '<option value="">Todas as Coleções</option>' + this.collections
                .map(c => `<option value="${c.id}">${c.name}</option>`)
                .join('');
            if (current) cardFilterSelect.value = current;
        }

        const cardFormSelect = document.getElementById('card-collection-select');
        if (cardFormSelect) {
            const current = cardFormSelect.value;
            cardFormSelect.innerHTML = this.collections
                .map(c => `<option value="${c.id}">${c.name}</option>`)
                .join('');
            cardFormSelect.value = current || 'standard';
        }
    }

    async loadOverview() {
        try {
            const stats = await apiClient.getOverviewStats();
            document.getElementById('total-users').textContent = String(stats.total_users ?? 0);
            document.getElementById('total-matches').textContent = String(stats.total_matches ?? 0);
            document.getElementById('total-cards').textContent = String(stats.total_cards ?? 0);
            document.getElementById('active-players').textContent = String(stats.active_players ?? 0);
        } catch (error) {
            console.error('Failed to load overview stats:', error);
            document.getElementById('total-users').textContent = '—';
            document.getElementById('total-matches').textContent = '—';
            document.getElementById('total-cards').textContent = '—';
            document.getElementById('active-players').textContent = '—';
        }
    }

    async loadCommands() {
        const tbody = document.getElementById('commands-list');
        if (!tbody) return;
        try {
            const response = await apiClient.getAdminCommands();
            const commands = response.commands || [];
            tbody.innerHTML = '';
            commands.forEach((cmd) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><code>${cmd.command || '-'}</code></td>
                    <td>${cmd.description || '-'}</td>
                    <td>${cmd.scope || '-'}</td>
                    <td>${cmd.permission || '-'}</td>
                    <td><code>${cmd.example || '-'}</code></td>
                `;
                tbody.appendChild(tr);
            });
            if (commands.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">Nenhum comando documentado ainda.</td></tr>';
            }
        } catch (error) {
            console.error('Failed to load admin commands:', error);
            tbody.innerHTML = '<tr><td colspan="5">Falha ao carregar comandos.</td></tr>';
        }
    }


    showCardForm(card = null) {
        const modal = document.getElementById('card-form-modal');
        const form = document.getElementById('card-form');
        const title = document.getElementById('modal-title');

        if (card) {
            title.textContent = 'Editar Carta';
            form.elements['id'].value = card.id;
            form.elements['name'].value = card.name;
            form.elements['type'].value = card.type;
            form.elements['race'].value = card.race || '';
            form.elements['cost'].value = card.cost;
            form.elements['attack'].value = card.attack ?? '';
            form.elements['defense'].value = card.defense ?? '';
            form.elements['text'].value = card.text || '';
            if (form.elements['card_image_url']) {
                form.elements['card_image_url'].value = card.card_image_url || '';
            }

            if (form.elements['class']) {
                form.elements['class'].value = card.class || '';
            }
            if (form.elements['rarity']) {
                form.elements['rarity'].value = card.rarity || 'common';
            }
            if (form.elements['collection_id']) {
                form.elements['collection_id'].value = card.collection_id || 'standard';
            }

            const abilityBoxes = form.querySelectorAll('input[name="abilities"]');
            const cardAbilities = (card.abilities || []).map(a => a.toLowerCase());
            abilityBoxes.forEach(cb => {
                cb.checked = cardAbilities.includes(cb.value.toLowerCase());
            });

            const unlockCb = form.querySelector('input[name="default_unlocked"]');
            if (unlockCb) {
                unlockCb.checked = card.default_unlocked !== false;
            }

            const auraBoxes = form.querySelectorAll('input[name="visual_auras"]');
            const cardAuras = (card.visual_auras || []).map(a => a.toUpperCase());
            auraBoxes.forEach(cb => {
                cb.checked = cardAuras.includes(cb.value.toUpperCase());
            });

            this.populateEffects(card);
        } else {
            title.textContent = 'Nova Carta';
            form.reset();
            if (form.elements['collection_id']) {
                form.elements['collection_id'].value = 'standard';
            }
            const unlockCb = form.querySelector('input[name="default_unlocked"]');
            if (unlockCb) unlockCb.checked = true;
            const effectsList = document.getElementById('effects-list');
            if (effectsList) effectsList.innerHTML = '';
        }

        modal.classList.remove('hidden');
    }

    hideCardForm() {
        document.getElementById('card-form-modal').classList.add('hidden');
    }


    editCard(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (card) {
            this.showCardForm(card);
        }
    }

    async deleteCard(cardId) {
        if (!confirm('Deseja realmente deletar esta carta?')) {
            return;
        }

        try {
            await apiClient.deleteCard(cardId);
            alert('Carta deletada!');
            await this.loadCards();
        } catch (error) {
            console.error('Failed to delete card:', error);
            alert('Erro ao deletar carta: ' + error.message);
        }
    }

    async showCardEditor(cardId, cardData) {
        const modal = document.getElementById('card-editor-modal');
        if (!modal) return;

        try {
            this.editorMode = 'artwork';
            this.updateEditorModeUI();

            // Inicializar editor
            await cardEditor.init(cardId, cardData, { mode: 'artwork' });
            
            // Preencher campos do formulário
            document.getElementById('editor-card-name').value = cardData.name || '';
            document.getElementById('editor-card-cost').value = cardData.cost || 0;
            document.getElementById('editor-card-attack').value = cardData.attack || 0;
            document.getElementById('editor-card-defense').value = cardData.defense || 0;
            document.getElementById('editor-card-text').value = cardData.text || '';
            document.getElementById('editor-card-artwork').value = cardData.image_url || '';
            const fullUrlInput = document.getElementById('editor-card-full-image-url');
            if (fullUrlInput) {
                fullUrlInput.value = cardData.card_image_url || '';
            }
            this.refreshFullCardPreview();

            // Carregar lista de assets disponíveis
            await this.loadAvailableAssets();

            // Preencher dropdown "Aplicar layout de outra carta" (todas menos a atual)
            const layoutSourceSelect = document.getElementById('layout-source-card');
            if (layoutSourceSelect) {
                layoutSourceSelect.innerHTML = '<option value="">— escolher carta —</option>';
                (this.cards || []).forEach(card => {
                    if (card.id && card.id !== cardId) {
                        const opt = document.createElement('option');
                        opt.value = card.id;
                        opt.textContent = (card.name || card.id) + ' (' + card.id + ')';
                        layoutSourceSelect.appendChild(opt);
                    }
                });
            }

            modal.classList.remove('hidden');
        } catch (error) {
            console.error('Failed to open card editor:', error);
            alert('Erro ao abrir editor: ' + error.message);
        }
    }

    async openGlobalVfxEditor() {
        const modal = document.getElementById('card-editor-modal');
        if (!modal) return;

        try {
            this.editorMode = 'vfx-global';
            this.updateEditorModeUI();

            this.currentGlobalVfxLayout = await layoutManager.loadGlobalVfxLayout();
            const cardbaseImageUrl = this.currentGlobalVfxLayout.cardbaseImageUrl || '/assets/Raw/Card-Base.png';
            const sampleCard = {
                id: '__global_vfx__',
                name: 'Carta Exemplo',
                cost: 5,
                attack: 3,
                defense: 4,
                text: 'Descricao de exemplo para posicionar o texto.',
                image_url: cardbaseImageUrl
            };

            await cardEditor.init('__global_vfx__', sampleCard, {
                mode: 'vfx-global',
                globalVfxLayout: this.currentGlobalVfxLayout,
                globalCardbaseUrl: cardbaseImageUrl
            });

            document.getElementById('editor-card-name').value = sampleCard.name;
            document.getElementById('editor-card-cost').value = sampleCard.cost;
            document.getElementById('editor-card-attack').value = sampleCard.attack;
            document.getElementById('editor-card-defense').value = sampleCard.defense;
            document.getElementById('editor-card-text').value = sampleCard.text;
            document.getElementById('editor-card-artwork').value = '';
            const globalCardbaseUrlInput = document.getElementById('global-cardbase-url');
            if (globalCardbaseUrlInput) {
                globalCardbaseUrlInput.value = this.currentGlobalVfxLayout.cardbaseImageUrl || '';
            }
            await this.loadAvailableAssets();
            this.populateGlobalCardbaseSelect();

            modal.classList.remove('hidden');
        } catch (error) {
            console.error('Failed to open global VFX editor:', error);
            alert('Erro ao abrir editor universal VFX: ' + error.message);
        }
    }

    populateGlobalCardbaseSelect() {
        const select = document.getElementById('global-cardbase-select');
        const assetsSelect = document.getElementById('editor-card-artwork-select');
        if (!select || !assetsSelect) return;
        select.innerHTML = '<option value="">Selecione uma imagem...</option>';
        Array.from(assetsSelect.options).forEach((opt) => {
            if (!opt.value) return;
            const clone = document.createElement('option');
            clone.value = opt.value;
            clone.textContent = opt.textContent || opt.value;
            select.appendChild(clone);
        });
        if (this.currentGlobalVfxLayout?.cardbaseImageUrl) {
            select.value = this.currentGlobalVfxLayout.cardbaseImageUrl;
        }
    }

    async applySelectedGlobalCardbase() {
        if (this.editorMode !== 'vfx-global') return;
        const select = document.getElementById('global-cardbase-select');
        const input = document.getElementById('global-cardbase-url');
        const selected = select?.value?.trim();
        if (!selected) {
            alert('Selecione uma imagem para aplicar como cardbase.');
            return;
        }
        if (!this.currentGlobalVfxLayout) {
            this.currentGlobalVfxLayout = await layoutManager.loadGlobalVfxLayout();
        }
        this.currentGlobalVfxLayout.cardbaseImageUrl = selected;
        await layoutManager.saveGlobalVfxLayout(this.currentGlobalVfxLayout);
        if (input) input.value = selected;
        cardEditor.globalCardbaseUrl = selected;
        await cardEditor.loadImages();
        cardEditor.render();
        alert('Cardbase global aplicado.');
    }

    async uploadGlobalCardbaseFromFile() {
        if (this.editorMode !== 'vfx-global') return;
        const fileInput = document.getElementById('global-cardbase-file');
        const file = fileInput?.files?.[0];
        if (!file) {
            alert('Selecione um arquivo de imagem para enviar.');
            return;
        }
        try {
            const imageData = await this.prepareCardbaseImageForUpload(file);
            const response = await apiClient.uploadGlobalCardbase(imageData);
            const cardbaseUrl = response.cardbaseImageUrl;
            if (!this.currentGlobalVfxLayout) {
                this.currentGlobalVfxLayout = await layoutManager.loadGlobalVfxLayout();
            }
            this.currentGlobalVfxLayout.cardbaseImageUrl = cardbaseUrl;
            const input = document.getElementById('global-cardbase-url');
            if (input) input.value = cardbaseUrl;
            cardEditor.globalCardbaseUrl = cardbaseUrl;
            await cardEditor.loadImages();
            cardEditor.render();
            await this.loadAvailableAssets();
            this.populateGlobalCardbaseSelect();
            alert('Cardbase global enviado e aplicado com sucesso.');
        } catch (error) {
            console.error('Failed to upload global cardbase:', error);
            alert('Erro ao enviar cardbase global: ' + error.message);
        }
    }

    async resetGlobalCardbase() {
        if (this.editorMode !== 'vfx-global') return;
        if (!this.currentGlobalVfxLayout) {
            this.currentGlobalVfxLayout = await layoutManager.loadGlobalVfxLayout();
        }
        this.currentGlobalVfxLayout.cardbaseImageUrl = null;
        await layoutManager.saveGlobalVfxLayout(this.currentGlobalVfxLayout);
        const input = document.getElementById('global-cardbase-url');
        const select = document.getElementById('global-cardbase-select');
        if (input) input.value = '';
        if (select) select.value = '';
        cardEditor.globalCardbaseUrl = null;
        await cardEditor.loadImages();
        cardEditor.render();
        alert('Cardbase global revertido para o padrão local.');
    }

    async readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
            reader.readAsDataURL(file);
        });
    }

    async prepareCardbaseImageForUpload(file) {
        const dataUrl = await this.readFileAsDataUrl(file);
        const maxSide = 1600;
        const largeFile = file.size > 400 * 1024;
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let w = img.naturalWidth;
                let h = img.naturalHeight;
                if (w < 1 || h < 1) {
                    reject(new Error('Imagem inválida'));
                    return;
                }
                const scaleDown = Math.max(w, h) > maxSide;
                if (!scaleDown && !largeFile) {
                    resolve(dataUrl);
                    return;
                }
                if (scaleDown) {
                    const s = maxSide / Math.max(w, h);
                    w = Math.round(w * s);
                    h = Math.round(h * s);
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                let out = canvas.toDataURL('image/webp', 0.88);
                if (!out || !out.startsWith('data:image/webp')) {
                    out = canvas.toDataURL('image/png');
                }
                resolve(out);
            };
            img.onerror = () => reject(new Error('Não foi possível processar a imagem'));
            img.src = dataUrl;
        });
    }

    updateEditorModeUI() {
        const title = document.getElementById('editor-title');
        const saveBtn = document.getElementById('btn-save-layout');
        const resetBtn = document.getElementById('btn-reset-layout');
        const previewBtn = document.getElementById('btn-preview-card');
        const confirmSaveBtn = document.getElementById('btn-confirm-save');
        const modeArtworkOnly = document.querySelectorAll('.mode-artwork-only');
        const modeVfxOnly = document.querySelectorAll('.mode-vfx-only');

        if (this.editorMode === 'vfx-global') {
            if (title) title.textContent = 'Editor Universal VFX';
            if (saveBtn) saveBtn.textContent = 'Salvar Layout Universal';
            if (resetBtn) resetBtn.textContent = 'Reset Layout Universal';
            if (previewBtn) previewBtn.disabled = false;
            if (confirmSaveBtn) confirmSaveBtn.disabled = false;
            modeArtworkOnly.forEach((el) => { el.style.display = 'none'; });
            modeVfxOnly.forEach((el) => { el.style.display = ''; });
        } else {
            if (title) title.textContent = 'Editor Artwork Individual';
            if (saveBtn) saveBtn.textContent = 'Salvar Artwork';
            if (resetBtn) resetBtn.textContent = 'Reset Artwork';
            if (previewBtn) previewBtn.disabled = true;
            if (confirmSaveBtn) confirmSaveBtn.disabled = true;
            modeArtworkOnly.forEach((el) => { el.style.display = ''; });
            modeVfxOnly.forEach((el) => { el.style.display = 'none'; });
        }
    }
    
    async loadAvailableAssets() {
        try {
            const data = await apiClient.getAssets();
            const select = document.getElementById('editor-card-artwork-select');
            if (select && data.assets && data.assets.length > 0) {
                select.innerHTML = '<option value="">Selecione uma imagem...</option>';
                data.assets.forEach(asset => {
                    const option = document.createElement('option');
                    option.value = asset.path;
                    option.textContent = asset.name;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            // Lista de assets é opcional (401 se não autenticado, ou projeto sem pasta assets)
            if (error.message !== 'Request failed') {
                console.warn('Failed to load assets list:', error);
            }
        }
    }

    hideCardEditor() {
        document.getElementById('card-editor-modal')?.classList.add('hidden');
    }

    async useSavedLayout() {
        if (this.editorMode !== 'artwork') return;
        if (!cardEditor.cardData) return;
        try {
            const layout = await layoutManager.loadLayout(cardEditor.cardData.id);
            cardEditor.layout = layout;
            cardEditor.updateElementsFromLayout();
            cardEditor.render();
            cardEditor.updateControls();
            alert('Layout desta carta aplicado.');
        } catch (error) {
            console.error('Failed to load saved layout:', error);
            alert('Erro ao carregar layout: ' + error.message);
        }
    }

    async applyLayoutFromOtherCard() {
        if (this.editorMode !== 'artwork') return;
        if (!cardEditor.cardData) return;
        const select = document.getElementById('layout-source-card');
        const sourceCardId = select?.value?.trim();
        if (!sourceCardId) {
            alert('Escolha uma carta na lista "Aplicar layout de outra carta".');
            return;
        }
        try {
            const layout = await layoutManager.loadLayout(sourceCardId);
            cardEditor.layout = layout;
            cardEditor.updateElementsFromLayout();
            cardEditor.render();
            cardEditor.updateControls();
            alert('Layout da outra carta aplicado. Clique em "Salvar Layout" para gravar nesta carta.');
        } catch (error) {
            console.error('Failed to apply layout from other card:', error);
            alert('Erro ao aplicar layout: ' + error.message);
        }
    }

    async saveCardLayout() {
        if (!cardEditor.cardData) return;

        try {
            if (this.editorMode === 'vfx-global') {
                await layoutManager.saveGlobalVfxLayout(cardEditor.layout);
                alert('Layout universal VFX salvo com sucesso!');
                return;
            }

            // Modo artwork: não mexer em nome/custo/ataque/defesa/descrição para evitar conflitos.
            const imageUrl = document.getElementById('editor-card-artwork').value || null;

            // Salvar layout primeiro
            await cardEditor.save();
            
            // Atualizar carta apenas com image_url + layout.
            await apiClient.updateCard(cardEditor.cardData.id, {
                image_url: imageUrl,
                layout: cardEditor.layout
            });

            alert('Artwork salva com sucesso!');
        } catch (error) {
            console.error('Failed to save layout:', error);
            alert('Erro ao salvar artwork: ' + error.message);
        }
    }
    
    showPreview() {
        if (!cardEditor.cardData) return;
        if (this.editorMode !== 'vfx-global') {
            return;
        }
        
        // Gerar imagem da carta
        const cardImage = cardEditor.generateCardImage();
        
        // Mostrar preview
        document.getElementById('preview-image').src = cardImage;
        document.getElementById('preview-modal').classList.remove('hidden');
    }
    
    hidePreview() {
        document.getElementById('preview-modal').classList.add('hidden');
    }

    /** Reenvia só a imagem da carta (sem bolinhas) para o servidor. Use quando o cliente ainda mostrar bolinhas. */
    async updateCardImageOnly() {
        if (!cardEditor.cardData) return;
        try {
            const cardImageData = cardEditor.generateCardImage();
            await apiClient.uploadCardImage(cardEditor.cardData.id, cardImageData);
            alert('Imagem atualizada no servidor. O cliente passará a exibir a carta sem bolinhas.');
        } catch (error) {
            console.error('Failed to update card image:', error);
            alert('Erro ao atualizar imagem: ' + error.message);
        }
    }

    _resolvePreviewSrc(url) {
        if (!url || !String(url).trim()) return '';
        const u = String(url).trim();
        if (u.startsWith('data:') || u.startsWith('http://') || u.startsWith('https://')) return u;
        return u.startsWith('/') ? u : `/${u}`;
    }

    refreshFullCardPreview() {
        const input = document.getElementById('editor-card-full-image-url');
        const img = document.getElementById('editor-full-card-preview');
        if (!img) return;
        const raw = input ? input.value.trim() : '';
        img.src = raw ? this._resolvePreviewSrc(raw) : '';
        img.style.display = raw ? 'block' : 'none';
    }

    async saveFullCardImageUrlFromEditor() {
        if (!cardEditor.cardData || cardEditor.cardData.id === '__global_vfx__') {
            alert('Abra o editor de uma carta válida.');
            return;
        }
        const url = document.getElementById('editor-card-full-image-url')?.value?.trim() || null;
        try {
            const res = await apiClient.getCard(cardEditor.cardData.id);
            const existing = res.card;
            await apiClient.updateCard(cardEditor.cardData.id, { ...existing, card_image_url: url });
            if (cardEditor.cardData) cardEditor.cardData.card_image_url = url || undefined;
            this.refreshFullCardPreview();
            alert('URL da imagem completa salva.');
            await this.loadCards();
        } catch (error) {
            console.error('saveFullCardImageUrlFromEditor:', error);
            alert('Erro: ' + error.message);
        }
    }

    async uploadFullCardImageFromEditor() {
        if (!cardEditor.cardData || cardEditor.cardData.id === '__global_vfx__') {
            alert('Abra o editor de uma carta válida.');
            return;
        }
        const fileInput = document.getElementById('editor-card-full-image-file');
        const file = fileInput?.files?.[0];
        if (!file) {
            alert('Selecione um arquivo PNG/JPG/WebP.');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const dataUrl = e.target.result;
                const out = await apiClient.uploadCardFullImage(cardEditor.cardData.id, dataUrl);
                const url = out.card_image_url;
                const fullInput = document.getElementById('editor-card-full-image-url');
                if (fullInput) fullInput.value = url || '';
                if (cardEditor.cardData) cardEditor.cardData.card_image_url = url;
                this.refreshFullCardPreview();
                if (fileInput) fileInput.value = '';
                alert('Imagem completa enviada com sucesso.');
                await this.loadCards();
            } catch (err) {
                console.error('uploadFullCardImageFromEditor:', err);
                alert('Erro ao enviar: ' + err.message);
            }
        };
        reader.onerror = () => alert('Falha ao ler o arquivo.');
        reader.readAsDataURL(file);
    }

    async uploadFullCardImageFromCardForm() {
        const form = document.getElementById('card-form');
        const cardId = form?.elements?.['id']?.value?.trim();
        const fileInput = document.getElementById('card-form-full-image-file');
        const file = fileInput?.files?.[0];
        if (!cardId) {
            alert('Informe o ID da carta e salve antes de enviar a imagem completa.');
            return;
        }
        if (!file) {
            alert('Selecione um arquivo de imagem.');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const out = await apiClient.uploadCardFullImage(cardId, e.target.result);
                const url = out.card_image_url;
                if (form.elements['card_image_url']) {
                    form.elements['card_image_url'].value = url || '';
                }
                if (fileInput) fileInput.value = '';
                alert('Imagem completa enviada. Salve a carta se ainda não salvou outros campos.');
                await this.loadCards();
            } catch (err) {
                console.error('uploadFullCardImageFromCardForm:', err);
                alert('Erro: ' + err.message);
            }
        };
        reader.readAsDataURL(file);
    }
    
    async confirmAndSave() {
        if (!cardEditor.cardData) return;
        if (this.editorMode !== 'vfx-global') {
            return;
        }
        
        try {
            // Gerar imagem final
            const cardImageData = cardEditor.generateCardImage();
            
            // Atualizar dados da carta
            const cardData = {
                name: document.getElementById('editor-card-name').value,
                cost: parseInt(document.getElementById('editor-card-cost').value) || 0,
                attack: parseInt(document.getElementById('editor-card-attack').value) || null,
                defense: parseInt(document.getElementById('editor-card-defense').value) || null,
                text: document.getElementById('editor-card-text').value
            };

            // Salvar layout primeiro
            await cardEditor.save();
            
            // Enviar imagem para o servidor
            await apiClient.uploadCardImage(cardEditor.cardData.id, cardImageData);
            
            // Atualizar dados da carta
            await apiClient.updateCard(cardEditor.cardData.id, {
                ...cardData,
                layout: cardEditor.layout
            });
            
            alert('Carta salva com sucesso!');
            this.hidePreview();
        } catch (error) {
            console.error('Failed to save card:', error);
            alert('Erro ao salvar carta: ' + error.message);
        }
    }

    async loadArtwork() {
        const urlInput = document.getElementById('editor-card-artwork');
        const url = urlInput.value.trim();
        
        if (!url) {
            alert('Por favor, insira uma URL de artwork ou selecione um arquivo local');
            return;
        }

        try {
            cardEditor.artworkImage = new Image();
            cardEditor.artworkImage.crossOrigin = 'anonymous';
            
            // Se for URL externa, usar proxy para contornar CORS
            if (url.startsWith('http://') || url.startsWith('https://')) {
                const proxyUrl = `/api/admin/proxy-image?url=${encodeURIComponent(url)}`;
                cardEditor.artworkImage.src = proxyUrl;
            } else {
                // URL local ou caminho relativo
                cardEditor.artworkImage.src = url.startsWith('/') ? url : `/${url}`;
            }
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout ao carregar imagem'));
                }, 10000);
                
                cardEditor.artworkImage.onload = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                
                cardEditor.artworkImage.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error('Failed to load image'));
                };
            });

            // Atualizar image_url no cardData
            if (cardEditor.cardData) {
                cardEditor.cardData.image_url = url;
            }
            
            cardEditor.render();
        } catch (error) {
            console.error('Failed to load artwork:', error);
            alert('Erro ao carregar artwork: ' + error.message);
        }
    }
    
    async loadArtworkFromFile() {
        const fileInput = document.getElementById('editor-card-artwork-file');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            alert('Por favor, selecione um arquivo de imagem');
            return;
        }
        
        if (!cardEditor.cardData || !cardEditor.cardData.id || cardEditor.cardData.id === '__global_vfx__') {
            alert('Abra o editor de uma carta válida antes de enviar artwork.');
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                // Não salvar data URL gigante em image_url (gera 413 no updateCard).
                // Envia o arquivo para o servidor e usa a URL retornada.
                const dataUrl = e.target.result;
                const out = await apiClient.uploadCardImage(cardEditor.cardData.id, dataUrl);
                const url = out.image_url;
                if (!url) {
                    throw new Error('Upload não retornou image_url.');
                }

                const input = document.getElementById('editor-card-artwork');
                if (input) input.value = url;
                if (cardEditor.cardData) cardEditor.cardData.image_url = url;

                // Recarregar a imagem via URL (e não base64).
                cardEditor.artworkImage = new Image();
                cardEditor.artworkImage.crossOrigin = 'anonymous';
                cardEditor.artworkImage.src = url.startsWith('/') ? url : `/${url}`;
                cardEditor.artworkImage.onload = () => cardEditor.render();
                cardEditor.artworkImage.onerror = () => alert('Erro ao carregar artwork enviada.');
                if (fileInput) fileInput.value = '';
            } catch (error) {
                console.error('Failed to load artwork from file:', error);
                alert('Erro ao enviar artwork: ' + error.message);
            }
        };
        
        reader.readAsDataURL(file);
    }
    
    async loadArtworkFromSelect() {
        const select = document.getElementById('editor-card-artwork-select');
        const selectedPath = select.value;
        
        if (!selectedPath) {
            alert('Por favor, selecione uma imagem da lista');
            return;
        }
        
        try {
            cardEditor.artworkImage = new Image();
            cardEditor.artworkImage.crossOrigin = 'anonymous';
            cardEditor.artworkImage.src = selectedPath.startsWith('/') ? selectedPath : `/${selectedPath}`;
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout ao carregar imagem'));
                }, 10000);
                
                cardEditor.artworkImage.onload = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                
                cardEditor.artworkImage.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error('Failed to load image'));
                };
            });

            // Atualizar image_url no cardData
            if (cardEditor.cardData) {
                cardEditor.cardData.image_url = selectedPath;
            }
            
            // Atualizar input de URL também
            document.getElementById('editor-card-artwork').value = selectedPath;
            
            cardEditor.render();
        } catch (error) {
            console.error('Failed to load artwork:', error);
            alert('Erro ao carregar artwork: ' + error.message);
        }
    }

    updateLayoutFromControls() {
        if (!cardEditor.layout) return;

        // Atualizar layout dos controles
        const updateElement = (elementName, props) => {
            props.forEach(prop => {
                const input = document.getElementById(`${elementName}-${prop}`);
                if (input && cardEditor.layout[elementName]) {
                    const value = parseFloat(input.value) || 0;
                    const propName = prop.replace('offset-', 'offset').replace('-', '');
                    cardEditor.layout[elementName][propName] = value;
                }
            });
        };

        updateElement('artwork', ['offset-left', 'offset-top', 'offset-right', 'offset-bottom']);
        updateElement('cost', ['offset-left', 'offset-top']);
        updateElement('attack', ['offset-left', 'offset-top']);
        updateElement('defense', ['offset-left', 'offset-top']);

        // Atualizar elementos e re-renderizar
        cardEditor.updateElementsFromLayout();
        cardEditor.render();
    }
    
    resetElementPosition(elementName) {
        if (!cardEditor.layout) return;
        
        // Resetar para valores padrão
        const defaultLayout = layoutManager.getDefaultLayout();
        if (defaultLayout[elementName]) {
            cardEditor.layout[elementName] = JSON.parse(JSON.stringify(defaultLayout[elementName]));
            cardEditor.updateElementsFromLayout();
            cardEditor.render();
            cardEditor.updateControls();
        }
    }
    
    centerElement(elementName) {
        if (!cardEditor.elements[elementName]) return;
        
        const element = cardEditor.elements[elementName];
        const cardWidth = cardEditor.cardWidth;
        const cardHeight = cardEditor.cardHeight;
        
        // Centralizar elemento
        element.x = (cardWidth - element.width) / 2;
        element.y = (cardHeight - element.height) / 2;
        
        // Atualizar layout e renderizar
        cardEditor.updateLayoutFromElements();
        cardEditor.render();
        cardEditor.updateControls();
    }

    async loadCards() {
        try {
            const response = await apiClient.getCardsFiltered({
                search: document.getElementById('card-search')?.value || '',
                type: document.getElementById('filter-type')?.value || '',
                race: document.getElementById('filter-race')?.value || '',
                collection_id: document.getElementById('filter-collection')?.value || '',
                default_unlocked: document.getElementById('filter-availability')?.value || ''
            });
            this.cards = response.cards || [];
        } catch (error) {
            console.error('Failed to load cards:', error);
            this.cards = [];
        }

        const tbody = document.querySelector('#cards-list tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        this.cards.forEach(card => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${card.id}</td>
        <td>${card.name}</td>
        <td>${card.type}</td>
        <td>${card.collection_id || 'standard'}</td>
        <td>${card.race || '-'}</td>
        <td>${card.cost}</td>
        <td>${card.attack ?? '-'}</td>
        <td>${card.defense ?? '-'}</td>
        <td>${card.default_unlocked === false ? 'Não' : 'Sim'}</td>
        <td>
          <button class="btn-edit" onclick="adminDashboard.editCard('${card.id}')">Editar</button>
          <button class="btn-edit" onclick="adminDashboard.openCardEditor('${card.id}')">Editor Artwork</button>
          <button class="btn-danger" onclick="adminDashboard.deleteCard('${card.id}')">Deletar</button>
        </td>
      `;
            tbody.appendChild(tr);
        });
    }

    async openCardEditor(cardId) {
        try {
            const response = await apiClient.getCard(cardId);
            if (response.card) {
                await this.showCardEditor(cardId, response.card);
            }
        } catch (error) {
            console.error('Failed to load card:', error);
            alert('Erro ao carregar carta: ' + error.message);
        }
    }

    async loadUsers() {
        try {
            const response = await apiClient.getUsers();
            this.users = response.users || [];
        } catch (error) {
            console.error('Failed to load users:', error);
            this.users = [];
        }

        const tbody = document.querySelector('#users-list tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        this.users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${user.elo_casual}</td>
        <td>${user.elo_ranked}</td>
        <td>${user.total_matches}</td>
        <td>${user.wins}</td>
        <td>${user.created_at}</td>
      `;
            tbody.appendChild(tr);
        });
    }

    async saveCard() {
        const form = document.getElementById('card-form');
        const formData = new FormData(form);
        const card = {};

        for (let [key, value] of formData.entries()) {
            if (key === 'abilities' || key === 'default_unlocked') continue;
            if (key === 'attack' || key === 'defense') {
                card[key] = value ? parseInt(value) : null;
            } else if (key === 'cost') {
                card[key] = parseInt(value);
            } else {
                card[key] = value || null;
            }
        }

        const checkedAbilities = form.querySelectorAll('input[name="abilities"]:checked');
        card.abilities = Array.from(checkedAbilities).map(cb => cb.value.toUpperCase());

        const checkedAuras = form.querySelectorAll('input[name="visual_auras"]:checked');
        card.visual_auras = Array.from(checkedAuras).map(cb => cb.value.toUpperCase());

        const unlockCb = form.querySelector('input[name="default_unlocked"]');
        card.default_unlocked = unlockCb ? unlockCb.checked : true;

        card.effects = this.collectEffects();

        try {
            if (card.id && this.cards.find(c => c.id === card.id)) {
                await apiClient.updateCard(card.id, card);
            } else {
                await apiClient.createCard(card);
            }
            
            alert('Carta salva com sucesso!');
            this.hideCardForm();
            await this.loadCards();
        } catch (error) {
            console.error('Failed to save card:', error);
            alert('Erro ao salvar carta: ' + error.message);
        }
    }
    populateEffects(card) {
        const container = document.getElementById('effects-list');
        if (!container) return;
        container.innerHTML = '';

        let effects = card.effects || [];
        if (!Array.isArray(effects)) effects = [];
        if (effects.length === 0 && card.effect && card.effect.type) {
            effects = [card.effect];
        }

        for (const eff of effects) {
            this.addEffectRow(eff);
        }
    }

    addEffectRow(data = {}) {
        const container = document.getElementById('effects-list');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'effect-row';
        row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap';

        row.innerHTML = `
            <select class="eff-type" style="width:130px">
                <option value="">Nenhum</option>
                <option value="HEAL">Heal</option>
                <option value="DAMAGE">Damage</option>
                <option value="BUFF_ATTACK">Buff Attack</option>
                <option value="BUFF_DEFENSE">Buff Defense</option>
                <option value="BUFF_BOTH">Buff Both</option>
                <option value="DRAW">Draw</option>
                <option value="ADD_RESOURCES">Add Resources</option>
                <option value="DESTROY">Destroy</option>
                <option value="DAMAGE_ALL">Damage All</option>
                <option value="DAMAGE_GENERAL">Damage General</option>
                <option value="GRANT_ABILITY">Grant Ability</option>
                <option value="BUFF_ALL">Buff All</option>
            </select>
            <input type="number" class="eff-amount" min="0" value="0" style="width:60px" placeholder="Valor">
            <select class="eff-ability" style="width:130px;display:none">
                <option value="">Escolher...</option>
                <option value="STEALTH">Stealth</option>
                <option value="TAUNT">Taunt</option>
                <option value="DIVINE_SHIELD">Divine Shield</option>
                <option value="RUSH">Rush</option>
                <option value="CHARGE">Charge</option>
                <option value="LIFESTEAL">Lifesteal</option>
                <option value="REGENERATE">Regenerate</option>
                <option value="POISON">Poison</option>
            </select>
            <select class="eff-target" style="width:130px">
                <option value="OWN_GENERAL">Own General</option>
                <option value="ENEMY_GENERAL">Enemy General</option>
                <option value="SELF">Self</option>
                <option value="SINGLE_ALLY">Single Ally</option>
                <option value="ALL_ALLIES">All Allies</option>
                <option value="SINGLE_ENEMY">Single Enemy</option>
                <option value="ALL_ENEMIES">All Enemies</option>
            </select>
            <select class="eff-trigger" style="width:120px">
                <option value="INSTANT">Instant</option>
                <option value="ON_ENTER">On Enter</option>
                <option value="ON_ATTACK">On Attack</option>
                <option value="ON_DAMAGE">On Damage</option>
                <option value="ON_DEATH">On Death</option>
                <option value="START_TURN">Start Turn</option>
                <option value="END_TURN">End Turn</option>
            </select>
            <input type="number" class="eff-duration" min="0" value="0" style="width:60px" placeholder="Dur.">
            <button type="button" class="btn-danger" style="padding:2px 8px" onclick="this.closest('.effect-row').remove()">X</button>
        `;

        const typeSelect = row.querySelector('.eff-type');
        const amountInput = row.querySelector('.eff-amount');
        const abilitySelect = row.querySelector('.eff-ability');
        typeSelect.addEventListener('change', () => {
            const isGrant = typeSelect.value === 'GRANT_ABILITY';
            amountInput.style.display = isGrant ? 'none' : '';
            abilitySelect.style.display = isGrant ? '' : 'none';
        });

        const type = data.type || '';
        const amount = data.amount ?? 0;
        const target = data.target || 'OWN_GENERAL';
        const trigger = data.trigger || 'INSTANT';
        const duration = data.duration ?? 0;
        const ability = data.ability || '';

        typeSelect.value = type;
        amountInput.value = amount;
        row.querySelector('.eff-target').value = target;
        row.querySelector('.eff-trigger').value = trigger;
        row.querySelector('.eff-duration').value = duration;
        abilitySelect.value = ability;

        if (type === 'GRANT_ABILITY') {
            amountInput.style.display = 'none';
            abilitySelect.style.display = '';
        }

        container.appendChild(row);
    }

    collectEffects() {
        const rows = document.querySelectorAll('#effects-list .effect-row');
        const effects = [];

        rows.forEach(row => {
            const type = row.querySelector('.eff-type')?.value;
            if (!type) return;

            const eff = {
                type,
                amount: parseInt(row.querySelector('.eff-amount')?.value) || 0,
                target: row.querySelector('.eff-target')?.value || 'OWN_GENERAL',
                trigger: row.querySelector('.eff-trigger')?.value || 'INSTANT',
                duration: parseInt(row.querySelector('.eff-duration')?.value) || 0
            };

            if (type === 'GRANT_ABILITY') {
                eff.ability = row.querySelector('.eff-ability')?.value || '';
                delete eff.amount;
            }

            effects.push(eff);
        });

        return effects;
    }

}

// Initialize
const adminDashboard = new AdminDashboard();
window.adminDashboard = adminDashboard;
