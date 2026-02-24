/**
 * 麻雀ルール定義
 * 各団体のルールに基づく順位点計算
 */

const MahjongRules = {
    /**
     * 日本プロ麻雀連盟公式ルール（12点加減方式）
     */
    official: {
        name: '日本プロ麻雀連盟公式ルール',
        description: '12点加減方式',
        startingPoints: 30000,
        returnPoints: 30000,
        scoreTableRule: 'official', // 30符4翻は切り上げなし

        /**
         * 順位点を計算
         * @param {Array} finalScores - 最終スコアの配列 [{playerIndex, score}, ...]
         * @returns {Array} 順位点の配列 [{playerIndex, rankPoints}, ...]
         */
        calculateRankPoints(finalScores) {
            // オーラス単体の点数で順位・浮き沈みを決定
            const sorted = [...finalScores].sort((a, b) => b.olasuScore - a.olasuScore);

            // 浮き人数を計算（オーラスの点数のみで判定、30000点以上が浮き）
            const floatingCount = sorted.filter(p => p.olasuScore >= this.returnPoints).length;

            // 順位点テーブル
            const rankPointsTable = {
                0: { // 0人浮き（全員30000未満）→ 全員順位点0
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0
                },
                1: { // 1人浮き
                    1: 12.0,
                    2: -1.0,
                    3: -3.0,
                    4: -8.0
                },
                2: { // 2人浮き
                    1: 8.0,
                    2: 4.0,
                    3: -4.0,
                    4: -8.0
                },
                3: { // 3人浮き
                    1: 8.0,
                    2: 3.0,
                    3: 1.0,
                    4: -12.0
                },
                4: { // 4人浮き（全員30000ちょうど）→ 全員順位点0
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0
                }
            };

            const table = rankPointsTable[floatingCount];

            // 同点処理：同点の場合は順位点を折半
            const results = [];
            let currentRank = 1;
            let i = 0;

            while (i < sorted.length) {
                const currentOlasuScore = sorted[i].olasuScore;
                const sameScorePlayers = [];

                // 同点のプレイヤーを集める（オーラスの点数で判定）
                while (i < sorted.length && sorted[i].olasuScore === currentOlasuScore) {
                    sameScorePlayers.push(sorted[i]);
                    i++;
                }

                // 順位点を計算（同点の場合は折半）
                let totalRankPoints = 0;
                for (let j = 0; j < sameScorePlayers.length; j++) {
                    totalRankPoints += table[currentRank + j];
                }
                const averageRankPoints = totalRankPoints / sameScorePlayers.length;

                // 結果を追加
                for (const player of sameScorePlayers) {
                    results.push({
                        playerIndex: player.playerIndex,
                        score: player.score,
                        rank: currentRank,
                        rankPoints: averageRankPoints,
                        isTied: sameScorePlayers.length > 1
                    });
                }

                currentRank += sameScorePlayers.length;
            }

            return results;
        }
    },

    /**
     * WRCルール
     */
    wrc: {
        name: 'WRCルール',
        description: '順位点：1着+15、2着+5、3着-5、4着-15',
        startingPoints: 30000,
        returnPoints: 30000,
        scoreTableRule: 'wrc', // 30符4翻は切り上げ満貫

        calculateRankPoints(finalScores) {
            const sorted = [...finalScores].sort((a, b) => b.score - a.score);

            const rankPointsTable = {
                1: 15,
                2: 5,
                3: -5,
                4: -15
            };

            const results = [];
            let currentRank = 1;
            let i = 0;

            while (i < sorted.length) {
                const currentScore = sorted[i].score;
                const sameScorePlayers = [];

                while (i < sorted.length && sorted[i].score === currentScore) {
                    sameScorePlayers.push(sorted[i]);
                    i++;
                }

                // 順位点を折半
                let totalRankPoints = 0;
                for (let j = 0; j < sameScorePlayers.length; j++) {
                    totalRankPoints += rankPointsTable[currentRank + j];
                }
                const averageRankPoints = totalRankPoints / sameScorePlayers.length;

                for (const player of sameScorePlayers) {
                    results.push({
                        playerIndex: player.playerIndex,
                        score: player.score,
                        rank: currentRank,
                        rankPoints: averageRankPoints,
                        isTied: sameScorePlayers.length > 1
                    });
                }

                currentRank += sameScorePlayers.length;
            }

            return results;
        }
    },

    /**
     * WRC-Rルール（RはRedの意味）
     */
    wrcR: {
        name: 'WRC-Rルール',
        description: 'World Riichi Championship - Red　順位点：1着+30、2着+15、3着-15、4着-30',
        startingPoints: 30000,
        returnPoints: 30000,
        scoreTableRule: 'wrc', // 30符4翻は切り上げ満貫

        calculateRankPoints(finalScores) {
            const sorted = [...finalScores].sort((a, b) => b.score - a.score);

            const rankPointsTable = {
                1: 30,
                2: 15,
                3: -15,
                4: -30
            };

            const results = [];
            let currentRank = 1;
            let i = 0;

            while (i < sorted.length) {
                const currentScore = sorted[i].score;
                const sameScorePlayers = [];

                while (i < sorted.length && sorted[i].score === currentScore) {
                    sameScorePlayers.push(sorted[i]);
                    i++;
                }

                // 順位点を折半
                let totalRankPoints = 0;
                for (let j = 0; j < sameScorePlayers.length; j++) {
                    totalRankPoints += rankPointsTable[currentRank + j];
                }
                const averageRankPoints = totalRankPoints / sameScorePlayers.length;

                for (const player of sameScorePlayers) {
                    results.push({
                        playerIndex: player.playerIndex,
                        score: player.score,
                        rank: currentRank,
                        rankPoints: averageRankPoints,
                        isTied: sameScorePlayers.length > 1
                    });
                }

                currentRank += sameScorePlayers.length;
            }

            return results;
        }
    },

    /**
     * Mリーグルール
     * 25000点持ち30000点返し、ウマ+30/+10/-10/-30、オカ+20（1位のみ）
     */
    mleague: {
        name: 'Mリーグルール',
        description: '25000点持ち30000点返し ウマ: +30/+10/-10/-30 オカ+20',
        startingPoints: 25000,
        returnPoints: 30000,
        scoreTableRule: 'wrc', // 切り上げ満貫

        calculateRankPoints(finalScores) {
            const sorted = [...finalScores].sort((a, b) => b.score - a.score);

            const umaTable = {
                1: 30,
                2: 10,
                3: -10,
                4: -30
            };

            const results = [];
            let currentRank = 1;
            let i = 0;

            while (i < sorted.length) {
                const currentScore = sorted[i].score;
                const sameScorePlayers = [];

                while (i < sorted.length && sorted[i].score === currentScore) {
                    sameScorePlayers.push(sorted[i]);
                    i++;
                }

                // ウマを折半
                let totalUma = 0;
                for (let j = 0; j < sameScorePlayers.length; j++) {
                    totalUma += umaTable[currentRank + j];
                }
                const averageUma = totalUma / sameScorePlayers.length;

                // オカ（1位のみ+20、同着なら分割）
                let oka = 0;
                for (let j = 0; j < sameScorePlayers.length; j++) {
                    if (currentRank + j === 1) {
                        oka = 20 / sameScorePlayers.length;
                    }
                }

                for (const player of sameScorePlayers) {
                    results.push({
                        playerIndex: player.playerIndex,
                        score: player.score,
                        rank: currentRank,
                        rankPoints: averageUma + oka,
                        isTied: sameScorePlayers.length > 1
                    });
                }

                currentRank += sameScorePlayers.length;
            }

            return results;
        }
    },

    /**
     * 最高位戦ルール
     * 30000点持ち30000点返し、ウマ+30/+10/-10/-30
     */
    saikouisen: {
        name: '最高位戦ルール',
        description: '最高位戦日本プロ麻雀協会 ウマ: +30/+10/-10/-30',
        startingPoints: 30000,
        returnPoints: 30000,
        scoreTableRule: 'wrc', // 切り上げ満貫

        calculateRankPoints(finalScores) {
            const sorted = [...finalScores].sort((a, b) => b.score - a.score);

            const rankPointsTable = {
                1: 30,
                2: 10,
                3: -10,
                4: -30
            };

            const results = [];
            let currentRank = 1;
            let i = 0;

            while (i < sorted.length) {
                const currentScore = sorted[i].score;
                const sameScorePlayers = [];

                while (i < sorted.length && sorted[i].score === currentScore) {
                    sameScorePlayers.push(sorted[i]);
                    i++;
                }

                let totalRankPoints = 0;
                for (let j = 0; j < sameScorePlayers.length; j++) {
                    totalRankPoints += rankPointsTable[currentRank + j];
                }
                const averageRankPoints = totalRankPoints / sameScorePlayers.length;

                for (const player of sameScorePlayers) {
                    results.push({
                        playerIndex: player.playerIndex,
                        score: player.score,
                        rank: currentRank,
                        rankPoints: averageRankPoints,
                        isTied: sameScorePlayers.length > 1
                    });
                }

                currentRank += sameScorePlayers.length;
            }

            return results;
        }
    },

    /**
     * カスタムルール
     * ユーザーが持ち点・返し点・ウマ・オカを自由設定
     */
    custom: {
        name: 'カスタムルール',
        description: '自由設定',
        startingPoints: 25000,
        returnPoints: 30000,
        scoreTableRule: 'wrc', // 切り上げ満貫
        uma: { 1: 30, 2: 10, 3: -10, 4: -30 },
        oka: 0,

        calculateRankPoints(finalScores) {
            const sorted = [...finalScores].sort((a, b) => b.score - a.score);

            const results = [];
            let currentRank = 1;
            let i = 0;

            while (i < sorted.length) {
                const currentScore = sorted[i].score;
                const sameScorePlayers = [];

                while (i < sorted.length && sorted[i].score === currentScore) {
                    sameScorePlayers.push(sorted[i]);
                    i++;
                }

                // ウマを折半
                let totalUma = 0;
                for (let j = 0; j < sameScorePlayers.length; j++) {
                    totalUma += this.uma[currentRank + j];
                }
                const averageUma = totalUma / sameScorePlayers.length;

                // オカ（1位のみ、同着なら分割）
                let okaBonus = 0;
                for (let j = 0; j < sameScorePlayers.length; j++) {
                    if (currentRank + j === 1) {
                        okaBonus = this.oka / sameScorePlayers.length;
                    }
                }

                for (const player of sameScorePlayers) {
                    results.push({
                        playerIndex: player.playerIndex,
                        score: player.score,
                        rank: currentRank,
                        rankPoints: averageUma + okaBonus,
                        isTied: sameScorePlayers.length > 1
                    });
                }

                currentRank += sameScorePlayers.length;
            }

            return results;
        }
    }
};
