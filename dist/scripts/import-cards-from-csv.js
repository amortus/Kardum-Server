"use strict";
/**
 * Script para importar cartas a partir de CSV exportado da planilha.
 * Uso: npx ts-node src/scripts/import-cards-from-csv.ts [caminho/cartas.csv]
 *      npm run import-cards -- cartas_planilha.csv
 *      npm run import-cards -- generais.csv cartas.csv
 * Ou: CARDS_CSV=./cartas.csv npm run import-cards
 *     CARDS_CSV=generais.csv,cartas.csv npm run import-cards
 *
 * Cabeçalhos aceitos (inglês ou português):
 * id, name/nome, type/tipo, cost/custo, race/raça, class/classe, attack/ataque,
 * defense/defesa, text/texto/descrição, abilities/habilidades, rarity/raridade,
 * hero_power_text/poder_heroi, hero_power_cost/custo_poder
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../config/database");
const card_repository_1 = __importDefault(require("../modules/cards/card.repository"));
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        }
        else if (c === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        }
        else {
            current += c;
        }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
}
function parseAbilities(value) {
    if (!value || !value.trim())
        return [];
    const v = value.trim();
    if (v.startsWith('[')) {
        try {
            const arr = JSON.parse(v);
            return Array.isArray(arr) ? arr.map((a) => String(a)) : [];
        }
        catch {
            return [];
        }
    }
    return v.split(',').map((s) => s.trim()).filter(Boolean);
}
function parseOptionalInt(value) {
    if (value === undefined || value === null || value === '')
        return null;
    const n = parseInt(String(value).trim(), 10);
    return isNaN(n) ? null : n;
}
const HEADER_ALIASES = {
    id: 'id',
    name: 'name',
    nome: 'name',
    type: 'type',
    tipo: 'type',
    cost: 'cost',
    custo: 'cost',
    race: 'race',
    raça: 'race',
    raca: 'race',
    class: 'class',
    classe: 'class',
    attack: 'attack',
    ataque: 'attack',
    defense: 'defense',
    defesa: 'defense',
    text: 'text',
    texto: 'text',
    descrição: 'text',
    descricao: 'text',
    abilities: 'abilities',
    habilidades: 'abilities',
    rarity: 'rarity',
    raridade: 'rarity',
    hero_power_text: 'hero_power_text',
    poder_heroi: 'hero_power_text',
    hero_power_cost: 'hero_power_cost',
    custo_poder: 'hero_power_cost'
};
function normalizeHeader(raw) {
    const key = raw.toLowerCase().trim().replace(/\s+/g, '_').replace(/[áàãâ]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i').replace(/[óôõ]/g, 'o').replace(/[ú]/g, 'u').replace(/ç/g, 'c');
    return HEADER_ALIASES[key] ?? key;
}
async function processOneCSV(absolutePath, existingIds, stats) {
    const content = fs_1.default.readFileSync(absolutePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
        console.warn(`  ⚠ ${absolutePath}: cabeçalho e ao menos uma linha necessários.`);
        return;
    }
    const rawHeaders = parseCSVLine(lines[0]);
    const header = rawHeaders.map((h) => normalizeHeader(h));
    const idCol = header.indexOf('id');
    const nameCol = header.indexOf('name');
    const typeCol = header.indexOf('type');
    const costCol = header.indexOf('cost');
    if (idCol === -1 || nameCol === -1 || typeCol === -1 || costCol === -1) {
        console.error(`  ❌ ${absolutePath}: cabeçalho deve ter id, name/nome, type/tipo, cost/custo. Encontrado:`, rawHeaders.join(', '));
        return;
    }
    const raceCol = header.indexOf('race');
    const classCol = header.indexOf('class');
    const attackCol = header.indexOf('attack');
    const defenseCol = header.indexOf('defense');
    const textCol = header.indexOf('text');
    const abilitiesCol = header.indexOf('abilities');
    const rarityCol = header.indexOf('rarity');
    const heroPowerTextCol = header.indexOf('hero_power_text');
    const heroPowerCostCol = header.indexOf('hero_power_cost');
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        while (values.length < header.length)
            values.push('');
        const get = (col) => (col >= 0 && col < values.length ? values[col].trim() : '');
        const id = get(idCol);
        const name = get(nameCol);
        const type = get(typeCol);
        const costStr = get(costCol);
        if (!id || !name || !type) {
            console.warn(`  ⏭️ ${path_1.default.basename(absolutePath)} linha ${i + 1}: ignorada (id/name/type vazios).`);
            stats.skipped++;
            continue;
        }
        const cost = parseOptionalInt(costStr) ?? 0;
        if (existingIds.has(id)) {
            console.log(`  ⏭️ Já existe: ${name} (${id})`);
            stats.skipped++;
            continue;
        }
        const cardData = {
            id,
            name,
            type: type.toLowerCase(),
            race: raceCol >= 0 ? get(raceCol) || null : null,
            class: classCol >= 0 ? get(classCol) || undefined : undefined,
            cost,
            attack: attackCol >= 0 ? parseOptionalInt(get(attackCol)) ?? undefined : undefined,
            defense: defenseCol >= 0 ? parseOptionalInt(get(defenseCol)) ?? undefined : undefined,
            text: textCol >= 0 ? get(textCol) : '',
            abilities: abilitiesCol >= 0 ? parseAbilities(get(abilitiesCol)) : [],
            rarity: (rarityCol >= 0 ? get(rarityCol) : 'common') || 'common',
            image_url: undefined,
            effect: undefined
        };
        if (heroPowerTextCol >= 0)
            cardData.hero_power_text = get(heroPowerTextCol) || undefined;
        if (heroPowerCostCol >= 0) {
            const hpCost = parseOptionalInt(get(heroPowerCostCol));
            cardData.hero_power_cost = hpCost ?? undefined;
        }
        try {
            await card_repository_1.default.createCard(cardData);
            console.log(`  ✅ Inserida: ${name} (${id})`);
            stats.inserted++;
            existingIds.add(id);
        }
        catch (err) {
            console.error(`  ❌ Erro ao inserir ${id}:`, err.message);
            stats.skipped++;
        }
    }
}
async function importCardsFromCSV() {
    const csvInput = process.env.CARDS_CSV || process.argv.slice(2).join(',');
    if (!csvInput.trim()) {
        console.error('Uso: npx ts-node src/scripts/import-cards-from-csv.ts <caminho/cartas.csv>');
        console.error('     npm run import-cards -- cartas_planilha.csv');
        console.error('     npm run import-cards -- generais.csv cartas.csv');
        console.error('Ou defina CARDS_CSV=caminho/para/cartas.csv ou arquivo1.csv,arquivo2.csv');
        process.exit(1);
    }
    const csvPaths = csvInput.split(',').map((p) => p.trim()).filter(Boolean);
    const cwd = process.cwd();
    const absolutePaths = csvPaths.map((p) => (path_1.default.isAbsolute(p) ? p : path_1.default.join(cwd, p)));
    const missing = absolutePaths.filter((p) => !fs_1.default.existsSync(p));
    if (missing.length > 0) {
        console.error('Arquivo(s) não encontrado(s):', missing.join(', '));
        process.exit(1);
    }
    try {
        console.log('🔄 Inicializando banco...');
        await (0, database_1.initializeDatabase)();
        const existingCards = await card_repository_1.default.getAllCards();
        const existingIds = new Set(existingCards.map((c) => c.id));
        const stats = { inserted: 0, skipped: 0 };
        for (const absolutePath of absolutePaths) {
            console.log('\n📄 Processando:', absolutePath);
            await processOneCSV(absolutePath, existingIds, stats);
        }
        console.log(`
╔════════════════════════════════════════════╗
║   Importação CSV concluída                 ║
║   ✅ Inseridas: ${String(stats.inserted).padEnd(28)}║
║   ⏭️ Ignoradas/já existentes: ${String(stats.skipped).padEnd(18)}║
╚════════════════════════════════════════════╝
    `);
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Falha na importação:', error.message);
        process.exit(1);
    }
}
importCardsFromCSV();
//# sourceMappingURL=import-cards-from-csv.js.map