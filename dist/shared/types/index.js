"use strict";
// Tipos compartilhados do Kardum TCG
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamePhase = exports.PlayerRank = exports.Rarity = exports.Ability = exports.Class = exports.Race = exports.CardType = void 0;
var CardType;
(function (CardType) {
    CardType["GENERAL"] = "general";
    CardType["DEFENDER"] = "defender";
    CardType["EQUIPMENT"] = "equipment";
    CardType["MOUNT"] = "mount";
    CardType["CONSUMABLE"] = "consumable";
    CardType["ABILITY"] = "ability";
})(CardType || (exports.CardType = CardType = {}));
var Race;
(function (Race) {
    Race["HUMAN"] = "human";
    Race["DEVA"] = "deva";
    Race["ORC"] = "orc";
    Race["DWARF"] = "dwarf";
    Race["ELF"] = "elf";
})(Race || (exports.Race = Race = {}));
var Class;
(function (Class) {
    Class["WARRIOR"] = "warrior";
    Class["BARBARIAN"] = "barbarian";
    Class["DRUID"] = "druid";
    Class["ELEMENTALIST"] = "elementalist";
    Class["NECROMANCER"] = "necromancer";
    Class["ARCHER"] = "archer";
    Class["ASSASSIN"] = "assassin";
    Class["CHIVALRY"] = "chivalry";
})(Class || (exports.Class = Class = {}));
var Ability;
(function (Ability) {
    Ability["RUSH"] = "rush";
    Ability["TAUNT"] = "taunt";
    Ability["DIVINE_SHIELD"] = "divine_shield";
    Ability["LIFESTEAL"] = "lifesteal";
    Ability["CHARGE"] = "charge";
    Ability["DRAW_CARD"] = "draw_card";
    Ability["BUFF_ALL"] = "buff_all";
    Ability["DAMAGE_ALL"] = "damage_all";
    Ability["STEALTH"] = "stealth";
    Ability["REGENERATE"] = "regenerate";
    Ability["POISON"] = "poison";
})(Ability || (exports.Ability = Ability = {}));
var Rarity;
(function (Rarity) {
    Rarity["COMMON"] = "common";
    Rarity["RARE"] = "rare";
    Rarity["EPIC"] = "epic";
    Rarity["LEGENDARY"] = "legendary";
})(Rarity || (exports.Rarity = Rarity = {}));
var PlayerRank;
(function (PlayerRank) {
    PlayerRank["UNRANKED"] = "unranked";
    PlayerRank["BRONZE"] = "bronze";
    PlayerRank["SILVER"] = "silver";
    PlayerRank["GOLD"] = "gold";
    PlayerRank["PLATINUM"] = "platinum";
    PlayerRank["DIAMOND"] = "diamond";
    PlayerRank["GRANDMASTER"] = "grandmaster";
})(PlayerRank || (exports.PlayerRank = PlayerRank = {}));
var GamePhase;
(function (GamePhase) {
    GamePhase["DRAW"] = "draw";
    GamePhase["STRATEGY"] = "strategy";
    GamePhase["COMBAT"] = "combat";
    GamePhase["END"] = "end";
})(GamePhase || (exports.GamePhase = GamePhase = {}));
//# sourceMappingURL=index.js.map