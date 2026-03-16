"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHADOWLAND_COLLECTION = exports.SHADOWLAND_CARD_CATALOG = void 0;
const types_1 = require("../../shared/types");
const SHADOWLAND_COLLECTION_ID = 'shadowland_creatures';
const SHARED_SHADOWLAND_IMAGE = 'res://assets/cards/Orc/Chefe de Guerra.png';
const SHARED_SPELL_IMAGE = 'res://assets/cards/Ability/Massacre.png';
const SHARED_CONSUMABLE_IMAGE = 'res://assets/cards/consumable/Poção de Cura.png';
const SHARED_EQUIPMENT_IMAGE = 'res://assets/cards/equipment/Orc/Machado de Guerra.png';
function slug(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}
function rarityByCost(cost) {
    if (cost >= 7)
        return types_1.Rarity.LEGENDARY;
    if (cost >= 5)
        return types_1.Rarity.EPIC;
    if (cost >= 3)
        return types_1.Rarity.RARE;
    return types_1.Rarity.COMMON;
}
const defenderIdSeeds = [
    'Acólito da Noite Eterna',
    'Abominacao de Cinzas',
    'Arauto da Chama Negra',
    'Devorador de Juramentos',
    'Laminador de Almas',
    'Sombra do Sepulcro',
    'Profeta do Vazio Maldito',
    'Bruxo da Lua Morta',
    'Guardiao do Pacto Sombrio',
    'Carrasco de Sangue Frio',
    'Mastim do Inferno Velado',
    'Cultista da Coroa Rachada',
    'Sentinela do Portal Rubro',
    'Algoz do Abismo',
    'Incubador de Pesadelos',
    'Lorde da Cripta Velha',
    'Mercador de Pecados',
    'Servo da Garganta Profana',
    'Possesso da Chama Fria',
    'Espirito da Forja Infernal',
    'Ceifador do Selo Quebrado',
    'Flagelador de Ossos',
    'Predador da Escuridao',
    'Arauto do Eclipse Sangrento',
    'Demonio do Sussurro Fundo',
    'Vigia da Catedral Oca',
    'Andarilho da Carne Corrompida',
    'Executor do Pacto Carmesim',
    'Segador de Lagrimas',
    'Verme do Trono Obscuro',
    'Tormentor das Catacumbas',
    'Sanguinario de Velas Negras',
    'Zelote da Serpente de Cinza',
    'Rastreador do Nono Circulo',
    'Guardiao da Boca do Inferno',
    'Lacaio do Coracao Podre',
    'Profanador de Reliquias',
    'Capataz da Mina Macabra',
    'Espectro do Castelo Ruido',
    'Demolidor de Altares'
];
const defenderNames = [
    'Warlock da Noite Eterna',
    'Fantasma de Cinzas',
    'Bruxo da Chama Negra',
    'Devorador de Pactos',
    'Ceifador de Almas Perdidas',
    'Espectro do Sepulcro',
    'Profeta do Vazio Bruxo',
    'Bruxa da Lua Morta',
    'Guardiao do Circulo Profano',
    'Carrasco Fantasmal',
    'Mastim das Trevas',
    'Cultista do Trono Oco',
    'Sentinela do Portal Infernal',
    'Algoz do Abismo Sombrio',
    'Tecelador de Pesadelos',
    'Lorde da Cripta Negra',
    'Mercador de Maldicoes',
    'Servo da Garganta Profana',
    'Possesso da Chama Fria',
    'Espirito da Forja Maldita',
    'Ceifador do Selo Quebrado',
    'Flagelador de Ossos',
    'Predador da Escuridao',
    'Arauto do Eclipse Sangrento',
    'Demonio do Sussurro Profundo',
    'Vigia da Catedral Oca',
    'Andarilho da Carne Corrompida',
    'Executor do Pacto Carmesim',
    'Segador de Lagrimas',
    'Verme do Trono Obscuro',
    'Tormentor das Catacumbas',
    'Sanguinario de Velas Negras',
    'Zelote da Serpente Cinzenta',
    'Rastreador do Nono Circulo',
    'Guardiao da Boca do Inferno',
    'Lacaio do Coracao Podre',
    'Profanador de Reliquias',
    'Capataz da Mina Macabra',
    'Espectro do Castelo Ruinoso',
    'Demolidor de Altares'
];
const raceCycle = [types_1.Race.ORC, types_1.Race.DEVA, types_1.Race.ELF, types_1.Race.DWARF, types_1.Race.HUMAN];
const defenderAbilityCycle = [[], ['taunt'], ['lifesteal'], ['rush'], ['stealth']];
const defenders = defenderNames.map((name, idx) => {
    const cost = 2 + (idx % 6);
    const attack = Math.max(1, cost + (idx % 3) - 1);
    const defense = Math.max(2, cost + 2 + (idx % 2));
    return {
        id: `slc_mon_${slug(defenderIdSeeds[idx])}`,
        name,
        type: types_1.CardType.DEFENDER,
        race: raceCycle[idx % raceCycle.length],
        cost,
        attack,
        defense,
        abilities: defenderAbilityCycle[idx % defenderAbilityCycle.length],
        text: 'Criatura maligna invocada dos vales mais sombrios de Shadowland.',
        rarity: rarityByCost(cost),
        image_url: SHARED_SHADOWLAND_IMAGE
    };
});
const spellDefinitions = [
    { idSeed: 'Selo de Sangue Obsidiano', name: 'Sigilo do Bruxo Carmesim', type: 'DAMAGE', amount: 3, target: 'SINGLE_ENEMY' },
    { idSeed: 'Peste de Cinzas Vivas', name: 'Praga Fantasmal de Cinzas', type: 'DAMAGE_ALL', amount: 2, target: 'ALL_ENEMIES' },
    { idSeed: 'Juramento da Dor Eterna', name: 'Juramento da Dor Imortal', type: 'DAMAGE_GENERAL', amount: 3, target: 'ENEMY_GENERAL' },
    { idSeed: 'Voto da Adaga Maldita', name: 'Voto da Lamina Profana', type: 'BUFF_ATTACK', amount: 2, target: 'SINGLE_ALLY' },
    { idSeed: 'Manto de Ossos Negros', name: 'Manto de Ossos Bruxos', type: 'BUFF_DEFENSE', amount: 3, target: 'SINGLE_ALLY' },
    { idSeed: 'Ritual de Chifres e Sangue', name: 'Ritual de Sangue Warlock', type: 'BUFF_BOTH', amount: 1, target: 'SINGLE_ALLY' },
    { idSeed: 'Coro dos Condenados', name: 'Coro dos Fantasmas Condenados', type: 'BUFF_ALL', amount: 1, target: 'ALL_ALLIES' },
    { idSeed: 'Marca da Serpente Cega', name: 'Marca da Serpente Sombria', type: 'GRANT_ABILITY', ability: 'STEALTH', target: 'SINGLE_ALLY' },
    { idSeed: 'Mandato do Carrasco', name: 'Mandato do Ceifador Bruxo', type: 'DESTROY', target: 'SINGLE_ENEMY' },
    { idSeed: 'Sifao de Vitalidade', name: 'Sifao de Vida Espectral', type: 'HEAL', amount: 4, target: 'OWN_GENERAL' },
    { idSeed: 'Tributo do Pentagrama', name: 'Tributo do Pentagrama Negro', type: 'ADD_RESOURCES', amount: 2, target: 'SELF' },
    { idSeed: 'Correntes do Inferno Fundo', name: 'Correntes do Inferno Sombrio', type: 'DAMAGE', amount: 4, target: 'SINGLE_ENEMY' },
    { idSeed: 'Brasa do Pacto Antigo', name: 'Brasa do Pacto Necrotico', type: 'DAMAGE_GENERAL', amount: 2, target: 'ENEMY_GENERAL' },
    { idSeed: 'Absolvicao Profana', name: 'Absolvicao da Bruxa Negra', type: 'HEAL', amount: 3, target: 'SINGLE_ALLY' },
    { idSeed: 'Liturgia do Vazio', name: 'Liturgia do Vazio Warlock', type: 'BUFF_ATTACK', amount: 3, target: 'SINGLE_ALLY' },
    { idSeed: 'Uivo da Catedral Queimada', name: 'Uivo da Catedral Fantasma', type: 'DAMAGE_ALL_ENEMY', amount: 2, target: 'ALL_ENEMIES' },
    { idSeed: 'Coroa da Noite sem Fim', name: 'Coroa da Noite Maldita', type: 'BUFF_BOTH', amount: 2, target: 'SINGLE_ALLY' },
    { idSeed: 'Dizimo de Ferro e Enxofre', name: 'Dizimo de Enxofre Bruxo', type: 'ADD_RESOURCES', amount: 1, target: 'SELF' },
    { idSeed: 'Reza do Abismo Encarnado', name: 'Prece do Abismo Fantasma', type: 'GRANT_ABILITY', ability: 'LIFESTEAL', target: 'SINGLE_ALLY' },
    { idSeed: 'Litania da Carne Rasgada', name: 'Litania da Carne Profanada', type: 'DAMAGE', amount: 5, target: 'SINGLE_ENEMY' }
];
const shadowlandSpells = spellDefinitions.map((spell, idx) => {
    const isConsumable = spell.type === 'HEAL' || spell.type === 'ADD_RESOURCES';
    const cost = 2 + (idx % 5);
    const effect = {
        type: spell.type,
        amount: spell.amount ?? 0,
        target: spell.target,
        trigger: 'INSTANT',
        duration: 0
    };
    if (spell.ability) {
        effect.ability = spell.ability;
    }
    return {
        id: `slc_spl_${slug(spell.idSeed)}`,
        name: spell.name,
        type: isConsumable ? types_1.CardType.CONSUMABLE : types_1.CardType.ABILITY,
        race: null,
        cost,
        text: 'Feitico ritualistico proveniente dos grimorios de Shadowland.',
        rarity: rarityByCost(cost),
        effects: [effect],
        image_url: isConsumable ? SHARED_CONSUMABLE_IMAGE : SHARED_SPELL_IMAGE
    };
});
const equipmentIdSeeds = [
    'Lammina do Pacto Sombrio',
    'Adaga de Enxofre',
    'Coroa de Espinhos Ocultos',
    'Grimorio de Correntes',
    'Manto de Penitencia Macabra',
    'Anel do Nono Circulo',
    'Mascara do Devorador',
    'Manopla do Inferno Frio',
    'Bastao do Bruxo Carmesim',
    'Foco de Obsidiana Viva',
    'Armadura da Cripta',
    'Escudo da Liturgia Negra',
    'Capuz do Vigia do Vazio',
    'Sino da Ruina Silenciosa',
    'Insignia da Gargula Profana'
];
const equipmentNames = [
    'Lamina do Warlock Sombrio',
    'Adaga da Bruxa de Enxofre',
    'Coroa dos Fantasmas Espinhosos',
    'Grimorio de Correntes Profanas',
    'Manto de Penitencia Sombria',
    'Anel do Nono Circulo Bruxo',
    'Mascara do Devorador de Almas',
    'Manopla do Inferno Fantasma',
    'Bastao do Bruxo Carmesim',
    'Foco de Obsidiana Maldita',
    'Armadura da Cripta Profana',
    'Escudo da Liturgia Warlock',
    'Capuz do Vigia Espectral',
    'Sino da Ruina Fantasmal',
    'Insignia da Gargula das Trevas'
];
const shadowlandEquipments = equipmentNames.map((name, idx) => {
    const cost = 2 + (idx % 4);
    return {
        id: `slc_eqp_${slug(equipmentIdSeeds[idx])}`,
        name,
        type: types_1.CardType.EQUIPMENT,
        race: null,
        cost,
        attack: 1 + (idx % 3),
        defense: 1 + ((idx + 1) % 3),
        text: 'Relquia corrupta forjada para warlocks e demonios de Shadowland.',
        rarity: rarityByCost(cost),
        image_url: SHARED_EQUIPMENT_IMAGE
    };
});
function monsterImageByName(name) {
    return `res://assets/cards/Monster/${name}.png`;
}
const requestedShadowlandCreatures = [
    {
        id: 'slc_req_akelodon',
        name: 'Akelodon',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 6,
        attack: 6,
        defense: 10,
        abilities: ['taunt'],
        text: 'Possui Taunt.',
        rarity: types_1.Rarity.EPIC,
        image_url: monsterImageByName('Akelodon')
    },
    {
        id: 'slc_req_big_slime',
        name: 'Big Slime',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 5,
        attack: 2,
        defense: 20,
        text: 'Sempre que receber um ataque, invoca um Slime 1/1.',
        rarity: types_1.Rarity.LEGENDARY,
        image_url: monsterImageByName('Big Slime'),
        effects: [{ type: 'SUMMON', card_id: 'slc_req_slime', trigger: 'ON_DAMAGE', amount: 1, target: 'SELF' }]
    },
    {
        id: 'slc_req_bomber_bug',
        name: 'Bomber Bug',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 2,
        attack: 2,
        defense: 3,
        text: 'Ao morrer, causa 1 de dano a todas as cartas em campo.',
        rarity: types_1.Rarity.COMMON,
        image_url: monsterImageByName('Bomber Bug'),
        effects: [{ type: 'DAMAGE_ALL_BOARD', amount: 1, trigger: 'ON_DEATH', target: 'ALL_CREATURES' }]
    },
    {
        id: 'slc_req_crab',
        name: 'Crab',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 2,
        attack: 2,
        defense: 2,
        text: 'Criatura de Shadowland.',
        rarity: types_1.Rarity.COMMON,
        image_url: monsterImageByName('Crab')
    },
    {
        id: 'slc_req_dragonide',
        name: 'Dragonide',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 5,
        attack: 5,
        defense: 4,
        abilities: ['taunt'],
        text: 'Possui Taunt.',
        rarity: types_1.Rarity.EPIC,
        image_url: monsterImageByName('Dragonide')
    },
    {
        id: 'slc_req_fabio',
        name: 'Fabio',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.HUMAN,
        cost: 1,
        attack: 1,
        defense: 1,
        text: 'Duelista improvavel de Shadowland.',
        rarity: types_1.Rarity.COMMON,
        image_url: monsterImageByName('Fabio')
    },
    {
        id: 'slc_req_fishman',
        name: 'Fishman',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 1,
        attack: 1,
        defense: 2,
        text: 'Criatura anfibia de Shadowland.',
        rarity: types_1.Rarity.COMMON,
        image_url: monsterImageByName('Fishman')
    },
    {
        id: 'slc_req_giant_worm',
        name: 'Giant Worm',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 4,
        attack: 2,
        defense: 6,
        text: 'Ao atacar, joga uma moeda. Se cair cara, causa +2 dano poison na criatura atacada.',
        rarity: types_1.Rarity.RARE,
        image_url: monsterImageByName('Giant Worm'),
        effects: [{ type: 'COIN_POISON_BONUS', amount: 2, trigger: 'ON_ATTACK', target: 'ATTACK_TARGET' }]
    },
    {
        id: 'slc_req_giant_viper',
        name: 'Giant Viper',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 2,
        attack: 2,
        defense: 2,
        abilities: ['taunt'],
        text: 'Possui Taunt.',
        rarity: types_1.Rarity.COMMON,
        image_url: monsterImageByName('Giant Viper')
    },
    {
        id: 'slc_req_mountain_dragon',
        name: 'Mountain Dragon',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 5,
        attack: 6,
        defense: 10,
        text: 'Ao entrar em campo causa 2 de dano de fogo a uma criatura inimiga aleatoria.',
        rarity: types_1.Rarity.LEGENDARY,
        image_url: monsterImageByName('Mountain Dragon'),
        effects: [{ type: 'DAMAGE_RANDOM_ENEMY', amount: 2, trigger: 'ON_ENTER', target: 'SINGLE_ENEMY' }]
    },
    {
        id: 'slc_req_mushroom_monster',
        name: 'Mushroom Monster',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 3,
        attack: 2,
        defense: 4,
        text: 'Ao atacar, joga uma moeda. Se cair cara, causa +1 dano poison na criatura atacada.',
        rarity: types_1.Rarity.RARE,
        image_url: monsterImageByName('Mushroom Monster'),
        effects: [{ type: 'COIN_POISON_BONUS', amount: 1, trigger: 'ON_ATTACK', target: 'ATTACK_TARGET' }]
    },
    {
        id: 'slc_req_plant_monster',
        name: 'Plant Monster',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ELF,
        cost: 2,
        attack: 2,
        defense: 2,
        text: 'Criatura vegetal de Shadowland.',
        rarity: types_1.Rarity.COMMON,
        image_url: monsterImageByName('Plant Monster')
    },
    {
        id: 'slc_req_skeleton_archer',
        name: 'Skeleton Archer',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.HUMAN,
        cost: 2,
        attack: 3,
        defense: 1,
        text: 'Arqueiro morto-vivo de Shadowland.',
        rarity: types_1.Rarity.COMMON,
        image_url: monsterImageByName('Skeleton Archer')
    },
    {
        id: 'slc_req_skeleton_knight',
        name: 'Skeleton Knight',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.HUMAN,
        cost: 3,
        attack: 3,
        defense: 4,
        abilities: ['taunt'],
        text: 'Possui Taunt.',
        rarity: types_1.Rarity.RARE,
        image_url: monsterImageByName('Skeleton Knight')
    },
    {
        id: 'slc_req_skeleton_mage',
        name: 'Skeleton Mage',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.HUMAN,
        cost: 3,
        attack: 4,
        defense: 2,
        text: 'Ao entrar em campo causa 1 de dano de fogo a uma criatura inimiga aleatoria.',
        rarity: types_1.Rarity.RARE,
        image_url: monsterImageByName('Skeleton Mage'),
        effects: [{ type: 'DAMAGE_RANDOM_ENEMY', amount: 1, trigger: 'ON_ENTER', target: 'SINGLE_ENEMY' }]
    },
    {
        id: 'slc_req_skeleton',
        name: 'Skeleton',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.HUMAN,
        cost: 1,
        attack: 1,
        defense: 1,
        text: 'Morto-vivo basico de Shadowland.',
        rarity: types_1.Rarity.COMMON,
        image_url: monsterImageByName('Skeleton')
    },
    {
        id: 'slc_req_slime',
        name: 'Slime',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 1,
        attack: 1,
        defense: 1,
        text: 'Lodo vivo de Shadowland.',
        rarity: types_1.Rarity.COMMON,
        image_url: monsterImageByName('Slime')
    },
    {
        id: 'slc_req_soul_reaper',
        name: 'Soul Reaper',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 5,
        attack: 8,
        defense: 6,
        text: 'Ao atacar cura 2 de vida da propria carta e 2 de vida do general.',
        rarity: types_1.Rarity.LEGENDARY,
        image_url: monsterImageByName('Soul Reaper'),
        effects: [{ type: 'SELF_AND_GENERAL_HEAL_ON_ATTACK', amount: 2, trigger: 'ON_ATTACK', target: 'SELF' }]
    },
    {
        id: 'slc_req_troll',
        name: 'Troll',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 4,
        attack: 4,
        defense: 6,
        abilities: ['taunt'],
        text: 'Possui Taunt.',
        rarity: types_1.Rarity.RARE,
        image_url: monsterImageByName('Troll')
    },
    {
        id: 'slc_req_weranglerfish',
        name: 'Weranglerfish',
        type: types_1.CardType.DEFENDER,
        race: types_1.Race.ORC,
        cost: 2,
        attack: 2,
        defense: 2,
        text: 'Predador aquatico de Shadowland.',
        rarity: types_1.Rarity.COMMON,
        image_url: monsterImageByName('Weranglerfish')
    }
];
exports.SHADOWLAND_CARD_CATALOG = [
    ...defenders,
    ...shadowlandSpells,
    ...shadowlandEquipments,
    ...requestedShadowlandCreatures
];
if (exports.SHADOWLAND_CARD_CATALOG.length !== 95) {
    throw new Error(`Shadowland catalog must contain 95 cards, got ${exports.SHADOWLAND_CARD_CATALOG.length}`);
}
exports.SHADOWLAND_COLLECTION = {
    id: SHADOWLAND_COLLECTION_ID,
    name: 'Shadowland Creatures',
    description: 'Colecao sombria de criaturas warlock, demonios e reliquias malignas.'
};
//# sourceMappingURL=shadowland-card.catalog.js.map