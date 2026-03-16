"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONSTER_CARD_CATALOG = void 0;
const types_1 = require("../../shared/types");
const defenderIdSeeds = {
    human: ['Campeão do Reino', 'Paladino Sagrado', 'Clérigo Curador', 'Cavaleiro Real', 'Lanceiro Veterano', 'Recruta da Guarda', 'Guardião da Muralha'],
    elf: ['Arqueiro Florestal', 'Espírito do Bosque', 'Curador da Floresta', 'Sentinela Élfico', 'Mestre Arqueiro', 'Caçador das Sombras', 'Guardião da Natureza', 'Ancião Druida'],
    orc: ['Xamã Orc', 'Titã de Ferro', 'Lobo das Sombras', 'Chefe de Guerra', 'Saqueador Brutal', 'Berserker', 'Guerreiro Orc'],
    deva: ['Bruxa Escarlate', 'Vingador Devas', 'Arqueiro das Sombras', 'Guerreiro Devas', 'Devas Protetor Divino', 'Arcanjo Vingador', 'Guerreiro Alado'],
    dwarf: ['Golem de Pedra', 'Atirador de Elite', 'Rei da Montanha', 'Mestre Ferreiro', 'Quebra-Pedras', 'Guardião das Minas']
};
const monsterNamesByRace = {
    human: [
        { name: 'Vipera Colossal', imageName: 'Giant Viper' },
        { name: 'Mago Sombrio', imageName: 'Dark Mage' },
        { name: 'Ceifador de Almas', imageName: 'Soul Reaper' },
        { name: 'Executor Maldito', imageName: 'Executioner' },
        { name: 'Troll de Cripta', imageName: 'Troll' },
        { name: 'Mumia Profanada', imageName: 'Mummy' },
        { name: 'Aranha Abissal', imageName: 'Weranglerfish' }
    ],
    elf: [
        { name: 'Ent Raiz Profunda', imageName: 'Oak Tree Ent' },
        { name: 'Monstro de Musgo', imageName: 'Plant Monster' },
        { name: 'Monstro Cogumelo', imageName: 'Mushroom Monster' },
        { name: 'Verme Voraz', imageName: 'Giat Worm' },
        { name: 'Slime Titânico', imageName: 'Big Slime' },
        { name: 'Lodo Mutante', imageName: 'Slime' },
        { name: 'Akelodon Enfurecido', imageName: 'Akelodon' },
        { name: 'Pescador Abissal', imageName: 'Weranglerfish' }
    ],
    orc: [
        { name: 'Homem-Peixe Carniceiro', imageName: 'Fish Man' },
        { name: 'Caranguejo Devorador', imageName: 'Werecrab' },
        { name: 'Inseto Bombardeiro', imageName: 'Bomber Bug' },
        { name: 'Esqueleto Corrompido', imageName: 'Skeleton' },
        { name: 'Arqueiro Esquelético', imageName: 'Skeleton Archer' },
        { name: 'Assassino Esquelético', imageName: 'Skeleton Assassin' },
        { name: 'Cavaleiro Esquelético', imageName: 'Skeleton Knight' }
    ],
    deva: [
        { name: 'Mago Congelado', imageName: 'Cold Mage' },
        { name: 'Mago do Gelo', imageName: 'Frost Mage' },
        { name: 'Mago Azul', imageName: 'Blue Mage' },
        { name: 'Mago Insano', imageName: 'Crazy Magician' },
        { name: 'Arquimago Profano', imageName: 'Master Magician' },
        { name: 'Mago Esquelético', imageName: 'Skeleton Mage' },
        { name: 'Draconídeo Infernal', imageName: 'Dragonide' }
    ],
    dwarf: [
        { name: 'Dragão da Montanha', imageName: 'Mountain Dragon' },
        { name: 'Lorde das Brasas', imageName: 'fire tentacle' },
        { name: 'Serpente Ígnea', imageName: 'fireball' },
        { name: 'Adepto da Runa Negra', imageName: 'Dark Rune' },
        { name: 'Arauto da Runa Sangrenta', imageName: 'Blood Rune' },
        { name: 'Arauto da Runa Elétrica', imageName: 'Lighting Rune' }
    ]
};
const spellIdSeeds = [
    'Bola de Fogo', 'Massacre', 'Chamado da Floresta', 'Flecha Perfurante', 'Explosão de Gelo',
    'Fúria Incontrolável', 'Grito de Guerra', 'Golpe Heroico', 'Inspirar Tropas', 'Rajada de Flechas',
    'Regeneração Natural', 'Luz Curativa', 'Chuva de Flechas', 'Poção de Cura', 'Bênção Divina',
    'Escudo Místico', 'Poção de Cura Menor'
];
const spells = [
    { name: 'Bola de Fogo Abissal', imageName: 'fireball' },
    { name: 'Massacre Necrótico', imageName: 'Blood Rune' },
    { name: 'Invocação de Lodo', imageName: 'Big Slime' },
    { name: 'Flecha da Cripta', imageName: 'Skeleton Archer' },
    { name: 'Explosão Glacial', imageName: 'Elemental flow, like a blue spell' },
    { name: 'Fúria do Troll', imageName: 'Troll' },
    { name: 'Brado do Carniceiro', imageName: 'Fish Man' },
    { name: 'Golpe do Executor', imageName: 'Executioner' },
    { name: 'Chamado dos Mortos', imageName: 'Skeleton' },
    { name: 'Rajada Tempestuosa', imageName: 'blue thunder, like a magician spell' },
    { name: 'Regeneração Fúngica', imageName: 'Mushroom Monster' },
    { name: 'Sifão de Almas', imageName: 'Soul Reaper' },
    { name: 'Nuvem Tóxica', imageName: 'Plant Monster' },
    { name: 'Poção da Cripta', imageName: 'Mummy' },
    { name: 'Bênção Profana', imageName: 'Dark Rune' },
    { name: 'Aegis da Ossada', imageName: 'Skeleton Knight' },
    { name: 'Soro Mutagênico', imageName: 'Slime' }
];
const equipmentIdSeeds = [
    'Excalibur', 'Escudo Real', 'Martelo Runico', 'Armadura de Mithril',
    'Arco Élfico', 'Lâmina das Folhas', 'Machado de Guerra', 'Armadura de Couro',
    'Lança Sagrada', 'Armadura Celestial', 'Manto da Floresta', 'Espada Larga'
];
const equipments = [
    { name: 'Gume do Carniceiro', imageName: 'Executioner' },
    { name: 'Couraça Esquelética', imageName: 'Skeleton Knight' },
    { name: 'Totem do Verme', imageName: 'Giat Worm' },
    { name: 'Carapaça de Werecrab', imageName: 'Werecrab' },
    { name: 'Insígnia Draconídea', imageName: 'Dragonide' },
    { name: 'Lâmina do Reaper', imageName: 'Soul Reaper' },
    { name: 'Arpéu de Pescador', imageName: 'Weranglerfish' },
    { name: 'Escama de Akelodon', imageName: 'Akelodon' },
    { name: 'Foco da Tempestade Azul', imageName: 'blue thunder, like a magician spell' },
    { name: 'Orbe da Geada', imageName: 'Frost Mage' },
    { name: 'Totem do Ent', imageName: 'Oak Tree Ent' },
    { name: 'Runa de Sangue', imageName: 'Blood Rune' }
];
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
const defenders = Object.entries(monsterNamesByRace).flatMap(([raceKey, entries]) => entries.map((entry, idx) => {
    const cost = 2 + (idx % 6);
    const attack = Math.max(1, cost + (idx % 2));
    const defense = Math.max(2, cost + 2 + (idx % 3));
    const race = raceKey;
    const idSeed = defenderIdSeeds[raceKey][idx];
    return {
        id: `m1_mon_${slug(idSeed)}`,
        name: entry.name,
        type: types_1.CardType.DEFENDER,
        race: types_1.Race[race.toUpperCase()],
        cost,
        attack,
        defense,
        abilities: idx % 5 === 0 ? ['taunt'] : idx % 6 === 0 ? ['rush'] : [],
        text: `Unidade monstruosa: ${entry.name}.`,
        rarity: rarityByCost(cost),
        image_url: `res://assets/cards/Monster/${entry.imageName}.png`
    };
}));
const abilityCards = spells.map((spell, idx) => {
    const isHeal = spell.name.includes('Poção') || spell.name.includes('Bênção') || spell.name.includes('Aegis') || spell.name.includes('Regeneração') || spell.name.includes('Soro');
    const effect = isHeal
        ? { type: 'HEAL', amount: 2 + (idx % 4), target: 'OWN_GENERAL', trigger: 'INSTANT', duration: 0 }
        : { type: 'DAMAGE', amount: 2 + (idx % 4), target: 'SINGLE_ENEMY', trigger: 'INSTANT', duration: 0 };
    const type = isHeal ? types_1.CardType.CONSUMABLE : types_1.CardType.ABILITY;
    const cost = 1 + (idx % 5);
    return {
        id: `m1_spl_${slug(spellIdSeeds[idx])}`,
        name: spell.name,
        type,
        race: null,
        cost,
        text: `Feitiço monstruoso: ${spell.name}.`,
        rarity: rarityByCost(cost),
        effects: [effect],
        image_url: `res://assets/cards/Monster/${spell.imageName}.png`
    };
});
const equipmentCards = equipments.map((item, idx) => ({
    id: `m1_eqp_${slug(equipmentIdSeeds[idx])}`,
    name: item.name,
    type: types_1.CardType.EQUIPMENT,
    race: null,
    cost: 2 + (idx % 4),
    attack: 1 + (idx % 3),
    defense: idx % 2 === 0 ? 2 : 1,
    text: `Artefato de monstro: ${item.name}.`,
    rarity: rarityByCost(2 + (idx % 4)),
    image_url: `res://assets/cards/Monster/${item.imageName}.png`
}));
exports.MONSTER_CARD_CATALOG = [
    ...defenders,
    ...abilityCards,
    ...equipmentCards,
    // cartas extras para garantir 60+
    {
        id: 'm1_spl_tormenta_arcana',
        name: 'Tormenta Necromântica',
        type: types_1.CardType.ABILITY,
        race: null,
        cost: 5,
        text: 'Causa 2 de dano a todos os inimigos.',
        rarity: types_1.Rarity.EPIC,
        effects: [{ type: 'DAMAGE_ALL', amount: 2, target: 'ALL_ENEMIES', trigger: 'INSTANT', duration: 0 }],
        image_url: 'res://assets/cards/Monster/blue thunder, like a magician spell.png'
    },
    {
        id: 'm1_spl_aegis_da_aurora',
        name: 'Aegis do Ossário',
        type: types_1.CardType.CONSUMABLE,
        race: null,
        cost: 4,
        text: 'Concede Divine Shield a um aliado.',
        rarity: types_1.Rarity.EPIC,
        effects: [{ type: 'GRANT_ABILITY', ability: 'DIVINE_SHIELD', target: 'SINGLE_ALLY', trigger: 'INSTANT', duration: 0 }],
        image_url: 'res://assets/cards/Monster/Skeleton Knight.png'
    },
    {
        id: 'm1_eqp_runa_do_anciao',
        name: 'Runa do Necrolorde',
        type: types_1.CardType.EQUIPMENT,
        race: null,
        cost: 3,
        attack: 2,
        defense: 2,
        text: 'Artefato místico ancestral.',
        rarity: types_1.Rarity.RARE,
        image_url: 'res://assets/cards/Monster/Dark Rune.png'
    }
];
//# sourceMappingURL=monster-card.catalog.js.map