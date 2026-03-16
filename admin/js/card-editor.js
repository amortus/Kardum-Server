// Card Editor - Editor visual de cartas com canvas HTML5
class CardEditor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.cardData = null;
    this.layout = null;
    this.selectedElement = null;
    this.isDragging = false;
    this.dragStartPos = { x: 0, y: 0 };
    this.cardWidth = 180;
    this.cardHeight = 260;
    this.zoomLevel = 1.0; // Zoom inicial
    this.mode = 'artwork';
    this.globalCardbaseUrl = null;
    
    // Imagens carregadas
    this.cardBaseImage = null;
    this.artworkImage = null;
    
    // Elementos posicionáveis
    this.elements = {
      artwork: { x: 0, y: 0, width: 0, height: 0, dragging: false, resizing: false },
      cost: { x: 0, y: 0, width: 40, height: 40, dragging: false, resizing: false },
      attack: { x: 0, y: 0, width: 40, height: 40, dragging: false, resizing: false },
      defense: { x: 0, y: 0, width: 40, height: 40, dragging: false, resizing: false },
      name: { x: 10, y: 30, width: 160, height: 20, fontSize: 14, dragging: false, resizing: false },
      description: { x: 10, y: 220, width: 160, height: 30, fontSize: 10, dragging: false, resizing: false }
    };
    
    // Estado de resize
    this.resizeHandle = null; // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
    this.resizeStartPos = { x: 0, y: 0 };
    this.resizeStartSize = { width: 0, height: 0 };
    this.resizeStartElementPos = { x: 0, y: 0 };
  }

  async init(cardId, cardData, options = {}) {
    this.mode = options.mode || 'artwork';
    this.globalCardbaseUrl = options.globalCardbaseUrl || null;
    this.cardData = cardData;
    
    // Carregar layout conforme o modo de edição
    if (this.mode === 'vfx-global') {
      this.layout = options.globalVfxLayout || layoutManager.getDefaultGlobalVfxLayout();
    } else {
      this.layout = await layoutManager.loadLayout(cardId);
    }
    
    // Inicializar canvas
    this.canvas = document.getElementById('card-editor-canvas');
    if (!this.canvas) {
      throw new Error('Canvas element not found');
    }
    
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = this.cardWidth;
    this.canvas.height = this.cardHeight;
    
    // Atualizar tamanho visual baseado no zoom
    this.updateCanvasSize();
    
    // Carregar imagens
    await this.loadImages();
    
    // Atualizar elementos a partir do layout
    this.updateElementsFromLayout();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Renderizar inicial (com tratamento de erro)
    try {
      this.render();
    } catch (error) {
      console.error('Error rendering card:', error);
      // Renderizar apenas o placeholder se houver erro
      this.ctx.clearRect(0, 0, this.cardWidth, this.cardHeight);
      this.ctx.fillStyle = '#1a1a2e';
      this.ctx.fillRect(0, 0, this.cardWidth, this.cardHeight);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Erro ao carregar carta', this.cardWidth / 2, this.cardHeight / 2);
    }
    
    // Atualizar controles
    this.updateControls();
    
    // Atualizar display do zoom
    const zoomLevelEl = document.getElementById('zoom-level');
    if (zoomLevelEl) {
      zoomLevelEl.textContent = Math.round(this.zoomLevel * 100) + '%';
    }
  }

  async loadImages() {
    // Carregar card base
    this.cardBaseImage = new Image();
    this.cardBaseImage.crossOrigin = 'anonymous';
    const cardbaseSrc = this._normalizeImageSource(this.globalCardbaseUrl || '/assets/Raw/Card-Base.png');
    this.cardBaseImage.src = cardbaseSrc;
    
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('Card base image load timeout, using placeholder');
        resolve();
      }, 3000);
      
      this.cardBaseImage.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      this.cardBaseImage.onerror = () => {
        clearTimeout(timeout);
        console.warn('Card base image not found, using placeholder');
        resolve();
      };
    });

    // Carregar artwork se houver
    if (this.cardData.image_url) {
      this.artworkImage = new Image();
      this.artworkImage.crossOrigin = 'anonymous';
      
      // Tentar diferentes caminhos se for relativo
      let imageSrc = this.cardData.image_url;
      if (!imageSrc.startsWith('http://') && !imageSrc.startsWith('https://') && !imageSrc.startsWith('data:')) {
        // Se não começar com /, adicionar
        if (!imageSrc.startsWith('/')) {
          imageSrc = '/' + imageSrc;
        }
      }
      
      this.artworkImage.src = imageSrc;
      
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('Artwork image load timeout');
          this.artworkImage = null; // Limpar referência se falhar
          resolve();
        }, 5000);
        
        this.artworkImage.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        this.artworkImage.onerror = () => {
          clearTimeout(timeout);
          // Não logar como warning: image_url antigo (ex.: /assets/...) pode não existir; editor usa placeholder
          this.artworkImage = null; // Limpar referência se falhar
          resolve();
        };
      });
    }
  }

  _normalizeImageSource(src) {
    if (!src) return '/assets/Raw/Card-Base.png';
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      return src;
    }
    return src.startsWith('/') ? src : `/${src}`;
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

    // Touch events para mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const mouseEvent = new MouseEvent('mouseup', {});
      this.canvas.dispatchEvent(mouseEvent);
    });
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    // Converter coordenadas da tela (com zoom) para coordenadas internas do canvas (180x260)
    const scaleX = this.cardWidth / rect.width;
    const scaleY = this.cardHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  getElementAt(x, y) {
    // Verificar handles de resize primeiro
    if (this.selectedElement) {
      const handle = this.getResizeHandleAt(x, y);
      if (handle) {
        return { type: 'resize', handle, element: this.selectedElement };
      }
    }
    
    // Verificar elementos de trás para frente
    let elements = ['defense', 'attack', 'cost', 'artwork', 'name', 'description'];
    if (this.mode === 'vfx-global') {
      elements = ['defense', 'attack', 'cost', 'name', 'description'];
    } else if (this.mode === 'artwork') {
      elements = ['artwork'];
    }
    // Tolerância em pixels (coordenadas do canvas) para facilitar seleção com zoom
    const hitTolerance = 6;
    
    for (const elementName of elements) {
      const element = this.elements[elementName];
      const tol = elementName === 'artwork' ? hitTolerance * 2 : hitTolerance; // artwork com mais margem
      if (x >= element.x - tol && x <= element.x + element.width + tol &&
          y >= element.y - tol && y <= element.y + element.height + tol) {
        return { type: 'element', name: elementName };
      }
    }
    
    return null;
  }
  
  getResizeHandleAt(x, y) {
    if (!this.selectedElement) return null;
    
    const element = this.elements[this.selectedElement];
    // Handles um pouco maiores para facilitar com zoom
    const handleSize = 10;
    const handles = [
      { name: 'nw', x: element.x, y: element.y },
      { name: 'ne', x: element.x + element.width, y: element.y },
      { name: 'sw', x: element.x, y: element.y + element.height },
      { name: 'se', x: element.x + element.width, y: element.y + element.height },
      { name: 'n', x: element.x + element.width / 2, y: element.y },
      { name: 's', x: element.x + element.width / 2, y: element.y + element.height },
      { name: 'w', x: element.x, y: element.y + element.height / 2 },
      { name: 'e', x: element.x + element.width, y: element.y + element.height / 2 }
    ];
    
    for (const handle of handles) {
      if (Math.abs(x - handle.x) < handleSize && Math.abs(y - handle.y) < handleSize) {
        return handle.name;
      }
    }
    
    return null;
  }

  handleMouseDown(e) {
    const pos = this.getMousePos(e);
    const hit = this.getElementAt(pos.x, pos.y);
    
    if (!hit) {
      this.selectedElement = null;
      this.render();
      return;
    }
    
    if (hit.type === 'resize') {
      // Iniciar resize
      this.selectedElement = hit.element;
      this.resizeHandle = hit.handle;
      this.isDragging = true;
      const element = this.elements[hit.element];
      // Salvar posição inicial do mouse e do elemento
      this.resizeStartPos = { x: pos.x, y: pos.y };
      this.resizeStartSize = { width: element.width, height: element.height };
      // Salvar posição inicial do elemento também
      this.resizeStartElementPos = { x: element.x, y: element.y };
      element.resizing = true;
      this.updateCursorForResize(hit.handle);
    } else if (hit.type === 'element') {
      // Iniciar drag
      this.selectedElement = hit.name;
      this.isDragging = true;
      const element = this.elements[hit.name];
      // Calcular offset corretamente
      this.dragStartPos = { x: pos.x - element.x, y: pos.y - element.y };
      element.dragging = true;
      this.canvas.style.cursor = 'grabbing';
    }
  }
  
  updateCursorForResize(handle) {
    const cursors = {
      'nw': 'nw-resize', 'ne': 'ne-resize',
      'sw': 'sw-resize', 'se': 'se-resize',
      'n': 'n-resize', 's': 's-resize',
      'e': 'e-resize', 'w': 'w-resize'
    };
    this.canvas.style.cursor = cursors[handle] || 'default';
  }

  handleMouseMove(e) {
    const pos = this.getMousePos(e);
    
    if (this.isDragging && this.selectedElement) {
      const element = this.elements[this.selectedElement];
      
      if (element.resizing && this.resizeHandle) {
        // Resize - corrigir cálculo para evitar "sair correndo"
        const deltaX = pos.x - this.resizeStartPos.x;
        const deltaY = pos.y - this.resizeStartPos.y;
        
        // Usar posição inicial salva
        let newX = this.resizeStartElementPos.x;
        let newY = this.resizeStartElementPos.y;
        let newWidth = this.resizeStartSize.width;
        let newHeight = this.resizeStartSize.height;
        
        // Aplicar resize baseado no handle
        if (this.resizeHandle.includes('e')) {
          // Leste - expandir para direita
          newWidth = Math.max(20, this.resizeStartSize.width + deltaX);
        }
        if (this.resizeHandle.includes('w')) {
          // Oeste - expandir para esquerda
          newWidth = Math.max(20, this.resizeStartSize.width - deltaX);
          newX = this.resizeStartElementPos.x + deltaX;
        }
        if (this.resizeHandle.includes('s')) {
          // Sul - expandir para baixo
          newHeight = Math.max(10, this.resizeStartSize.height + deltaY);
        }
        if (this.resizeHandle.includes('n')) {
          // Norte - expandir para cima
          newHeight = Math.max(10, this.resizeStartSize.height - deltaY);
          newY = this.resizeStartElementPos.y + deltaY;
        }
        
        // Garantir que não saia dos limites da carta
        newX = Math.max(0, Math.min(newX, this.cardWidth - newWidth));
        newY = Math.max(0, Math.min(newY, this.cardHeight - newHeight));
        newWidth = Math.min(newWidth, this.cardWidth - newX);
        newHeight = Math.min(newHeight, this.cardHeight - newY);
        
        element.width = newWidth;
        element.height = newHeight;
        element.x = newX;
        element.y = newY;
      } else {
        // Drag - manter posição relativa correta
        const newX = pos.x - this.dragStartPos.x;
        const newY = pos.y - this.dragStartPos.y;
        
        // Garantir que não saia dos limites da carta
        element.x = Math.max(0, Math.min(newX, this.cardWidth - element.width));
        element.y = Math.max(0, Math.min(newY, this.cardHeight - element.height));
      }
      
      // Atualizar layout
      this.updateLayoutFromElements();
      
      // Re-renderizar
      this.render();
      
      // Atualizar controles
      this.updateControls();
    } else {
      // Verificar hover
      const hit = this.getElementAt(pos.x, pos.y);
      if (hit && hit.type === 'resize') {
        this.updateCursorForResize(hit.handle);
      } else if (hit && hit.type === 'element') {
        this.canvas.style.cursor = 'grab';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }
  }

  handleMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
      if (this.selectedElement) {
        this.elements[this.selectedElement].dragging = false;
        this.elements[this.selectedElement].resizing = false;
      }
      this.resizeHandle = null;
      this.canvas.style.cursor = 'default';
    }
  }

  updateLayoutFromElements() {
    if (!this.layout) return;

    // Atualizar artwork
    if (this.mode !== 'vfx-global' && this.elements.artwork && this.layout.artwork) {
      this.layout.artwork.offsetLeft = this.elements.artwork.x;
      this.layout.artwork.offsetTop = this.elements.artwork.y;
      this.layout.artwork.offsetRight = -(this.cardWidth - this.elements.artwork.x - this.elements.artwork.width);
      this.layout.artwork.offsetBottom = -(this.cardHeight - this.elements.artwork.y - this.elements.artwork.height);
    }

    // No modo artwork individual não atualizamos campos de VFX.
    if (this.mode === 'artwork') {
      return;
    }

    // Atualizar badges
    if (this.elements.cost) {
      this.layout.cost.offsetLeft = this.elements.cost.x;
      this.layout.cost.offsetTop = this.elements.cost.y;
    }

    if (this.elements.attack) {
      this.layout.attack.offsetLeft = this.elements.attack.x;
      this.layout.attack.offsetTop = this.elements.attack.y;
    }

    if (this.elements.defense) {
      this.layout.defense.offsetLeft = this.elements.defense.x - this.cardWidth;
      this.layout.defense.offsetTop = this.elements.defense.y;
    }
    
    // Atualizar nome e descrição
    if (this.elements.name) {
      if (!this.layout.name) this.layout.name = {};
      this.layout.name.offsetLeft = this.elements.name.x;
      this.layout.name.offsetTop = this.elements.name.y;
      this.layout.name.width = this.elements.name.width;
      this.layout.name.height = this.elements.name.height;
      this.layout.name.fontSize = this.elements.name.fontSize;
    }
    
    if (this.elements.description) {
      if (!this.layout.description) this.layout.description = {};
      this.layout.description.offsetLeft = this.elements.description.x;
      this.layout.description.offsetTop = this.elements.description.y;
      this.layout.description.width = this.elements.description.width;
      this.layout.description.height = this.elements.description.height;
      this.layout.description.fontSize = this.elements.description.fontSize;
    }
  }

  updateElementsFromLayout() {
    if (!this.layout) return;

    // Atualizar artwork
    if (this.layout.artwork) {
      this.elements.artwork.x = this.layout.artwork.offsetLeft || 55;
      this.elements.artwork.y = this.layout.artwork.offsetTop || 90;
      const right = this.layout.artwork.offsetRight || -55;
      const bottom = this.layout.artwork.offsetBottom || -100;
      this.elements.artwork.width = this.cardWidth - this.elements.artwork.x + right;
      this.elements.artwork.height = this.cardHeight - this.elements.artwork.y + bottom;
    }

    // Atualizar badges
    if (this.layout.cost) {
      this.elements.cost.x = this.layout.cost.offsetLeft || -8;
      this.elements.cost.y = this.layout.cost.offsetTop || -30;
    }

    if (this.layout.attack) {
      this.elements.attack.x = this.layout.attack.offsetLeft || 20;
      this.elements.attack.y = this.layout.attack.offsetTop || -20;
    }

    if (this.layout.defense) {
      this.elements.defense.x = this.cardWidth + (this.layout.defense.offsetLeft || -40);
      this.elements.defense.y = this.layout.defense.offsetTop || -20;
    }
    
    // Atualizar nome e descrição se existirem no layout
    if (this.layout.name) {
      this.elements.name.x = this.layout.name.offsetLeft || 10;
      this.elements.name.y = this.layout.name.offsetTop || 30;
      this.elements.name.width = this.layout.name.width || 160;
      this.elements.name.height = this.layout.name.height || 20;
      this.elements.name.fontSize = this.layout.name.fontSize || 14;
    }
    
    if (this.layout.description) {
      this.elements.description.x = this.layout.description.offsetLeft || 10;
      this.elements.description.y = this.layout.description.offsetTop || 220;
      this.elements.description.width = this.layout.description.width || 160;
      this.elements.description.height = this.layout.description.height || 30;
      this.elements.description.fontSize = this.layout.description.fontSize || 10;
    }
  }

  render(renderForPreview = false) {
    if (!this.ctx) {
      console.warn('Canvas context not available');
      return;
    }

    try {
      // Limpar canvas
      this.ctx.clearRect(0, 0, this.cardWidth, this.cardHeight);

      // 1. PRIMEIRO: Renderizar artwork (por trás da base)
      if (this.artworkImage && 
          this.artworkImage.complete && 
          this.artworkImage.naturalWidth > 0 && 
          this.artworkImage.naturalHeight > 0 &&
          this.elements.artwork) {
        try {
          const art = this.elements.artwork;
          this.ctx.drawImage(this.artworkImage, art.x, art.y, art.width, art.height);
        } catch (e) {
          console.warn('Failed to draw artwork:', e);
        }
      }

      // 2. SEGUNDO: Renderizar card base (por cima do artwork)
      if (this.cardBaseImage && 
          this.cardBaseImage.complete && 
          this.cardBaseImage.naturalWidth > 0 && 
          this.cardBaseImage.naturalHeight > 0) {
        try {
          this.ctx.drawImage(this.cardBaseImage, 0, 0, this.cardWidth, this.cardHeight);
        } catch (e) {
          console.warn('Failed to draw card base image:', e);
          // Placeholder apenas se não houver base
          this.ctx.fillStyle = '#1a1a2e';
          this.ctx.fillRect(0, 0, this.cardWidth, this.cardHeight);
        }
      } else {
        // Placeholder apenas se não houver base
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.cardWidth, this.cardHeight);
      }
    } catch (error) {
      console.error('Error in render:', error);
      // Fallback: desenhar apenas um retângulo simples
      this.ctx.clearRect(0, 0, this.cardWidth, this.cardHeight);
      this.ctx.fillStyle = '#1a1a2e';
      this.ctx.fillRect(0, 0, this.cardWidth, this.cardHeight);
    }

    // 3. TERCEIRO: Renderizar elementos de UI (badges, texto) - apenas se não for preview
    if (!renderForPreview && this.mode !== 'vfx-global') {
      // Renderizar artwork selection (se estiver selecionado)
      if (this.elements.artwork && (this.selectedElement === 'artwork' || this.elements.artwork.dragging || this.elements.artwork.resizing)) {
        const art = this.elements.artwork;
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(art.x, art.y, art.width, art.height);
        this.drawResizeHandles(art);
      }
    }

    // Modo artwork: mostrar somente base+artwork (sem textos/stats) para evitar conflitos de edição.
    if (this.mode === 'artwork') {
      return;
    }

    // Renderizar badges: no editor com bolinhas coloridas; no preview só números
    if (!renderForPreview) {
      this.renderBadge('cost', this.cardData.cost || 0, '#4a9eff', true);
      this.renderBadge('attack', this.cardData.attack || 0, '#ff4444', true);
      this.renderBadge('defense', this.cardData.defense || 0, '#44ff44', true);

      // Renderizar nome
      if (this.elements.name) {
        const nameEl = this.elements.name;
        this.renderText(
          this.cardData.name || 'Card Name',
          nameEl.x,
          nameEl.y,
          nameEl.fontSize,
          '#fff',
          nameEl.width
        );
        
        // Desenhar borda de seleção
        if (this.selectedElement === 'name' || nameEl.dragging || nameEl.resizing) {
          this.ctx.strokeStyle = '#00ff00';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(nameEl.x, nameEl.y, nameEl.width, nameEl.height);
          this.drawResizeHandles(nameEl);
        }
      }

      // Renderizar descrição
      if (this.cardData.text && this.elements.description) {
        const descEl = this.elements.description;
        this.renderText(
          this.cardData.text,
          descEl.x,
          descEl.y,
          descEl.fontSize,
          '#ccc',
          descEl.width
        );
        
        // Desenhar borda de seleção
        if (this.selectedElement === 'description' || descEl.dragging || descEl.resizing) {
          this.ctx.strokeStyle = '#00ff00';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(descEl.x, descEl.y, descEl.width, descEl.height);
          this.drawResizeHandles(descEl);
        }
      }
    } else {
      // Preview: só os números nos badges (sem bolinhas coloridas)
      this.renderBadge('cost', this.cardData.cost || 0, '#4a9eff', false);
      this.renderBadge('attack', this.cardData.attack || 0, '#ff4444', false);
      this.renderBadge('defense', this.cardData.defense || 0, '#44ff44', false);

      if (this.elements.name) {
        const nameEl = this.elements.name;
        this.renderText(
          this.cardData.name || 'Card Name',
          nameEl.x,
          nameEl.y,
          nameEl.fontSize,
          '#fff',
          nameEl.width
        );
      }

      if (this.cardData.text && this.elements.description) {
        const descEl = this.elements.description;
        this.renderText(
          this.cardData.text,
          descEl.x,
          descEl.y,
          descEl.fontSize,
          '#ccc',
          descEl.width
        );
      }
    }
  }
  
  setZoom(level) {
    this.zoomLevel = Math.max(0.5, Math.min(3.0, level)); // Limitar entre 0.5x e 3x
    this.updateCanvasSize();
    this.render();
  }
  
  zoomIn() {
    this.setZoom(this.zoomLevel + 0.1);
  }
  
  zoomOut() {
    this.setZoom(this.zoomLevel - 0.1);
  }
  
  resetZoom() {
    this.setZoom(1.0);
  }
  
  updateCanvasSize() {
    if (!this.canvas) return;
    
    // Ajustar tamanho visual do canvas baseado no zoom
    this.canvas.style.width = (this.cardWidth * this.zoomLevel) + 'px';
    this.canvas.style.height = (this.cardHeight * this.zoomLevel) + 'px';
  }
  
  // Gerar imagem final da carta (sem handles de edição) em resolução maior para qualidade
  generateCardImage() {
    const exportScale = 3; // 3x para PNG de boa qualidade (540x780)
    const exportWidth = this.cardWidth * exportScale;
    const exportHeight = this.cardHeight * exportScale;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = exportWidth;
    tempCanvas.height = exportHeight;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.scale(exportScale, exportScale);

    const originalCtx = this.ctx;
    this.ctx = tempCtx;

    this.render(true);

    this.ctx = originalCtx;

    return tempCanvas.toDataURL('image/png');
  }

  renderBadge(name, value, color, showCircle = true) {
    const element = this.elements[name];
    if (!element) return;

    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;

    // Bolinha colorida só no editor (para identificar custo/ataque/defesa)
    if (showCircle) {
      const rgba = this.hexToRgba(color, 0.7);
      this.ctx.fillStyle = rgba;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, element.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      // Borda de seleção e handles
      if (this.selectedElement === name || element.dragging || element.resizing) {
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.drawResizeHandles(element);
      }
    }

    // Número (sempre visível; no preview só o número, sem bolinha)
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(value.toString(), cx, cy);
  }
  
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  drawResizeHandles(element) {
    const handleSize = 6;
    const handles = [
      { x: element.x, y: element.y }, // nw
      { x: element.x + element.width, y: element.y }, // ne
      { x: element.x, y: element.y + element.height }, // sw
      { x: element.x + element.width, y: element.y + element.height }, // se
      { x: element.x + element.width / 2, y: element.y }, // n
      { x: element.x + element.width / 2, y: element.y + element.height }, // s
      { x: element.x, y: element.y + element.height / 2 }, // w
      { x: element.x + element.width, y: element.y + element.height / 2 } // e
    ];
    
    this.ctx.fillStyle = '#00ff00';
    for (const handle of handles) {
      this.ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    }
  }

  renderText(text, x, y, size, color, maxWidth) {
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px Arial`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    
    if (maxWidth) {
      // Quebrar texto se necessário
      const words = text.split(' ');
      let line = '';
      let lineY = y;
      
      for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = this.ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && line.length > 0) {
          this.ctx.fillText(line, x, lineY);
          line = word + ' ';
          lineY += size + 2;
        } else {
          line = testLine;
        }
      }
      this.ctx.fillText(line, x, lineY);
    } else {
      this.ctx.fillText(text, x, y);
    }
  }

  updateControls() {
    if (!this.layout) return;

    // Atualizar sliders e inputs
    const updateControl = (prefix, values) => {
      Object.keys(values).forEach(key => {
        const input = document.getElementById(`${prefix}-${key}`);
        if (input) {
          input.value = values[key];
        }
      });
    };

    if (this.layout.artwork) {
      updateControl('artwork', {
        'offset-left': this.layout.artwork.offsetLeft,
        'offset-top': this.layout.artwork.offsetTop,
        'offset-right': this.layout.artwork.offsetRight,
        'offset-bottom': this.layout.artwork.offsetBottom
      });
    }

    if (this.layout.cost) {
      updateControl('cost', {
        'offset-left': this.layout.cost.offsetLeft,
        'offset-top': this.layout.cost.offsetTop
      });
    }

    if (this.layout.attack) {
      updateControl('attack', {
        'offset-left': this.layout.attack.offsetLeft,
        'offset-top': this.layout.attack.offsetTop
      });
    }

    if (this.layout.defense) {
      updateControl('defense', {
        'offset-left': this.layout.defense.offsetLeft,
        'offset-top': this.layout.defense.offsetTop
      });
    }
  }

  async save() {
    if (!this.cardData || !this.layout) return;

    try {
      layoutManager.validateLayout(this.layout);
      await layoutManager.saveLayout(this.cardData.id, this.layout);
      return true;
    } catch (error) {
      console.error('Failed to save layout:', error);
      throw error;
    }
  }

  reset() {
    this.layout = this.mode === 'vfx-global'
      ? layoutManager.getDefaultGlobalVfxLayout()
      : layoutManager.getDefaultLayout();
    this.updateElementsFromLayout();
    this.render();
    this.updateControls();
  }
}

const cardEditor = new CardEditor();
window.cardEditor = cardEditor;
