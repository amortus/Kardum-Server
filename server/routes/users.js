const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { dbHelpers, getUserById } = require('../database');

const router = express.Router();

const ALLOWED_GENDERS = new Set(['male', 'female']);
const ALLOWED_BODY_IDS = new Set(['clothes', 'leather_armor', 'steel_armor']);
const ALLOWED_HEAD_IDS_BY_GENDER = {
    male: new Set(['male_head1', 'male_head2', 'male_head3']),
    female: new Set(['head_long', 'female_head1'])
};

function getRankInfo(eloRanked) {
    const elo = Number(eloRanked || 1000);
    if (elo >= 2400) return { tier: 'grandmaster', display_name: 'Grandmaster' };
    if (elo >= 2000) return { tier: 'diamond', display_name: 'Diamond' };
    if (elo >= 1700) return { tier: 'platinum', display_name: 'Platinum' };
    if (elo >= 1400) return { tier: 'gold', display_name: 'Gold' };
    if (elo >= 1200) return { tier: 'silver', display_name: 'Silver' };
    return { tier: 'bronze', display_name: 'Bronze' };
}

function mapProfile(user) {
    const total = Number(user.total_matches || 0);
    const wins = Number(user.wins || 0);
    const losses = Number(user.losses || 0);
    const level = 1 + Math.floor(total / 5);
    const experience = total * 25;
    const exp_to_next_level = Math.max(100, level * 100 - experience);
    const exp_progress_percent = Math.min(100, Math.floor((experience % 100) * 100 / 100));
    const win_rate = total > 0 ? Math.round((wins / total) * 100) : 0;

    const gender = (user.gender || 'male').toLowerCase();
    const defaultHead = gender === 'female' ? 'head_long' : 'male_head1';

    return {
        id: user.id,
        username: user.username,
        elo_casual: user.elo_casual,
        elo_ranked: user.elo_ranked,
        total_matches: total,
        wins,
        losses,
        win_rate,
        level,
        experience,
        exp_to_next_level,
        exp_progress_percent,
        rank_info: getRankInfo(user.elo_ranked),
        character: {
            gender,
            body_id: user.body_id || 'clothes',
            head_id: user.head_id || defaultHead,
            character_completed: user.character_completed === 1
        },
        character_completed: user.character_completed === 1
    };
}

router.use(authenticateToken);

router.get('/me/profile', async (req, res) => {
    try {
        const user = await getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        }

        res.json({
            success: true,
            profile: mapProfile(user)
        });
    } catch (error) {
        console.error('[Users] Get profile error:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar perfil' });
    }
});

router.get('/:id/profile', async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        }

        res.json({
            success: true,
            profile: mapProfile(user)
        });
    } catch (error) {
        console.error('[Users] Get player profile error:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar perfil do jogador' });
    }
});

router.get('/leaderboard', async (_req, res) => {
    try {
        const users = await dbHelpers.queryAll(
            `SELECT id, username, elo_ranked, wins, losses, total_matches
             FROM users
             ORDER BY elo_ranked DESC, wins DESC
             LIMIT 100`
        );

        const leaderboard = users.map((user) => ({
            id: user.id,
            username: user.username,
            elo_ranked: user.elo_ranked,
            wins: user.wins || 0,
            losses: user.losses || 0,
            total_matches: user.total_matches || 0,
            rank_info: getRankInfo(user.elo_ranked)
        }));

        res.json({
            success: true,
            leaderboard
        });
    } catch (error) {
        console.error('[Users] Get leaderboard error:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar leaderboard' });
    }
});

router.get('/me/match-history', async (req, res) => {
    try {
        const matches = await dbHelpers.queryAll(
            `SELECT m.*,
                    u1.username AS player1_username,
                    u2.username AS player2_username
             FROM matches m
             LEFT JOIN users u1 ON u1.id = m.player1_id
             LEFT JOIN users u2 ON u2.id = m.player2_id
             WHERE m.player1_id = ? OR m.player2_id = ?
             ORDER BY m.created_at DESC
             LIMIT 50`,
            [req.user.id, req.user.id]
        );

        res.json({
            success: true,
            matches
        });
    } catch (error) {
        console.error('[Users] Match history error:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar histórico de partidas' });
    }
});

router.patch('/me/character', async (req, res) => {
    try {
        const gender = String(req.body.gender || '').toLowerCase();
        const bodyId = String(req.body.body_id || '');
        const headId = String(req.body.head_id || '');

        if (!ALLOWED_GENDERS.has(gender)) {
            return res.status(400).json({ success: false, error: 'Gênero inválido para esta fase' });
        }
        if (!ALLOWED_BODY_IDS.has(bodyId)) {
            return res.status(400).json({ success: false, error: 'Body inválido' });
        }
        const allowedHeads = ALLOWED_HEAD_IDS_BY_GENDER[gender] || new Set();
        if (!allowedHeads.has(headId)) {
            return res.status(400).json({ success: false, error: 'Head inválida' });
        }

        await dbHelpers.run(
            `UPDATE users
             SET gender = ?, body_id = ?, head_id = ?, character_completed = 1
             WHERE id = ?`,
            [gender, bodyId, headId, req.user.id]
        );

        const updatedUser = await getUserById(req.user.id);
        res.json({
            success: true,
            profile: mapProfile(updatedUser)
        });
    } catch (error) {
        console.error('[Users] Save character error:', error);
        res.status(500).json({ success: false, error: 'Erro ao salvar personagem' });
    }
});

module.exports = router;
