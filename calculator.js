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
                currentTotals,
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
                    winnerGain,
                    simulationDetail: outcome
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
                    winnerGain,
                    simulationDetail: outcome
                };
            }
        }

        return { possible: false, reason: '役満でも達成不可' };
    },

    getRankByTotal(totals, playerIndex) {
        const myTotal = totals[playerIndex].total;
        return totals.filter(t => t.total > myTotal).length + 1;
    },

    /**
     * 2位以内で勝ち上がれる最大放銃点数を計算
     * @param {Object} gameState - ゲーム状態
     * @param {number} playerIndex - 放銃するプレイヤーのインデックス
     * @returns {Array} 各放銃先ごとの最大放銃点数
     */
    calcMaxRonAllowed(gameState, playerIndex) {
        const { currentScores, round3TotalScores, riichiSticks, honbaSticks, dealerIndex } = gameState;
        const ruleConfig = MahjongRules[gameState.rule];
        const riichiBonus = riichiSticks * 1000;
        const honbaBonus = honbaSticks * 300;
        const results = [];

        for (let winnerIndex = 0; winnerIndex < 4; winnerIndex++) {
            if (winnerIndex === playerIndex) continue;

            // 放銃額を100点刻みで増やしながら、2位以内を維持できる最大値を探す
            // 最大は役満（32000点）を超えない範囲で探索
            const winnerIsDealer = winnerIndex === dealerIndex;
            const MAX_RON = winnerIsDealer ? 48000 : 32000;
            let maxAllowed = 0;
            let canSurviveZero = true;

            // まず0点放銃（現状維持）で2位以内かチェック
            const baseOutcome = this.simulateOutcome(
                currentScores, round3TotalScores, winnerIndex, 0,
                { [playerIndex]: 0 }, ruleConfig
            );
            const baseRank = this.getRankFromOutcome(baseOutcome, playerIndex);
            if (baseRank > 2) {
                canSurviveZero = false;
            }

            if (canSurviveZero) {
                // 二分探索で最大放銃点数を効率的に求める
                let lo = 0;
                let hi = MAX_RON;

                while (lo < hi) {
                    const mid = Math.floor((lo + hi + 100) / 200) * 100; // 100点刻み
                    if (mid > hi) break;

                    // 放銃者の支払い = ロン点 + 積み棒×300
                    const loserPayment = mid + honbaBonus;
                    // 上がり者の取得 = ロン点 + 積み棒×300 + 立直棒×1000
                    const winnerGain = mid + honbaBonus + riichiBonus;

                    const outcome = this.simulateOutcome(
                        currentScores, round3TotalScores, winnerIndex, winnerGain,
                        { [playerIndex]: loserPayment }, ruleConfig
                    );
                    const rank = this.getRankFromOutcome(outcome, playerIndex);

                    if (rank <= 2) {
                        lo = mid;
                        maxAllowed = mid;
                    } else {
                        hi = mid - 100;
                    }
                }
            }

            results.push({
                winnerIndex,
                winnerIsDealer,
                maxAllowed,
                canSurvive: canSurviveZero,
                honbaSticks,
                rule: ruleConfig.scoreTableRule || 'official'
            });
        }

        return results;
    },

    /**
     * 他家にツモられた場合に2位以内を維持できる最大の手を計算
     * @param {Object} gameState - ゲーム状態
     * @param {number} playerIndex - 被ツモのプレイヤー（自分）
     * @returns {Array} 各ツモ者ごとの限度情報
     */
    calcTsumoLimit(gameState, playerIndex) {
        const { currentScores, round3TotalScores, dealerIndex, riichiSticks, honbaSticks } = gameState;
        const ruleConfig = MahjongRules[gameState.rule];
        const riichiBonus = riichiSticks * 1000;
        const results = [];

        for (let winnerIndex = 0; winnerIndex < 4; winnerIndex++) {
            if (winnerIndex === playerIndex) continue;

            const isWinnerDealer = winnerIndex === dealerIndex;
            const candidates = ScoreTable.getAllHands(isWinnerDealer, true, ruleConfig.scoreTableRule);

            let maxSafe = null;
            let minDanger = null;

            for (const hand of candidates) {
                const tsumoScore = ScoreTable.getTsumoScore(hand.fu, hand.han, isWinnerDealer, ruleConfig.scoreTableRule);

                let winnerGain = riichiBonus + (honbaSticks * 300);
                const losers = {};

                if (tsumoScore.allPayment) {
                    // 親のツモ：全員同額
                    winnerGain += tsumoScore.allPayment * 3;
                    for (let i = 0; i < 4; i++) {
                        if (i !== winnerIndex) {
                            losers[i] = tsumoScore.allPayment + (honbaSticks * 100);
                        }
                    }
                } else {
                    // 子のツモ：子と親で支払い異なる
                    winnerGain += tsumoScore.koPayment * 2 + tsumoScore.oyaPayment;
                    for (let i = 0; i < 4; i++) {
                        if (i === winnerIndex) continue;
                        losers[i] = (i === dealerIndex)
                            ? tsumoScore.oyaPayment + (honbaSticks * 100)
                            : tsumoScore.koPayment + (honbaSticks * 100);
                    }
                }

                const outcome = this.simulateOutcome(
                    currentScores, round3TotalScores, winnerIndex, winnerGain, losers, ruleConfig
                );
                const rank = this.getRankFromOutcome(outcome, playerIndex);

                if (rank <= 2) {
                    maxSafe = {
                        fu: hand.fu,
                        han: hand.han,
                        score: hand.score,
                        description: ScoreTable.formatScore(hand.fu, hand.han),
                        payment: tsumoScore
                    };
                } else {
                    if (!minDanger) {
                        minDanger = {
                            fu: hand.fu,
                            han: hand.han,
                            score: hand.score,
                            description: ScoreTable.formatScore(hand.fu, hand.han),
                            payment: tsumoScore,
                            resultRank: rank
                        };
                    }
                    break;
                }
            }

            results.push({
                winnerIndex,
                winnerIsDealer: isWinnerDealer,
                maxSafe,
                minDanger,
                safe: !minDanger
            });
        }

        return results;
    },

    /**
     * シミュレーション結果から特定プレイヤーの順位を取得
     */
    getRankFromOutcome(outcome, playerIndex) {
        const myTotal = outcome[playerIndex].total;
        // 自分より高いスコアの人数 + 1 = 自分の順位
        // 同点は上位扱い（同点で2位以内に入れない）
        const higherCount = outcome.filter(o => o.total > myTotal).length;
        const sameCount = outcome.filter(o => o.total === myTotal && o.playerIndex !== playerIndex).length;
        // 同点の場合は不利な方（上位に数える）で計算
        return higherCount + sameCount + 1;
    },

    /**
     * テンパイ料による流局時の順位変動をシミュレート
     * 各プレイヤーについて、テンパイ/ノーテンの全組み合わせをシミュレートする
     * 
     * テンパイ料ルール：
     *   1人テンパイ: テンパイ者+3000、ノーテン者-1000×3
     *   2人テンパイ: テンパイ者+1500×2、ノーテン者-1500×2
     *   3人テンパイ: テンパイ者+1000×3、ノーテン者-3000
     *   0人/4人テンパイ: 移動なし
     * 
     * @param {Object} gameState - ゲーム状態
     * @param {number} playerIndex - 対象プレイヤー
     * @returns {Object} テンパイシナリオ結果
     */
    calcTenpaiScenarios(gameState, playerIndex) {
        const { currentScores, round3TotalScores, riichiSticks } = gameState;
        const ruleConfig = MahjongRules[gameState.rule];

        // 現在の順位を計算
        const currentTotals = this.calcCurrentTotals(currentScores, round3TotalScores, ruleConfig);
        const currentRank = this.getRankByTotal(currentTotals, playerIndex);

        const results = {
            playerIndex,
            currentRank,
            // 自分がノーテンの場合のシナリオ一覧
            notenScenarios: [],
            // 自分がテンパイの場合のシナリオ一覧
            tenpaiScenarios: []
        };

        // 他3人のインデックス
        const others = [0, 1, 2, 3].filter(i => i !== playerIndex);

        // 他3人のテンパイ/ノーテン組み合わせを列挙（2^3=8パターン）
        for (let mask = 0; mask < 8; mask++) {
            const otherTenpai = others.map((idx, bit) => ({
                playerIndex: idx,
                isTenpai: !!(mask & (1 << bit))
            }));

            // 自分がノーテンの場合
            const notenResult = this._simulateTenpaiPayment(
                gameState, ruleConfig, playerIndex, false, otherTenpai, riichiSticks
            );
            results.notenScenarios.push(notenResult);

            // 自分がテンパイの場合
            const tenpaiResult = this._simulateTenpaiPayment(
                gameState, ruleConfig, playerIndex, true, otherTenpai, riichiSticks
            );
            results.tenpaiScenarios.push(tenpaiResult);
        }

        return results;
    },

    /**
     * テンパイ料移動をシミュレートして結果を返す（内部ヘルパー）
     */
    _simulateTenpaiPayment(gameState, ruleConfig, playerIndex, selfTenpai, otherTenpai, riichiSticks) {
        const { currentScores, round3TotalScores } = gameState;

        // テンパイ者のリスト
        const tenpaiPlayers = [];
        const notenPlayers = [];

        if (selfTenpai) {
            tenpaiPlayers.push(playerIndex);
        } else {
            notenPlayers.push(playerIndex);
        }

        otherTenpai.forEach(o => {
            if (o.isTenpai) {
                tenpaiPlayers.push(o.playerIndex);
            } else {
                notenPlayers.push(o.playerIndex);
            }
        });

        const tenpaiCount = tenpaiPlayers.length;

        // テンパイ料を計算
        const newScores = [...currentScores];

        if (tenpaiCount >= 1 && tenpaiCount <= 3) {
            // テンパイ料テーブル（受け取り/支払い）
            const payments = {
                1: { receive: 3000, pay: 1000 },
                2: { receive: 1500, pay: 1500 },
                3: { receive: 1000, pay: 3000 }
            };
            const { receive, pay } = payments[tenpaiCount];

            tenpaiPlayers.forEach(i => { newScores[i] += receive; });
            notenPlayers.forEach(i => { newScores[i] -= pay; });
        }
        // 0人・4人テンパイは移動なし

        // 流局後のスコアで順位・順位点を計算
        const scoresWithIndex = newScores.map((score, i) => ({
            playerIndex: i,
            olasuScore: score,
            score: round3TotalScores[i] + score
        }));
        const rankPointsResults = ruleConfig.calculateRankPoints(scoresWithIndex);

        // 立直棒の処理: riichiOnDraw設定に基づく
        // 'kyoutaku' = 供託として場に残る（誰も取得しない）
        // 'first' = 1位が総取り
        const riichiOnDraw = ruleConfig.riichiOnDraw || 'kyoutaku';

        const outcome = newScores.map((score, i) => {
            const rp = rankPointsResults.find(r => r.playerIndex === i);
            const rankPoint = rp.rankPoints * 1000;
            return {
                playerIndex: i,
                total: round3TotalScores[i] + score + rankPoint,
                rankPoint,
                riichiBonus: 0
            };
        });

        if (riichiOnDraw === 'first' && riichiSticks > 0) {
            // 1位を判定して立直棒を付与
            const firstPlace = outcome.reduce((best, cur) =>
                cur.total > best.total ? cur : best
            );
            firstPlace.riichiBonus = riichiSticks * 1000;
            firstPlace.total += riichiSticks * 1000;
        }

        const rank = this.getRankFromOutcome(outcome, playerIndex);

        // 現在の順位を再計算
        const currentTotals = this.calcCurrentTotals(currentScores, round3TotalScores, ruleConfig);
        const currentRank = this.getRankByTotal(currentTotals, playerIndex);

        // 他プレイヤーのテンパイ状態の説明を生成
        const otherTenpaiNames = otherTenpai
            .filter(o => o.isTenpai)
            .map(o => gameState.players[o.playerIndex]);

        return {
            tenpaiPlayers: tenpaiPlayers.slice(),
            notenPlayers: notenPlayers.slice(),
            tenpaiCount,
            otherTenpaiNames,
            selfTenpai,
            resultRank: rank,
            currentRank,
            rankChanged: rank !== currentRank,
            improved: rank < currentRank,
            worsened: rank > currentRank,
            outcome
        };
    }
};
