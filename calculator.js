/**
 * 麻雀点数計算エンジン
 * 4回戦の合計スコアを基準に、オーラスの和了条件を逆算する
 */

const Calculator = {

    calculateWinConditions(gameState) {
        const { players, currentScores, dealerIndex, round3TotalScores, rule } = gameState;
        const ruleConfig = MahjongRules[rule];

        const currentTotals = this.calcCurrentTotals(currentScores, round3TotalScores, ruleConfig);
        const results = [];

        for (let i = 0; i < 4; i++) {
            const isDealer = i === dealerIndex;
            const currentRank = this.getRankByTotal(currentTotals, i);

            const playerConditions = {
                playerIndex: i,
                playerName: players[i],
                currentScore: currentScores[i],
                round3TotalScore: round3TotalScores[i],
                rankPoint: currentTotals[i].rankPoint,
                projectedTotalScore: currentTotals[i].total,
                currentRank,
                isDealer,
                conditions: {
                    toFirst: this.calcConditionForTargetRank(gameState, i, 1, currentTotals, ruleConfig),
                    fromThirdToSecond: currentRank === 3
                        ? this.calcConditionForTargetRank(gameState, i, 2, currentTotals, ruleConfig)
                        : { possible: false, reason: `現在${currentRank}位` },
                    fromFourthToSecond: currentRank === 4
                        ? this.calcConditionForTargetRank(gameState, i, 2, currentTotals, ruleConfig)
                        : { possible: false, reason: `現在${currentRank}位` },
                }
            };
            results.push(playerConditions);
        }
        return results;
    },

    calcCurrentTotals(currentScores, round3TotalScores, ruleConfig) {
        const scoresWithIndex = currentScores.map((score, i) => ({
            playerIndex: i,
            olasuScore: score,
            score: round3TotalScores[i] + score
        }));
        const rankPointsResults = ruleConfig.calculateRankPoints(scoresWithIndex);

        return currentScores.map((score, i) => {
            const rp = rankPointsResults.find(r => r.playerIndex === i);
            const rankPoint = rp.rankPoints * 1000;
            return {
                playerIndex: i,
                olasuScore: score,
                round3Total: round3TotalScores[i],
                rankPoint,
                total: round3TotalScores[i] + score + rankPoint
            };
        });
    },

    /**
     * 和了後の全プレイヤーの合計スコアをシミュレート
     */
    simulateOutcome(currentScores, round3TotalScores, winnerIndex, winnerGain, losers, ruleConfig) {
        const newOlasuScores = [...currentScores];
        newOlasuScores[winnerIndex] += winnerGain;
        for (const [idx, payment] of Object.entries(losers)) {
            newOlasuScores[parseInt(idx)] -= payment;
        }

        const scoresWithIndex = newOlasuScores.map((score, i) => ({
            playerIndex: i,
            olasuScore: score,
            score: round3TotalScores[i] + score
        }));
        const rankPointsResults = ruleConfig.calculateRankPoints(scoresWithIndex);

        return newOlasuScores.map((score, i) => {
            const rp = rankPointsResults.find(r => r.playerIndex === i);
            const rankPoint = rp.rankPoints * 1000;
            return {
                playerIndex: i,
                total: round3TotalScores[i] + score + rankPoint,
                rankPoint
            };
        });
    },

    /**
     * 和了後の順位を判定（同点は不可）
     */
    checkRank(outcome, winnerIndex, targetRank) {
        const winnerTotal = outcome[winnerIndex].total;
        const higherCount = outcome.filter(o => o.total > winnerTotal).length;
        const sameCount = outcome.filter(o => o.total === winnerTotal && o.playerIndex !== winnerIndex).length;
        const winnerRank = higherCount + 1;
        return winnerRank <= targetRank && sameCount === 0;
    },

    calcConditionForTargetRank(gameState, playerIndex, targetRank, currentTotals, ruleConfig) {
        const { dealerIndex, riichiSticks, honbaSticks } = gameState;
        const isDealer = playerIndex === dealerIndex;
        const riichiBonus = riichiSticks * 1000;
        const honbaBonus = honbaSticks * 300;

        const tsumoCondition = this.calcTsumoCondition(
            gameState, playerIndex, targetRank, ruleConfig, isDealer, riichiBonus, honbaBonus
        );

        const ronConditions = [];
        for (let loserIndex = 0; loserIndex < 4; loserIndex++) {
            if (loserIndex === playerIndex) continue;
            const ronCond = this.calcRonCondition(
                gameState, playerIndex, loserIndex, targetRank, ruleConfig,
                isDealer, riichiBonus, honbaBonus
            );
            ronConditions.push({ fromPlayerIndex: loserIndex, ...ronCond });
        }

        return { possible: true, tsumo: tsumoCondition, ron: ronConditions };
    },

    calcTsumoCondition(gameState, winnerIndex, targetRank, ruleConfig, isDealer, riichiBonus, honbaBonus) {
        const { currentScores, round3TotalScores } = gameState;
        const candidates = ScoreTable.getAllHands(isDealer, true, ruleConfig.scoreTableRule);

        for (const hand of candidates) {
            const tsumoScore = ScoreTable.getTsumoScore(hand.fu, hand.han, isDealer, ruleConfig.scoreTableRule);

            let winnerGain = riichiBonus + honbaBonus;
            const losers = {};
            if (tsumoScore.allPayment) {
                winnerGain += tsumoScore.allPayment * 3;
                for (let i = 0; i < 4; i++) {
                    if (i !== winnerIndex) {
                        losers[i] = tsumoScore.allPayment + (gameState.honbaSticks * 100);
                    }
                }
            } else {
                winnerGain += tsumoScore.koPayment * 2 + tsumoScore.oyaPayment;
                for (let i = 0; i < 4; i++) {
                    if (i === winnerIndex) continue;
                    losers[i] = (i === gameState.dealerIndex)
                        ? tsumoScore.oyaPayment + (gameState.honbaSticks * 100)
                        : tsumoScore.koPayment + (gameState.honbaSticks * 100);
                }
            }

            const outcome = this.simulateOutcome(
                currentScores, round3TotalScores, winnerIndex, winnerGain, losers, ruleConfig
            );

            if (this.checkRank(outcome, winnerIndex, targetRank)) {
                return {
                    possible: true,
                    fu: hand.fu,
                    han: hand.han,
                    description: ScoreTable.formatScore(hand.fu, hand.han),
                    payment: tsumoScore,
                    winnerGain
                };
            }
        }

        return { possible: false, reason: '役満でも達成不可' };
    },

    calcRonCondition(gameState, winnerIndex, loserIndex, targetRank, ruleConfig, isDealer, riichiBonus, honbaBonus) {
        const { currentScores, round3TotalScores } = gameState;
        const candidates = ScoreTable.getAllHands(isDealer, false, ruleConfig.scoreTableRule);

        for (const hand of candidates) {
            const ronScore = ScoreTable.getRonScore(hand.fu, hand.han, isDealer, ruleConfig.scoreTableRule);
            const winnerGain = ronScore + riichiBonus + (gameState.honbaSticks * 300);
            const loserPayment = ronScore + (gameState.honbaSticks * 300);

            const outcome = this.simulateOutcome(
                currentScores, round3TotalScores, winnerIndex, winnerGain,
                { [loserIndex]: loserPayment }, ruleConfig
            );

            if (this.checkRank(outcome, winnerIndex, targetRank)) {
                return {
                    possible: true,
                    fu: hand.fu,
                    han: hand.han,
                    description: ScoreTable.formatScore(hand.fu, hand.han),
                    score: ronScore,
                    winnerGain
                };
            }
        }

        return { possible: false, reason: '役満でも達成不可' };
    },

    getRankByTotal(totals, playerIndex) {
        const myTotal = totals[playerIndex].total;
        return totals.filter(t => t.total > myTotal).length + 1;
    }
};
