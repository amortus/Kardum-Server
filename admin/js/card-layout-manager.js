// Card Layout Manager - Gerencia estados de layout e sincronização com banco
class CardLayoutManager {
  constructor() {
    this.defaultLayout = {
      artwork: {
        offsetLeft: 55.0,
        offsetTop: 90.0,
        offsetRight: -55.0,
        offsetBottom: -100.0,
        expandMode: 1,
        stretchMode: 5
      },
      cost: {
        offsetLeft: -8.0,
        offsetTop: -30.0
      },
      attack: {
        offsetLeft: 20.0,
        offsetTop: -20.0
      },
      defense: {
        offsetLeft: -40.0,
        offsetTop: -20.0
      },
      name: {
        offsetLeft: 10.0,
        offsetTop: 30.0,
        width: 160.0,
        height: 20.0,
        fontSize: 14
      },
      description: {
        offsetLeft: 10.0,
        offsetTop: 220.0,
        width: 160.0,
        height: 30.0,
        fontSize: 10
      }
    };
  }

  getDefaultLayout() {
    return JSON.parse(JSON.stringify(this.defaultLayout));
  }

  getDefaultGlobalVfxLayout() {
    return {
      cost: { ...this.defaultLayout.cost },
      attack: { ...this.defaultLayout.attack },
      defense: { ...this.defaultLayout.defense },
      name: { ...this.defaultLayout.name },
      description: { ...this.defaultLayout.description },
      cardbaseImageUrl: null
    };
  }

  async loadLayout(cardId) {
    try {
      const response = await apiClient.getCardLayout(cardId);
      if (response.layout) {
        return this.parseLayout(response.layout);
      }
      return this.getDefaultLayout();
    } catch (error) {
      console.warn('Failed to load layout, using default:', error);
      return this.getDefaultLayout();
    }
  }

  async saveLayout(cardId, layout) {
    try {
      await apiClient.updateCard(cardId, { layout });
      return true;
    } catch (error) {
      console.error('Failed to save layout:', error);
      throw error;
    }
  }

  async loadGlobalVfxLayout() {
    try {
      const response = await apiClient.getGlobalVfxLayout();
      if (response.layout) {
        const parsed = response.layout;
        return {
          cost: {
            offsetLeft: parsed.cost?.offsetLeft ?? this.defaultLayout.cost.offsetLeft,
            offsetTop: parsed.cost?.offsetTop ?? this.defaultLayout.cost.offsetTop
          },
          attack: {
            offsetLeft: parsed.attack?.offsetLeft ?? this.defaultLayout.attack.offsetLeft,
            offsetTop: parsed.attack?.offsetTop ?? this.defaultLayout.attack.offsetTop
          },
          defense: {
            offsetLeft: parsed.defense?.offsetLeft ?? this.defaultLayout.defense.offsetLeft,
            offsetTop: parsed.defense?.offsetTop ?? this.defaultLayout.defense.offsetTop
          },
          name: {
            offsetLeft: parsed.name?.offsetLeft ?? this.defaultLayout.name.offsetLeft,
            offsetTop: parsed.name?.offsetTop ?? this.defaultLayout.name.offsetTop,
            width: parsed.name?.width ?? this.defaultLayout.name.width,
            height: parsed.name?.height ?? this.defaultLayout.name.height,
            fontSize: parsed.name?.fontSize ?? this.defaultLayout.name.fontSize
          },
          description: {
            offsetLeft: parsed.description?.offsetLeft ?? this.defaultLayout.description.offsetLeft,
            offsetTop: parsed.description?.offsetTop ?? this.defaultLayout.description.offsetTop,
            width: parsed.description?.width ?? this.defaultLayout.description.width,
            height: parsed.description?.height ?? this.defaultLayout.description.height,
            fontSize: parsed.description?.fontSize ?? this.defaultLayout.description.fontSize
          },
          cardbaseImageUrl: parsed.cardbaseImageUrl ?? null
        };
      }
      return this.getDefaultGlobalVfxLayout();
    } catch (error) {
      console.warn('Failed to load global VFX layout, using default:', error);
      return this.getDefaultGlobalVfxLayout();
    }
  }

  async saveGlobalVfxLayout(layout) {
    await apiClient.updateGlobalVfxLayout(layout);
    return true;
  }

  parseLayout(dbLayout) {
    return {
      artwork: {
        offsetLeft: dbLayout.artwork_offset_left ?? this.defaultLayout.artwork.offsetLeft,
        offsetTop: dbLayout.artwork_offset_top ?? this.defaultLayout.artwork.offsetTop,
        offsetRight: dbLayout.artwork_offset_right ?? this.defaultLayout.artwork.offsetRight,
        offsetBottom: dbLayout.artwork_offset_bottom ?? this.defaultLayout.artwork.offsetBottom,
        expandMode: dbLayout.artwork_expand_mode ?? this.defaultLayout.artwork.expandMode,
        stretchMode: dbLayout.artwork_stretch_mode ?? this.defaultLayout.artwork.stretchMode
      },
      cost: {
        offsetLeft: dbLayout.cost_offset_left ?? this.defaultLayout.cost.offsetLeft,
        offsetTop: dbLayout.cost_offset_top ?? this.defaultLayout.cost.offsetTop
      },
      attack: {
        offsetLeft: dbLayout.attack_offset_left ?? this.defaultLayout.attack.offsetLeft,
        offsetTop: dbLayout.attack_offset_top ?? this.defaultLayout.attack.offsetTop
      },
      defense: {
        offsetLeft: dbLayout.defense_offset_left ?? this.defaultLayout.defense.offsetLeft,
        offsetTop: dbLayout.defense_offset_top ?? this.defaultLayout.defense.offsetTop
      },
      name: {
        offsetLeft: dbLayout.name_offset_left ?? this.defaultLayout.name.offsetLeft,
        offsetTop: dbLayout.name_offset_top ?? this.defaultLayout.name.offsetTop,
        width: dbLayout.name_width ?? this.defaultLayout.name.width,
        height: dbLayout.name_height ?? this.defaultLayout.name.height,
        fontSize: dbLayout.name_font_size ?? this.defaultLayout.name.fontSize
      },
      description: {
        offsetLeft: dbLayout.description_offset_left ?? this.defaultLayout.description.offsetLeft,
        offsetTop: dbLayout.description_offset_top ?? this.defaultLayout.description.offsetTop,
        width: dbLayout.description_width ?? this.defaultLayout.description.width,
        height: dbLayout.description_height ?? this.defaultLayout.description.height,
        fontSize: dbLayout.description_font_size ?? this.defaultLayout.description.fontSize
      }
    };
  }

  validateLayout(layout) {
    // Validações básicas
    const cardWidth = 180;
    const cardHeight = 260;

    // Validar artwork offsets
    if (layout.artwork) {
      const left = layout.artwork.offsetLeft || 0;
      const right = layout.artwork.offsetRight || 0;
      if (left - right >= cardWidth) {
        throw new Error('Artwork offsets invalid: left - right >= card width');
      }
    }

    return true;
  }
}

const layoutManager = new CardLayoutManager();
window.layoutManager = layoutManager;
