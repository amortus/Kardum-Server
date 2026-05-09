import type { Card } from '../../../shared/types';

export const NECROMANCER_COLLECTION = {
  id: 'necromancer',
  name: 'Necromantes',
  description: 'O Despertar Necromante — Mortos-Vivos'
};

const COLLECTION_ID = 'necromancer';

type EffectIn = { type: string; value: number; target: string; trigger?: string; duration?: number };

const def = (
  id: string,
  name: string,
  cost: number,
  attack: number,
  defense: number,
  abilities: string[] = [],
  text: string = '—',
  effects: EffectIn[] = []
) => ({
  id,
  name,
  type: 'DEFENDER',
  race: 'necromancer',
  class: null,
  cost,
  abilities,
  text,
  rarity: 'COMMON',
  image_url: null,
  effects: effects.map((e) => ({ trigger: 'INSTANT', duration: 0, ...e })),
  default_unlocked: true,
  is_active: true,
  collection_id: COLLECTION_ID,
  visual_auras: [],
  attack,
  defense
});

const abi = (
  id: string,
  name: string,
  cost: number,
  abilities: string[] = [],
  text: string = '—',
  effects: EffectIn[] = []
) => ({
  id,
  name,
  type: 'ABILITY',
  race: null,
  class: null,
  cost,
  abilities,
  text,
  rarity: 'COMMON',
  image_url: null,
  effects: effects.map((e) => ({ trigger: 'INSTANT', duration: 0, ...e })),
  default_unlocked: true,
  is_active: true,
  collection_id: COLLECTION_ID,
  visual_auras: [],
  attack: null,
  defense: null
});

const eq = (
  id: string,
  name: string,
  cost: number,
  abilities: string[] = [],
  text: string = '—',
  effects: EffectIn[] = []
) => ({
  id,
  name,
  type: 'EQUIPMENT',
  race: null,
  class: null,
  cost,
  abilities,
  text,
  rarity: 'COMMON',
  image_url: null,
  effects: effects.map((e) => ({ trigger: 'INSTANT', duration: 0, ...e })),
  default_unlocked: true,
  is_active: true,
  collection_id: COLLECTION_ID,
  visual_auras: [],
  attack: null,
  defense: null
});

const drawN = (n: number): EffectIn[] => [{ type: 'DRAW', value: n, target: 'OWN_GENERAL' }];

export const NECROMANCER_CARD_CATALOG = [
  // ===== Monstros de Efeito (20) =====
  def('nec_001_necromante_arquilich', 'Necromante Arquilich', 10, 8, 7, [], '—'),
  def('nec_002_senhor_dos_mortos', 'Senhor dos Mortos', 8, 6, 5, ['buff_all'], '+1/+1 all'),
  def('nec_003_dragao_ossificado', 'Dragão Ossificado', 7, 7, 4, [], '—'),
  def('nec_004_cavaleiro_espectral', 'Cavaleiro Espectral', 4, 4, 3, ['stealth'], 'Stealth'),
  def('nec_005_banshee_da_ruina', 'Banshee da Ruína', 3, 3, 2, [], '—'),
  def('nec_006_colossus_de_ossos', 'Colossus de Ossos', 9, 7, 7, ['divine_shield'], 'Imune'),
  def('nec_007_vampiro_anciao', 'Vampiro Ancião', 5, 5, 4, ['lifesteal'], 'Lifesteal'),
  def('nec_008_espectro_devorador', 'Espectro Devorador', 4, 4, 3, [], '—'),
  def('nec_009_lich_menor', 'Lich Menor', 3, 2, 4, [], '—'),
  def('nec_010_zumbi_arcano', 'Zumbi Arcano', 2, 2, 3, [], '—'),
  def('nec_011_golem_de_carne', 'Golem de Carne', 6, 4, 4, [], '—'),
  def('nec_012_bruxa_sombria', 'Bruxa Sombria', 4, 3, 3, [], '—'),
  def('nec_013_revenant_eterno', 'Revenant Eterno', 5, 4, 4, [], '—'),
  def('nec_014_barao_morto_vivo', 'Barão Morto-Vivo', 6, 5, 4, [], '—'),
  def('nec_015_aranha_necrotica', 'Aranha Necrótica', 3, 2, 4, [], '—'),
  def('nec_016_wraith_ceifador', 'Wraith Ceifador', 7, 6, 4, [], '—'),
  def('nec_017_carnical_do_abismo', 'Carniçal do Abismo', 2, 2, 2, [], '+1 card', drawN(1)),
  def('nec_018_lich_da_tempestade', 'Lich da Tempestade', 8, 6, 6, [], '—'),
  def('nec_019_dragao_lich_supremo', 'Dragão-Lich Supremo', 10, 9, 6, ['divine_shield', 'damage_all'], 'Imune Dmg all'),
  def('nec_020_ceifador_eterno', 'Ceifador Eterno', 9, 7, 6, [], '—'),

  // ===== Monstros Normais (15) =====
  def('nec_021_esqueleto_guerreiro', 'Esqueleto Guerreiro', 1, 2, 2, [], '—'),
  def('nec_022_zumbi_comum', 'Zumbi Comum', 2, 3, 1, [], '—'),
  def('nec_023_espectro_palido', 'Espectro Pálido', 3, 3, 3, [], '—'),
  def('nec_024_carnical', 'Carniçal', 2, 3, 2, [], '—'),
  def('nec_025_esqueleto_arqueiro', 'Esqueleto Arqueiro', 3, 3, 2, [], '—'),
  def('nec_026_zumbi_de_guerra', 'Zumbi de Guerra', 4, 4, 3, [], '—'),
  def('nec_027_fantasma_menor', 'Fantasma Menor', 1, 1, 1, [], '—'),
  def('nec_028_ossario_andante', 'Ossário Andante', 5, 4, 4, [], '—'),
  def('nec_029_esqueleto_mago', 'Esqueleto Mago', 4, 4, 3, [], '—'),
  def('nec_030_sombra_menor', 'Sombra Menor', 2, 2, 2, [], '—'),
  def('nec_031_zumbi_anciao', 'Zumbi Ancião', 5, 5, 4, [], '—'),
  def('nec_032_espectro_do_crepusculo', 'Espectro do Crepúsculo', 6, 5, 4, [], '—'),
  def('nec_033_esqueleto_lanceiro', 'Esqueleto Lanceiro', 3, 3, 3, [], '—'),
  def('nec_034_carnical_faminto', 'Carniçal Faminto', 3, 4, 1, [], '—'),
  def('nec_035_sombra_velada', 'Sombra Velada', 4, 4, 2, [], '—'),

  // ===== Magias (20) =====
  abi('nec_036_ressurreicao_sombria', 'Ressurreição Sombria', 4, [], '—'),
  abi('nec_037_praga_necrotica', 'Praga Necrótica', 6, [], '—'),
  abi('nec_038_maldicao_da_decadencia', 'Maldição da Decadência', 3, [], '—'),
  abi('nec_039_invocar_horda', 'Invocar Horda', 5, [], '—'),
  abi('nec_040_drenar_alma', 'Drenar Alma', 2, ['lifesteal'], '2 dmg LS', [{ type: 'DAMAGE', value: 2, target: 'ENEMY_GENERAL' }]),
  abi('nec_041_barreira_de_ossos', 'Barreira de Ossos', 3, ['divine_shield'], 'Imune'),
  abi('nec_042_tempestade_de_almas', 'Tempestade de Almas', 8, ['damage_all'], 'Dmg all'),
  abi('nec_043_punho_de_lich', 'Punho de Lich', 1, [], '—'),
  abi('nec_044_ritual_do_lich', 'Ritual do Lich', 7, [], '—'),
  abi('nec_045_esfera_da_putrefacao', 'Esfera da Putrefação', 4, [], '—'),
  abi('nec_046_lamento_dos_mortos', 'Lamento dos Mortos', 2, [], '—'),
  abi('nec_047_nevoeiro_sombrio', 'Nevoeiro Sombrio', 3, ['taunt'], 'Prov'),
  abi('nec_048_correntes_da_morte', 'Correntes da Morte', 4, [], '—'),
  abi('nec_049_toque_da_morte', 'Toque da Morte', 5, ['poison'], 'Poison'),
  abi('nec_050_fardo_do_pecado', 'Fardo do Pecado', 2, [], '—'),
  abi('nec_051_onda_de_trevas', 'Onda de Trevas', 6, [], '—'),
  abi('nec_052_corrupcao_espiritual', 'Corrupção Espiritual', 4, [], '—'),
  abi('nec_053_clamor_do_submundo', 'Clamor do Submundo', 1, [], '—'),
  abi('nec_054_veneno_etereo', 'Veneno Etéreo', 3, ['poison'], 'Poison'),
  abi('nec_055_despertar_dos_antigos', 'Despertar dos Antigos', 9, [], '—'),

  // ===== Artefatos — Equipamentos (5) =====
  eq('nec_056_cetro_do_lich', 'Cetro do Lich', 5, ['divine_shield'], 'Imune'),
  eq('nec_057_cajado_dos_condenados', 'Cajado dos Condenados', 5, [], '—'),
  eq('nec_058_faca_espectral', 'Faca Espectral', 3, ['stealth'], 'Stealth'),
  eq('nec_059_escudo_de_ossos', 'Escudo de Ossos', 3, ['taunt'], 'Prov'),
  eq('nec_060_mascara_mortuaria', 'Máscara Mortuária', 4, ['divine_shield'], 'Imune'),

  // ===== Artefatos — Relíquias / Itens (10, ABILITY) =====
  abi('nec_061_grimorio_da_morte', 'Grimório da Morte', 3, [], '—'),
  abi('nec_062_orbe_da_alma', 'Orbe da Alma', 4, [], '+1 card', drawN(1)),
  abi('nec_063_coroa_mortuaria', 'Coroa Mortuária', 6, [], '—'),
  abi('nec_064_amuleto_ossificado', 'Amuleto Ossificado', 2, ['regenerate'], 'Regen'),
  abi('nec_065_anel_da_necronomia', 'Anel da Necronomia', 2, [], '—'),
  abi('nec_066_estandarte_do_submundo', 'Estandarte do Submundo', 4, ['divine_shield'], 'Imune'),
  abi('nec_067_calice_corrompido', 'Cálice Corrompido', 3, [], '—'),
  abi('nec_068_simbolo_da_morte', 'Símbolo da Morte', 1, [], '—'),
  abi('nec_069_caixao_eterno', 'Caixão Eterno', 7, [], '—'),
  abi('nec_070_totem_do_abismo', 'Totem do Abismo', 5, [], '—')
] as unknown as Card[];
