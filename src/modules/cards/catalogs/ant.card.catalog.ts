import type { Card } from '../../../shared/types';

export const ANT_COLLECTION = {
  id: 'ant',
  name: 'Formigas',
  description: 'A Colônia Eterna — Formigas'
};

const COLLECTION_ID = 'ant';

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
  race: 'ant',
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
const dmgN = (n: number): EffectIn[] => [{ type: 'DAMAGE', value: n, target: 'ENEMY_GENERAL' }];

export const ANT_CARD_CATALOG = [
  // ===== Monstros de Efeito (20) =====
  def('ant_001_rainha_myrmex_a_matriarca', 'Rainha Myrmex, a Matriarca', 7, 2, 7, ['divine_shield', 'buff_all'], 'Imune. +1/+1 all'),
  def('ant_002_general_mandibula_de_aco', 'General Mandíbula de Aço', 5, 4, 4, [], '—'),
  def('ant_003_operaria_de_tunel', 'Operária de Túnel', 1, 1, 1, [], '—'),
  def('ant_004_batedora_alada', 'Batedora Alada', 3, 2, 1, [], '+1 card', drawN(1)),
  def('ant_005_guardia_do_feromonio', 'Guardiã do Feromônio', 4, 2, 4, [], '—'),
  def('ant_006_atropeladora_de_serrapilheira', 'Atropeladora de Serrapilheira', 4, 3, 3, ['rush'], 'Ini'),
  def('ant_007_xama_da_seiva', 'Xamã da Seiva', 2, 1, 2, ['lifesteal'], 'Lifesteal'),
  def('ant_008_formiga_leao_infiltrada', 'Formiga-Leão Infiltrada', 3, 3, 2, ['poison', 'stealth'], 'Poison Stealth'),
  def('ant_009_engenheira_de_fungos', 'Engenheira de Fungos', 3, 1, 4, [], '—'),
  def('ant_010_tanque_exosqueleto', 'Tanque Exosqueleto', 6, 2, 8, ['taunt'], 'Prov'),
  def('ant_011_portadora_de_toxina', 'Portadora de Toxina', 2, 2, 1, ['poison'], 'Poison'),
  def('ant_012_clonadora_de_larvas', 'Clonadora de Larvas', 4, 1, 3, [], '—'),
  def('ant_013_comandante_da_vanguarda', 'Comandante da Vanguarda', 5, 3, 3, ['buff_all'], '+1/+1 all'),
  def('ant_014_formiga_cortadeira_gigante', 'Formiga Cortadeira Gigante', 4, 4, 2, [], '—'),
  def('ant_015_sifao_de_melada', 'Sifão de Melada', 2, 1, 1, [], '—'),
  def('ant_016_sentinela_de_acido', 'Sentinela de Ácido', 3, 2, 2, [], '1 dmg', dmgN(1)),
  def('ant_017_arquivista_de_feromonios', 'Arquivista de Feromônios', 3, 1, 3, [], '—'),
  def('ant_018_sabotadora_de_alicerces', 'Sabotadora de Alicerces', 2, 2, 1, [], '—'),
  def('ant_019_mestre_de_tuneis_rapidos', 'Mestre de Túneis Rápidos', 4, 3, 2, ['rush'], 'Ini'),
  def('ant_020_avatar_do_formigueiro', 'Avatar do Formigueiro', 8, 6, 6, [], '—'),

  // ===== Monstros Normais (15) =====
  def('ant_021_operaria_comum', 'Operária Comum', 1, 1, 1, [], '—'),
  def('ant_022_soldado_da_patrulha', 'Soldado da Patrulha', 2, 2, 2, [], '—'),
  def('ant_023_carregadora_de_carga', 'Carregadora de Carga', 3, 1, 4, [], '—'),
  def('ant_024_lutadora_de_fenda', 'Lutadora de Fenda', 2, 3, 1, [], '—'),
  def('ant_025_exploradora_de_superficie', 'Exploradora de Superfície', 2, 2, 1, [], '—'),
  def('ant_026_guarda_de_elite_da_rainha', 'Guarda de Elite da Rainha', 4, 4, 4, [], '—'),
  def('ant_027_escavadora_de_profundezas', 'Escavadora de Profundezas', 3, 2, 3, [], '—'),
  def('ant_028_formiga_de_fogo_errante', 'Formiga de Fogo Errante', 1, 2, 1, [], '—'),
  def('ant_029_carpinteira_do_tronco', 'Carpinteira do Tronco', 4, 3, 3, [], '—'),
  def('ant_030_vanguardista_das_folhas', 'Vanguardista das Folhas', 3, 3, 2, [], '—'),
  def('ant_031_drona_de_defesa', 'Drona de Defesa', 2, 1, 3, [], '—'),
  def('ant_032_buscadora_de_mel', 'Buscadora de Mel', 1, 1, 2, [], '—'),
  def('ant_033_guerreira_de_mandibula_larga', 'Guerreira de Mandíbula Larga', 5, 5, 4, [], '—'),
  def('ant_034_operaria_noturna', 'Operária Noturna', 2, 2, 2, [], '—'),
  def('ant_035_veterana_da_grande_guerra', 'Veterana da Grande Guerra', 4, 4, 3, [], '—'),

  // ===== Magias (20) =====
  abi('ant_036_trilha_de_feromonio', 'Trilha de Feromônio', 1, [], '—'),
  abi('ant_037_ataque_em_enxame', 'Ataque em Enxame', 3, [], '—'),
  abi('ant_038_expansao_do_formigueiro', 'Expansão do Formigueiro', 4, ['buff_all'], '+1/+1 all'),
  abi('ant_039_sacrificio_pela_rainha', 'Sacrifício pela Rainha', 2, ['divine_shield'], 'Imune'),
  abi('ant_040_estocagem_de_inverno', 'Estocagem de Inverno', 3, [], '+2 card', drawN(2)),
  abi('ant_041_colapso_de_tunel', 'Colapso de Túnel', 4, [], '—'),
  abi('ant_042_frenesi_do_enxame', 'Frenesi do Enxame', 2, ['rush'], 'Ini'),
  abi('ant_043_metamorfose_acelerada', 'Metamorfose Acelerada', 5, [], '—'),
  abi('ant_044_chuva_de_acido_formico', 'Chuva de Ácido Fórmico', 6, ['damage_all'], 'Dmg all'),
  abi('ant_045_uniao_quimotatica', 'União Quimotática', 2, ['lifesteal'], 'Lifesteal'),
  abi('ant_046_escavacao_coletiva', 'Escavação Coletiva', 2, [], '—'),
  abi('ant_047_panico_quimico', 'Pânico Químico', 3, [], '—'),
  abi('ant_048_nectar_da_vida', 'Néctar da Vida', 1, [], '—'),
  abi('ant_049_sinal_de_alerta', 'Sinal de Alerta', 2, [], '—'),
  abi('ant_050_guerra_de_castas', 'Guerra de Castas', 4, ['damage_all'], 'Dmg all'),
  abi('ant_051_jardim_de_fungos', 'Jardim de Fungos', 3, ['regenerate'], 'Regen'),
  abi('ant_052_voo_nupcial', 'Voo nupcial', 5, [], '—'),
  abi('ant_053_mandibulas_de_ferro', 'Mandíbulas de Ferro', 2, [], '—'),
  abi('ant_054_enterro_vivo', 'Enterro Vivo', 4, [], '—'),
  abi('ant_055_legado_da_matriarca', 'Legado da Matriarca', 5, [], '—'),

  // ===== Artefatos — Equipamentos (5) =====
  eq('ant_056_couraca_de_quitina', 'Couraça de Quitina', 2, [], '—'),
  eq('ant_057_pincas_serrilhadas', 'Pinças Serrilhadas', 3, ['poison'], 'Poison'),
  eq('ant_058_antenas_sensoriais', 'Antenas Sensoriais', 2, ['divine_shield'], 'Imune'),
  eq('ant_059_ferrao_de_vespa_caida', 'Ferrão de Vespa Caída', 2, [], '—'),
  eq('ant_060_manto_de_camuflagem_de_folhas', 'Manto de Camuflagem de Folhas', 2, ['stealth'], 'Stealth'),

  // ===== Artefatos — Relíquias / Itens (10, ABILITY) =====
  abi('ant_061_glandula_de_acido', 'Glândula de Ácido', 4, [], '2 dmg', [{ type: 'DAMAGE', value: 2, target: 'ENEMY_GENERAL' }]),
  abi('ant_062_estandarte_do_formigueiro', 'Estandarte do Formigueiro', 3, ['buff_all'], '+1/+1 all'),
  abi('ant_063_sementes_de_armazenamento', 'Sementes de Armazenamento', 1, [], '—'),
  abi('ant_064_fungo_nutritivo', 'Fungo Nutritivo', 3, [], '+1 card', drawN(1)),
  abi('ant_065_tunel_de_fuga', 'Túnel de Fuga', 4, ['stealth'], 'Stealth'),
  abi('ant_066_idolo_de_barro_da_rainha', 'Ídolo de Barro da Rainha', 5, [], '—'),
  abi('ant_067_tambores_de_terra', 'Tambores de Terra', 3, [], '—'),
  abi('ant_068_cristal_de_resina', 'Cristal de Resina', 4, [], '—'),
  abi('ant_069_grande_bigorna_de_quitina', 'Grande Bigorna de Quitina', 6, [], '—'),
  abi('ant_070_calice_de_melada_real', 'Cálice de Melada Real', 5, ['buff_all'], '+1/+1 all')
] as unknown as Card[];
