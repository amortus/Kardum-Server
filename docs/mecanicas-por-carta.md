# Mecânicas por carta (Kardum TCG)

Este documento lista as mecânicas de cartas e de Generais para referência e implementação. Preencha conforme a planilha/CSV for analisada.

## Habilidades já implementadas (servidor + Godot)

| Habilidade   | Descrição resumida                    | Onde está |
|-------------|---------------------------------------|-----------|
| TAUNT       | Deve ser atacado antes de outros alvos| ai_game_simulator, combat_controller, ícones |
| DIVINE_SHIELD| Primeiro dano ignorado               | ai_game_simulator, ícones |
| RUSH        | Pode atacar no turno em que entra    | ai_game_simulator, ícones |
| LIFESTEAL   | Dano causado cura o General          | ai_game_simulator, ícones |
| CHARGE      | Tratado como RUSH no cliente         | card_renderer |

## Habilidades definidas no servidor (enum) ainda sem regra de jogo

- DRAW_CARD, BUFF_ALL, DAMAGE_ALL, STEALTH, REGENERATE

## General – Poder de herói (hero power)

- **Modelo:** Campos na carta tipo GENERAL: `hero_power_text`, `hero_power_cost`, `hero_power_effect` (JSON), `passive_effect` (JSON).
- **Godot:** Botão "Poder do General" na batalha; custo e texto vêm do General; uso em modo IA chama `AIGameSimulator.use_hero_power()`.
- **Efeito exemplo:** `hero_power_effect: { "type": "heal", "amount": 2 }` → cura 2 de vida do General (implementado no simulador de IA).

## Mecânicas novas a implementar (a preencher com a planilha)

Quando a planilha for analisada, liste aqui cada efeito descrito no texto das cartas que ainda não for regra de jogo:

| Carta (nome ou ID) | Texto/descrição | Mecânica sugerida | Prioridade |
|--------------------|-----------------|-------------------|------------|
| (exemplo)          | "Quando morre, compra 1 carta" | on_death: draw_card | Alta |
|                    |                                 |                    |            |

## Como adicionar novas mecânicas

1. **Servidor:** Estender `CardEffect` ou adicionar campos em `effects` (JSON) na tabela `cards`; implementar resolução em `game.state` / `game.logic` quando o jogo for autoritativo.
2. **Godot:** Tratar o efeito no `AIGameSimulator` (modo IA) e, no online, esperar evento do servidor; exibir feedback visual (animação, texto).
3. **Dashboard:** O campo `text` da carta pode ser preenchido com a descrição; `abilities` com as palavras-chave; `effects` com JSON para efeitos estruturados.

## Importação de cartas (CSV)

- Use o script: `npm run import-cards -- cartas_planilha.csv` ou `CARDS_CSV=./cartas.csv npm run import-cards`.
- Múltiplos arquivos: `npm run import-cards -- generais.csv cartas.csv` ou `CARDS_CSV=generais.csv,cartas.csv npm run import-cards`.
- Cabeçalhos aceitos (inglês ou português): `id`, `name`/`nome`, `type`/`tipo`, `cost`/`custo`, `race`/`raça`, `class`/`classe`, `attack`/`ataque`, `defense`/`defesa`, `text`/`texto`/`descrição`, `abilities`/`habilidades`, `rarity`/`raridade`. Para Generals: `hero_power_text`/`poder_heroi`, `hero_power_cost`/`custo_poder`.
- Cartas já existentes (mesmo `id`) são ignoradas; apenas novas são inseridas.

## Migração do banco (colunas do General)

Antes de criar/atualizar cartas com poder de herói, rode:

```bash
npm run migrate-database
```

Isso adiciona as colunas `hero_power_text`, `hero_power_cost`, `hero_power_effect`, `passive_effect` na tabela `cards`.
