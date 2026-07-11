/**
 * メインアプリケーションロジック
 */

const App = {
    currentScreen: 'rule-selection',
    selectedRule: null,
    detailCounter: 0,
    gameState: {
        rule: null,
        players: ['東家', '南家', '西家', '北家'],
        round3TotalScores: [0, 0, 0, 0],
        currentScores: [0, 0, 0, 0],
        dealerIndex: 0,
        riichiSticks: 0,
        honbaSticks: 0
    },

    /**
     * アプリケーション初期化
     */
    init() {
        this.loadTheme();
        this.setupEventListeners();
        this.loadFromLocalStorage();
        this.showScreen('rule-selection');
    },

    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // ルール選択
        document.querySelectorAll('.rule-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const rule = e.currentTarget.dataset.rule;
                this.selectRule(rule);
            });
        });

        // ルール確定ボタン
        document.getElementById('confirm-rule-btn').addEventListener('click', () => {
            if (this.selectedRule) {
                this.gameState.rule = this.selectedRule;
                this.showScreen('score-input');
                this.updateScoreIndicator();
            }
        });

        // スコア計算ボタン
        document.getElementById('calculate-btn').addEventListener('click', () => {
            this.calculateResults();
        });

        // 戻るボタン
        document.getElementById('back-to-input-btn').addEventListener('click', () => {
            this.showScreen('score-input');
        });

        document.getElementById('back-to-rule-btn').addEventListener('click', () => {
            this.showScreen('rule-selection');
        });

        // テーマ切替
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // ステッパーボタン
        document.querySelectorAll('.stepper-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const delta = parseInt(btn.dataset.delta);
                const input = document.getElementById(targetId);
                if (input) {
                    const newVal = Math.max(0, (parseInt(input.value) || 0) + delta);
                    input.value = newVal;
                    this.updateScoreIndicator();
                }
            });
        });

        // スコア入力時のリアルタイム合計表示
        document.querySelectorAll('.score-input').forEach(input => {
            input.addEventListener('input', () => this.updateScoreIndicator());
        });
        // 立直棒変更でも更新
        document.getElementById('riichi-sticks').addEventListener('input', () => this.updateScoreIndicator());

        // 数値入力フィールドをタップしたとき自動で全選択＆スクロール
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('focus', () => {
                input.select();
                setTimeout(() => {
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
        });

        // プレイヤー名変更時に親ラベルを連動更新
        for (let i = 0; i < 4; i++) {
            document.getElementById(`player-${i}-name`).addEventListener('input', () => {
                this.updateDealerLabels();
            });
        }
    },

    /**
     * ルール選択
     */
    selectRule(rule) {
        this.selectedRule = rule;

        // すべてのカードから選択状態を削除
        document.querySelectorAll('.rule-card').forEach(card => {
            card.classList.remove('selected');
        });

        // 選択されたカードに選択状態を追加
        const selectedCard = document.querySelector(`[data-rule="${rule}"]`);
        if (selectedCard) selectedCard.classList.add('selected');

        // カスタムルール設定パネルの表示切替
        const customConfig = document.getElementById('custom-rule-config');
        if (customConfig) {
            if (rule === 'custom') {
                customConfig.classList.remove('hidden');
                this.loadCustomRuleConfig();
            } else {
                customConfig.classList.add('hidden');
            }
        }

        // ルールに応じてオーラススコアのデフォルト値を更新
        const ruleConfig = MahjongRules[rule];
        if (ruleConfig) {
            const startingPoints = ruleConfig.startingPoints;
            for (let i = 0; i < 4; i++) {
                const input = document.getElementById(`current-player${i}`);
                // まだ初期値のまま（30000か25000）なら更新
                const currentVal = parseInt(input.value) || 0;
                if (currentVal === 30000 || currentVal === 25000 || currentVal === 0) {
                    input.value = startingPoints;
                }
            }
        }

        // 確定ボタンを有効化
        document.getElementById('confirm-rule-btn').disabled = false;
    },

    /**
     * 画面切り替え
     */
    showScreen(screenName) {
        // すべての画面を非表示
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });

        // 指定された画面を表示
        document.getElementById(`${screenName}-screen`).classList.remove('hidden');

        this.currentScreen = screenName;

        // 画面遷移時にページ先頭へスクロール
        window.scrollTo(0, 0);
    },

    /**
     * 結果を計算
     */
    calculateResults() {
        console.log('=== 計算開始 ===');
        this.detailCounter = 0;

        try {
            // 入力値を取得
            this.collectInputData();
            console.log('入力データ収集完了:', this.gameState);

            // バリデーション
            if (!this.validateInput()) {
                console.log('バリデーションエラー');
                return;
            }
            console.log('バリデーション成功');

            // 計算実行
            console.log('計算実行中...');
            const results = Calculator.calculateWinConditions(this.gameState);
            console.log('計算結果:', results);

            // 放銃限度計算（各プレイヤーが誰に何点まで放銃しても2位以内を維持できるか）
            const ronLimits = results.map(r => ({
                playerIndex: r.playerIndex,
                currentRank: r.currentRank,
                limits: Calculator.calcMaxRonAllowed(this.gameState, r.playerIndex)
            }));
            console.log('放銃限度:', ronLimits);

            // ツモられ限度計算（他家にツモられても2位以内を維持できるか）
            const tsumoLimits = results.map(r => ({
                playerIndex: r.playerIndex,
                currentRank: r.currentRank,
                limits: Calculator.calcTsumoLimit(this.gameState, r.playerIndex)
            }));
            console.log('ツモられ限度:', tsumoLimits);

            // テンパイ料シミュレーション
            const tenpaiScenarios = results.map(r => ({
                playerIndex: r.playerIndex,
                currentRank: r.currentRank,
                scenarios: Calculator.calcTenpaiScenarios(this.gameState, r.playerIndex)
            }));
            console.log('テンパイシナリオ:', tenpaiScenarios);

            // 入力データを保存
            this.saveToLocalStorage();

            // 結果を表示
            this.displayResults(results, ronLimits, tsumoLimits, tenpaiScenarios);
            console.log('結果表示完了');

            // 履歴に保存
            this.saveHistory(results);

            // 結果画面に遷移
            this.showScreen('results');
            console.log('=== 計算完了 ===');
        } catch (error) {
            console.error('計算エラー:', error);
            alert(`エラーが発生しました: ${error.message}\n\nブラウザのコンソール(F12)を確認してください。`);
        }
    },

    /**
     * 入力データを収集
     */
    collectInputData() {
        console.log('データ収集開始');

        // プレイヤー名
        for (let i = 0; i < 4; i++) {
            const name = document.getElementById(`player-${i}-name`).value.trim();
            if (name) {
                this.gameState.players[i] = name;
            }
        }
        console.log('プレイヤー名:', this.gameState.players);

        // 3回戦終了時の累計スコア（入力値×1000）
        for (let i = 0; i < 4; i++) {
            const score = parseFloat(document.getElementById(`round3-total-player${i}`).value) || 0;
            this.gameState.round3TotalScores[i] = score * 1000;
        }
        console.log('3回戦終了時スコア:', this.gameState.round3TotalScores);

        // オーラス現在スコア
        for (let i = 0; i < 4; i++) {
            const score = parseInt(document.getElementById(`current-player${i}`).value) || 0;
            this.gameState.currentScores[i] = score;
        }
        console.log('オーラス現在スコア:', this.gameState.currentScores);

        // 親の位置
        const dealerRadio = document.querySelector('input[name="dealer"]:checked');
        if (dealerRadio) {
            this.gameState.dealerIndex = parseInt(dealerRadio.value);
        }
        console.log('親の位置:', this.gameState.dealerIndex);

        // 立直棒・積み棒
        this.gameState.riichiSticks = parseInt(document.getElementById('riichi-sticks').value) || 0;
        this.gameState.honbaSticks = parseInt(document.getElementById('honba-sticks').value) || 0;
        console.log('立直棒:', this.gameState.riichiSticks, '積み棒:', this.gameState.honbaSticks);
    },

    /**
     * 入力バリデーション
     */
    validateInput() {
        // 100点単位チェック
        const invalidPlayers = [];
        for (let i = 0; i < 4; i++) {
            if (this.gameState.currentScores[i] % 100 !== 0) {
                invalidPlayers.push(this.gameState.players[i]);
            }
        }
        if (invalidPlayers.length > 0) {
            alert(`点数は100点単位で入力してください。\n対象: ${invalidPlayers.join('、')}`);
            return false;
        }

        // ルールに応じた合計点を計算
        const ruleConfig = MahjongRules[this.gameState.rule];
        const startingPoints = ruleConfig ? ruleConfig.startingPoints : 30000;
        const totalPoints = startingPoints * 4; // Mリーグ: 100000, その他: 120000

        const total = this.gameState.currentScores.reduce((sum, score) => sum + score, 0);
        const riichiTotal = this.gameState.riichiSticks * 1000;
        const expectedPlayerTotal = totalPoints - riichiTotal;

        if (total !== expectedPlayerTotal) {
            const riichiMsg = riichiTotal > 0 ? `\n（立直棒${this.gameState.riichiSticks}本 = ${riichiTotal}点分が場に出ているため、4者の合計は${expectedPlayerTotal}点になります）` : '';
            alert(`4者の点数合計が${expectedPlayerTotal.toLocaleString()}点になっていません。\n現在の合計: ${total.toLocaleString()}点${riichiMsg}`);
            return false;
        }

        return true;
    },

    /**
     * 結果を表示
     */
    displayResults(results, ronLimits, tsumoLimits, tenpaiScenarios) {
        const container = document.getElementById('results-container');
        container.innerHTML = '';
        this.lastResults = results;

        // ルール設定から返し点を取得
        const ruleConfig = MahjongRules[this.gameState.rule];
        const returnPoints = ruleConfig ? ruleConfig.returnPoints : 30000;

        // 合計スコア一覧を先頭に表示
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'score-summary';
        summaryDiv.style.cssText = 'margin-bottom: var(--spacing-xl); padding: var(--spacing-lg); background: var(--color-surface); border-radius: var(--radius-lg); border: 1px solid var(--color-border);';

        let summaryHtml = '<h3 style="margin-bottom: var(--spacing-md);">📊 現在の合計スコア</h3>';
        summaryHtml += '<p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--spacing-md);">※流局の場合、この順位で確定します</p>';
        summaryHtml += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--spacing-sm);">';

        // 順位順にソート
        const sortedResults = [...results].sort((a, b) => b.projectedTotalScore - a.projectedTotalScore);

        sortedResults.forEach((result, index) => {
            const rank = index + 1;
            const rankBadge = this.getRankBadgeClass(rank);
            const totalDiff = (result.projectedTotalScore - returnPoints) / 1000;
            const scoreDiff = (result.currentScore - returnPoints) / 1000;
            summaryHtml += `
                <div style="padding: var(--spacing-sm); background: var(--color-background); border-radius: var(--radius-md); text-align: center;">
                    <div style="font-weight: 600; margin-bottom: var(--spacing-xs); font-size: var(--font-size-sm);">
                        ${result.playerName} <span class="badge ${rankBadge}">${rank}位</span>
                    </div>
                    <div style="font-size: var(--font-size-lg); font-weight: 700; color: var(--color-primary); margin: var(--spacing-xs) 0;">
                        ${totalDiff > 0 ? '+' : ''}${totalDiff.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </div>
                    <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                        3回戦: ${(result.round3TotalScore / 1000).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<br>
                        オーラス: ${scoreDiff > 0 ? '+' : ''}${scoreDiff.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<br>
                        順位点: ${result.rankPoint > 0 ? '+' : ''}${(result.rankPoint / 1000).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </div>
                </div>
            `;
        });

        summaryHtml += '</div>';
        summaryDiv.innerHTML = summaryHtml;
        container.appendChild(summaryDiv);

        results.forEach((playerResult, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-result fade-in';
            const accordionId = `player-body-${index}`;

            // ヘッダー（アコーディオン）
            let html = `
        <div class="player-accordion" onclick="App.toggleAccordion('${accordionId}', this)">
          <div>
            <h3 style="margin-bottom: 0;">${playerResult.playerName} 
              <span class="badge ${this.getRankBadgeClass(playerResult.currentRank)}">
                現在${playerResult.currentRank}位
              </span>
              ${playerResult.isDealer ? '<span class="badge badge-warning">親</span>' : ''}
            </h3>
            <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); margin-top: var(--spacing-xs);">
              現在スコア: ${playerResult.currentScore.toLocaleString()}点
            </p>
          </div>
          <span class="accordion-arrow">▶</span>
        </div>
        <div class="player-body" id="${accordionId}">
      `;

            // 1位になる条件
            const toFirstPossible = playerResult.conditions.toFirst && playerResult.conditions.toFirst.possible;
            html += this.formatCondition('🥇 1位になる条件', playerResult.conditions.toFirst, playerResult.currentTotals, toFirstPossible);

            // 3位→2位の条件
            if (playerResult.currentRank === 3) {
                const possible = playerResult.conditions.fromThirdToSecond && playerResult.conditions.fromThirdToSecond.possible;
                html += this.formatCondition('🥈 2位になる条件', playerResult.conditions.fromThirdToSecond, playerResult.currentTotals, possible);
            }

            // 4位→2位の条件
            if (playerResult.currentRank === 4) {
                const possible = playerResult.conditions.fromFourthToSecond && playerResult.conditions.fromFourthToSecond.possible;
                html += this.formatCondition('🥈 2位になる条件', playerResult.conditions.fromFourthToSecond, playerResult.currentTotals, possible);
            }

            // 放銃限度（1位・2位のプレイヤーのみ表示）
            if (playerResult.currentRank <= 2) {
                const ronLimit = ronLimits.find(r => r.playerIndex === playerResult.playerIndex);
                if (ronLimit) {
                    html += this.formatRonLimit(ronLimit.limits);
                }

                // ツモられ限度
                const tsumoLimit = tsumoLimits.find(r => r.playerIndex === playerResult.playerIndex);
                if (tsumoLimit) {
                    html += this.formatTsumoLimit(tsumoLimit.limits);
                }
            }

            // テンパイ料シミュレーション（全プレイヤーに表示）
            const tenpaiScenario = tenpaiScenarios.find(r => r.playerIndex === playerResult.playerIndex);
            if (tenpaiScenario) {
                html += this.formatTenpaiScenarios(tenpaiScenario.scenarios);
            }

            html += '</div>'; // player-body閉じ

            playerDiv.innerHTML = html;
            container.appendChild(playerDiv);
        });
    },

    /**
     * 条件をフォーマット
     */
    formatCondition(title, condition, currentTotals, isHighlight = false) {
        if (!condition || !condition.possible) {
            return `
        <div class="condition-item condition-impossible">
          <h4>${title}</h4>
          <p>${(condition && condition.reason) || '達成不可能'}</p>
        </div>
      `;
        }

        const highlightClass = isHighlight ? ' condition-highlight' : '';
        let html = `
      <div class="condition-item${highlightClass}">
        <h4>${title}</h4>
    `;

        // ツモ条件
        const tsumo = condition.tsumo;
        if (tsumo && tsumo.possible) {
            const detailId = `detail-${this.detailCounter++}`;
            let tsumoText = `<strong>ツモ:</strong> ${tsumo.description}`;
            if (tsumo.payment) {
                if (tsumo.payment.allPayment) {
                    tsumoText += ` (${tsumo.payment.allPayment.toLocaleString()}点オール)`;
                } else {
                    tsumoText += ` (子${tsumo.payment.koPayment.toLocaleString()}点/親${tsumo.payment.oyaPayment.toLocaleString()}点)`;
                }
            }
            html += `<div class="detail-toggle" onclick="App.toggleDetail('${detailId}')">
              <p>${tsumoText} <span class="detail-arrow" id="arrow-${detailId}">▶</span></p>
            </div>`;
            html += `<div class="detail-panel" id="${detailId}">`;
            const tsumoDetail = this.formatSimulationDetail(tsumo.simulationDetail, currentTotals);
            html += tsumoDetail || '<p style="color:var(--color-warning); padding: var(--spacing-sm);">詳細データなし</p>';
            html += `</div>`;
        } else if (tsumo) {
            html += `<p><strong>ツモ:</strong> ${tsumo.reason || '達成不可'}</p>`;
        }

        // ロン条件（放銃者ごとに異なる条件）
        if (condition.ron && condition.ron.length > 0) {
            html += `<p style="margin-top: var(--spacing-sm);"><strong>ロン:</strong></p>`;
            condition.ron.forEach(ronCond => {
                const fromPlayer = this.gameState.players[ronCond.fromPlayerIndex];
                if (ronCond.possible) {
                    const detailId = `detail-${this.detailCounter++}`;
                    html += `<div class="detail-toggle" onclick="App.toggleDetail('${detailId}')" style="margin-left: var(--spacing-md);">
                      <p style="font-size: var(--font-size-sm);">
                        ${fromPlayer}から: ${ronCond.description} (${ronCond.score.toLocaleString()}点)
                        <span class="detail-arrow" id="arrow-${detailId}">▶</span>
                      </p>
                    </div>`;
                    html += `<div class="detail-panel" id="${detailId}" style="margin-left: var(--spacing-md);">`;
                    const ronDetail = this.formatSimulationDetail(ronCond.simulationDetail, currentTotals);
                    html += ronDetail || '<p style="color:var(--color-warning); padding: var(--spacing-sm);">詳細データなし</p>';
                    html += `</div>`;
                } else {
                    html += `<p style="margin-left: var(--spacing-md); font-size: var(--font-size-sm); color: var(--color-text-secondary);">
            ${fromPlayer}から: ${ronCond.reason || '達成不可'}
          </p>`;
                }
            });
        }

        html += `</div>`;
        return html;
    },

    /**
     * 詳細パネルの開閉
     */
    toggleDetail(detailId) {
        const panel = document.getElementById(detailId);
        const arrow = document.getElementById(`arrow-${detailId}`);
        console.log('toggleDetail:', detailId, 'panel:', panel, 'innerHTML length:', panel ? panel.innerHTML.length : 0);
        if (panel) {
            const isOpen = panel.classList.toggle('open');
            if (arrow) {
                arrow.textContent = isOpen ? '▼' : '▶';
            }
        }
    },

    /**
     * シミュレーション詳細をフォーマット
     */
    formatSimulationDetail(outcome, currentTotals) {
        console.log('formatSimulationDetail called:', 'outcome:', outcome, 'currentTotals:', currentTotals);
        if (!outcome || !currentTotals) {
            console.log('formatSimulationDetail: データなし', 'outcome:', !!outcome, 'currentTotals:', !!currentTotals);
            return '';
        }

        const players = this.gameState.players;

        // 和了後の順位を計算
        const afterSorted = [...outcome].sort((a, b) => b.total - a.total);
        const afterRanks = {};
        afterSorted.forEach((o, idx) => { afterRanks[o.playerIndex] = idx + 1; });

        // 和了前の順位を計算
        const beforeSorted = [...currentTotals].sort((a, b) => b.total - a.total);
        const beforeRanks = {};
        beforeSorted.forEach((o, idx) => { beforeRanks[o.playerIndex] = idx + 1; });

        let html = `<table class="detail-table">`;
        html += `<thead><tr>
          <th></th>
          <th>順位</th>
          <th>順位点</th>
          <th>合計</th>
        </tr></thead><tbody>`;

        for (let i = 0; i < 4; i++) {
            const before = currentTotals[i];
            const after = outcome[i];
            const rankBefore = beforeRanks[i];
            const rankAfter = afterRanks[i];
            const rankChanged = rankBefore !== rankAfter;
            const totalDiff = after.total - before.total;
            const rankPointDiff = after.rankPoint - before.rankPoint;

            const rankArrow = rankChanged
                ? (rankAfter < rankBefore ? `<span style="color:var(--color-success);"> ↑${rankBefore}→${rankAfter}</span>`
                    : `<span style="color:var(--color-danger);"> ↓${rankBefore}→${rankAfter}</span>`)
                : `${rankAfter}位`;

            const formatDiff = (val) => {
                const v = val / 1000;
                if (v > 0) return `<span style="color:var(--color-success);">+${v.toFixed(1)}</span>`;
                if (v < 0) return `<span style="color:var(--color-danger);">${v.toFixed(1)}</span>`;
                return '±0';
            };

            html += `<tr${rankChanged ? ' class="rank-changed"' : ''}>
              <td class="player-name-cell">${players[i]}</td>
              <td>${rankArrow}</td>
              <td>${formatDiff(rankPointDiff)}</td>
              <td>${((after.total - 30000) / 1000).toFixed(1)} (${formatDiff(totalDiff)})</td>
            </tr>`;
        }

        html += `</tbody></table>`;
        return html;
    },

    /**
     * 放銃限度をフォーマット（2位以内で勝ち上がれる最大放銃点数）
     * 符翻表記（70符まで）＋積み棒込みの実際の支払額を括弧表示
     */
    formatRonLimit(limits) {
        const honbaSticks = this.gameState.honbaSticks || 0;
        const honbaBonus = honbaSticks * 300;
        const honbaLabel = honbaSticks > 0 ? `（${honbaSticks}本場）` : '';

        let html = `
      <div class="condition-item" style="border-left: 3px solid var(--color-warning, #f59e0b);">
        <h4>🛡️ 放銃限度${honbaLabel}（2位以内で勝ち上がれる条件）</h4>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--spacing-sm);">誰に何点まで放銃しても2位以内を維持できるか</p>
    `;

        limits.forEach(limit => {
            const winnerName = this.gameState.players[limit.winnerIndex];
            const yakumanScore = limit.winnerIsDealer ? 48000 : 32000;

            if (!limit.canSurvive) {
                html += `<p style="font-size: var(--font-size-sm); color: var(--color-danger, #ef4444);">
          ${winnerName}への放銃: 現状すでに3位以下（放銃不可）
        </p>`;
            } else if (limit.maxAllowed === 0) {
                html += `<p style="font-size: var(--font-size-sm); color: var(--color-danger, #ef4444);">
          ${winnerName}への放銃: 1点でも放銃すると3位以下
        </p>`;
            } else if (limit.maxAllowed >= yakumanScore) {
                const totalWithHonba = yakumanScore + honbaBonus;
                const honbaText = honbaSticks > 0 ? `（実際${totalWithHonba.toLocaleString()}点）` : '';
                html += `<p style="font-size: var(--font-size-sm); color: var(--color-success, #22c55e);">
          ${winnerName}への放銃: 役満（${yakumanScore.toLocaleString()}点）でも2位以内 ✓ ${honbaText}
        </p>`;
            } else {
                // maxAllowed以下の最大ロン点を符翻で逆引き
                const hand = ScoreTable.findMaxRonHand(
                    limit.maxAllowed,
                    limit.winnerIsDealer,
                    limit.rule || 'official'
                );

                if (hand) {
                    const actualPayment = hand.score + honbaBonus;
                    const honbaText = honbaSticks > 0
                        ? `（<strong>${actualPayment.toLocaleString()}点</strong>）`
                        : '';
                    html += `<p style="font-size: var(--font-size-sm);">
          ${winnerName}への放銃: <strong>${hand.description} ${hand.score.toLocaleString()}点</strong>${honbaText}まで2位以内
        </p>`;
                } else {
                    // 符翻表記に該当する手がない場合（非常に小さい点数）
                    const totalWithHonba = limit.maxAllowed + honbaBonus;
                    const honbaText = honbaSticks > 0
                        ? `（実際${totalWithHonba.toLocaleString()}点）`
                        : '';
                    html += `<p style="font-size: var(--font-size-sm);">
          ${winnerName}への放銃: <strong>${limit.maxAllowed.toLocaleString()}点まで</strong>${honbaText}なら2位以内
        </p>`;
                }
            }
        });

        html += `</div>`;
        return html;
    },

    /**
     * ツモられ限度をフォーマット（他家ツモ時に2位以内を維持できる条件）
     */
    formatTsumoLimit(limits) {
        const honbaSticks = this.gameState.honbaSticks || 0;
        const honbaLabel = honbaSticks > 0 ? `（${honbaSticks}本場）` : '';

        let html = `
      <div class="condition-item" style="border-left: 3px solid var(--color-secondary, #06b6d4);">
        <h4>⚡ ツモられ限度${honbaLabel}（2位以内を維持できる条件）</h4>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--spacing-sm);">他家にツモられても2位以内を維持できるか</p>
    `;

        limits.forEach(limit => {
            const winnerName = this.gameState.players[limit.winnerIndex];

            if (limit.safe) {
                // 役満ツモでも安全
                html += `<p style="font-size: var(--font-size-sm); color: var(--color-success, #22c55e);">
          ${winnerName}のツモ: 役満ツモでも2位以内 ✓
        </p>`;
            } else if (!limit.maxSafe) {
                // どんなツモでもアウト
                html += `<p style="font-size: var(--font-size-sm); color: var(--color-danger, #ef4444);">
          ${winnerName}のツモ: ツモられると3位以下
        </p>`;
            } else {
                // 境界がある
                const safe = limit.maxSafe;
                let paymentText = '';
                if (safe.payment.allPayment) {
                    const base = safe.payment.allPayment;
                    const withHonba = base + (honbaSticks * 100);
                    paymentText = honbaSticks > 0
                        ? ` ${base.toLocaleString()}点All（${withHonba.toLocaleString()}点All）`
                        : ` ${base.toLocaleString()}点All`;
                } else {
                    const ko = safe.payment.koPayment;
                    const oya = safe.payment.oyaPayment;
                    const koH = ko + (honbaSticks * 100);
                    const oyaH = oya + (honbaSticks * 100);
                    paymentText = honbaSticks > 0
                        ? ` ${ko.toLocaleString()}/${oya.toLocaleString()}（${koH.toLocaleString()}/${oyaH.toLocaleString()}）`
                        : ` ${ko.toLocaleString()}/${oya.toLocaleString()}`;
                }
                html += `<p style="font-size: var(--font-size-sm);">
          ${winnerName}のツモ: <strong>${safe.description}${paymentText}</strong>まで2位以内
        </p>`;
            }
        });

        html += `</div>`;
        return html;
    },

    /**
     * 入力データをlocalStorageに保存
     */
    saveToLocalStorage() {
        try {
            const data = {
                rule: this.selectedRule,
                players: this.gameState.players,
                round3TotalScores: this.gameState.round3TotalScores.map(s => s / 1000),
                currentScores: this.gameState.currentScores,
                dealerIndex: this.gameState.dealerIndex,
                riichiSticks: this.gameState.riichiSticks,
                honbaSticks: this.gameState.honbaSticks
            };
            localStorage.setItem('mahjong-calc-data', JSON.stringify(data));
            console.log('localStorageに保存完了');
        } catch (e) {
            console.log('localStorage保存エラー:', e);
        }
    },

    /**
     * localStorageから入力データを復元
     */
    loadFromLocalStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('mahjong-calc-data'));
            if (!data) return;

            // ルール復元
            if (data.rule) {
                this.selectRule(data.rule);
            }

            // プレイヤー名復元
            if (data.players) {
                const defaultNames = ['東家', '南家', '西家', '北家'];
                for (let i = 0; i < 4; i++) {
                    const input = document.getElementById(`player-${i}-name`);
                    if (input && data.players[i] && data.players[i] !== defaultNames[i]) {
                        input.value = data.players[i];
                        this.gameState.players[i] = data.players[i];
                    }
                }
                this.updateDealerLabels();
            }

            // 3回戦累計スコア復元
            if (data.round3TotalScores) {
                for (let i = 0; i < 4; i++) {
                    const input = document.getElementById(`round3-total-player${i}`);
                    if (input) input.value = data.round3TotalScores[i];
                }
            }

            // オーラススコア復元
            if (data.currentScores) {
                for (let i = 0; i < 4; i++) {
                    const input = document.getElementById(`current-player${i}`);
                    if (input && data.currentScores[i]) input.value = data.currentScores[i];
                }
            }

            // 親の位置復元
            if (data.dealerIndex !== undefined) {
                const radio = document.querySelector(`input[name="dealer"][value="${data.dealerIndex}"]`);
                if (radio) radio.checked = true;
            }

            // 立直棒・積み棒復元
            if (data.riichiSticks !== undefined) {
                document.getElementById('riichi-sticks').value = data.riichiSticks;
            }
            if (data.honbaSticks !== undefined) {
                document.getElementById('honba-sticks').value = data.honbaSticks;
            }

            console.log('localStorageから復元完了:', data);
        } catch (e) {
            console.log('localStorage読み込みエラー:', e);
        }
    },

    /**
     * 親ラベルをプレイヤー名に連動更新
     */
    updateDealerLabels() {
        const defaultNames = ['東家', '南家', '西家', '北家'];
        for (let i = 0; i < 4; i++) {
            const nameInput = document.getElementById(`player-${i}-name`);
            const name = (nameInput && nameInput.value.trim()) || defaultNames[i];
            const radio = document.querySelector(`input[name="dealer"][value="${i}"]`);
            if (radio && radio.parentElement) {
                // ラベル内のテキストノードを更新
                const label = radio.parentElement;
                const textNodes = Array.from(label.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
                if (textNodes.length > 0) {
                    textNodes[textNodes.length - 1].textContent = ` ${name}`;
                }
            }
        }
    },

    /**
     * スコア合計インジケーターの更新
     */
    updateScoreIndicator() {
        const indicator = document.getElementById('score-total-indicator');
        if (!indicator) return;

        const ruleConfig = this.selectedRule ? MahjongRules[this.selectedRule] : null;
        const startingPoints = ruleConfig ? ruleConfig.startingPoints : 30000;
        const totalPoints = startingPoints * 4;

        let playerTotal = 0;
        for (let i = 0; i < 4; i++) {
            playerTotal += parseInt(document.getElementById(`current-player${i}`).value) || 0;
        }
        const riichiSticks = parseInt(document.getElementById('riichi-sticks').value) || 0;
        const actualTotal = playerTotal + riichiSticks * 1000;

        indicator.classList.remove('match', 'mismatch', 'error');

        if (actualTotal === totalPoints) {
            indicator.className = 'score-total-indicator match';
            indicator.textContent = `✅ 合計 ${totalPoints.toLocaleString()}点 OK`;
        } else {
            const diff = actualTotal - totalPoints;
            const diffStr = diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString();
            indicator.className = 'score-total-indicator mismatch';
            indicator.textContent = `⚠️ 合計 ${actualTotal.toLocaleString()} / ${totalPoints.toLocaleString()}点（${diffStr}）`;
        }
    },

    /**
     * 対局履歴を保存
     */
    saveHistory(results) {
        try {
            const history = JSON.parse(localStorage.getItem('mahjong-calc-history') || '[]');

            const ruleConfig = MahjongRules[this.gameState.rule];
            const returnPoints = ruleConfig ? ruleConfig.returnPoints : 30000;
            const sorted = [...results].sort((a, b) => b.projectedTotalScore - a.projectedTotalScore);

            const entry = {
                id: Date.now(),
                date: new Date().toISOString(),
                rule: this.gameState.rule,
                ruleName: ruleConfig ? ruleConfig.name : '不明',
                players: sorted.map((r, i) => ({
                    name: r.playerName,
                    rank: i + 1,
                    score: r.currentScore,
                    totalDiff: ((r.projectedTotalScore - returnPoints) / 1000)
                })),
                gameState: { ...this.gameState }
            };

            history.unshift(entry);
            // 最大50件保持
            if (history.length > 50) history.length = 50;

            localStorage.setItem('mahjong-calc-history', JSON.stringify(history));
        } catch (e) {
            console.error('履歴保存エラー:', e);
        }
    },

    /**
     * 対局履歴画面を表示
     */
    showHistory() {
        const container = document.getElementById('history-container');
        const history = JSON.parse(localStorage.getItem('mahjong-calc-history') || '[]');

        if (history.length === 0) {
            container.innerHTML = '<div class="history-empty">📭 まだ対局履歴がありません</div>';
        } else {
            let html = '';
            history.forEach((entry, i) => {
                const date = new Date(entry.date);
                const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

                html += `<div class="history-item" onclick="App.reloadHistory(${i})">`;
                html += `<button class="history-delete-btn" onclick="event.stopPropagation(); App.deleteHistoryItem(${entry.id})" title="削除">✕</button>`;
                html += `<div class="history-item-header">`;
                html += `<span class="history-item-date">${dateStr}</span>`;
                html += `<span class="history-item-rule">${entry.ruleName}</span>`;
                html += `</div>`;
                html += `<div class="history-item-scores">`;

                entry.players.forEach(p => {
                    const cls = p.totalDiff >= 0 ? 'score-positive' : 'score-negative';
                    const sign = p.totalDiff >= 0 ? '+' : '';
                    html += `<div>
                        <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">${p.name}</div>
                        <div class="${cls}">${sign}${p.totalDiff.toFixed(1)}</div>
                    </div>`;
                });

                html += `</div></div>`;
            });
            container.innerHTML = html;
        }

        // 全削除ボタンの表示制御
        const clearBtn = document.getElementById('clear-history-btn');
        if (clearBtn) clearBtn.style.display = history.length > 0 ? '' : 'none';

        this.showScreen('history');
    },

    /**
     * 履歴から入力データを復元
     */
    reloadHistory(index) {
        try {
            const history = JSON.parse(localStorage.getItem('mahjong-calc-history') || '[]');
            const entry = history[index];
            if (!entry || !entry.gameState) return;

            const gs = entry.gameState;

            // ルール選択
            if (gs.rule) this.selectRule(gs.rule);

            // プレイヤー名復元
            const defaultNames = ['東家', '南家', '西家', '北家'];
            for (let i = 0; i < 4; i++) {
                const input = document.getElementById(`player-${i}-name`);
                if (input && gs.players[i]) {
                    input.value = gs.players[i] !== defaultNames[i] ? gs.players[i] : '';
                    this.gameState.players[i] = gs.players[i];
                }
            }
            this.updateDealerLabels();

            // スコア復元
            if (gs.round3TotalScores) {
                for (let i = 0; i < 4; i++) {
                    const input = document.getElementById(`round3-total-player${i}`);
                    if (input) input.value = gs.round3TotalScores[i];
                }
            }
            if (gs.currentScores) {
                for (let i = 0; i < 4; i++) {
                    const input = document.getElementById(`current-player${i}`);
                    if (input) input.value = gs.currentScores[i];
                }
            }

            // 親・棒復元
            if (gs.dealerIndex !== undefined) {
                const radio = document.querySelector(`input[name="dealer"][value="${gs.dealerIndex}"]`);
                if (radio) radio.checked = true;
            }
            if (gs.riichiSticks !== undefined) document.getElementById('riichi-sticks').value = gs.riichiSticks;
            if (gs.honbaSticks !== undefined) document.getElementById('honba-sticks').value = gs.honbaSticks;

            this.showScreen('score-input');
            this.updateScoreIndicator();
        } catch (e) {
            console.error('履歴復元エラー:', e);
        }
    },

    /**
     * 履歴を1件削除
     */
    deleteHistoryItem(id) {
        try {
            let history = JSON.parse(localStorage.getItem('mahjong-calc-history') || '[]');
            history = history.filter(e => e.id !== id);
            localStorage.setItem('mahjong-calc-history', JSON.stringify(history));
            this.showHistory();
        } catch (e) {
            console.error('履歴削除エラー:', e);
        }
    },

    /**
     * 全履歴削除
     */
    clearHistory() {
        if (!confirm('すべての対局履歴を削除しますか？')) return;
        localStorage.removeItem('mahjong-calc-history');
        this.showHistory();
    },

    // ==========================================
    // カスタムルール設定
    // ==========================================

    /**
     * カスタムルール設定の更新
     */
    updateCustomRule() {
        const starting = parseInt(document.getElementById('custom-starting').value) || 25000;
        const returnPts = parseInt(document.getElementById('custom-return').value) || 30000;
        const uma1 = parseFloat(document.getElementById('custom-uma-1').value) || 0;
        const uma2 = parseFloat(document.getElementById('custom-uma-2').value) || 0;
        const uma3 = parseFloat(document.getElementById('custom-uma-3').value) || 0;
        const uma4 = parseFloat(document.getElementById('custom-uma-4').value) || 0;
        const oka = parseFloat(document.getElementById('custom-oka').value) || 0;
        const riichiOnDraw = document.getElementById('custom-riichi-on-draw').value || 'first';

        MahjongRules.custom.startingPoints = starting;
        MahjongRules.custom.returnPoints = returnPts;
        MahjongRules.custom.uma = { 1: uma1, 2: uma2, 3: uma3, 4: uma4 };
        MahjongRules.custom.oka = oka;
        MahjongRules.custom.riichiOnDraw = riichiOnDraw;

        // オーラススコアのデフォルト値も更新
        if (this.selectedRule === 'custom') {
            for (let i = 0; i < 4; i++) {
                const input = document.getElementById(`current-player${i}`);
                const currentVal = parseInt(input.value) || 0;
                if (currentVal === 30000 || currentVal === 25000 || currentVal === 0) {
                    input.value = starting;
                }
            }
        }

        // localStorageに保存
        this.saveCustomRuleConfig();
    },

    /**
     * カスタムルール設定を保存
     */
    saveCustomRuleConfig() {
        const config = {
            startingPoints: MahjongRules.custom.startingPoints,
            returnPoints: MahjongRules.custom.returnPoints,
            uma: MahjongRules.custom.uma,
            oka: MahjongRules.custom.oka,
            riichiOnDraw: MahjongRules.custom.riichiOnDraw
        };
        localStorage.setItem('mahjong-custom-rule', JSON.stringify(config));
    },

    /**
     * カスタムルール設定を読み込み
     */
    loadCustomRuleConfig() {
        try {
            const config = JSON.parse(localStorage.getItem('mahjong-custom-rule'));
            if (!config) return;

            MahjongRules.custom.startingPoints = config.startingPoints;
            MahjongRules.custom.returnPoints = config.returnPoints;
            MahjongRules.custom.uma = config.uma;
            MahjongRules.custom.oka = config.oka;
            MahjongRules.custom.riichiOnDraw = config.riichiOnDraw || 'first';

            // UIに反映
            document.getElementById('custom-starting').value = config.startingPoints;
            document.getElementById('custom-return').value = config.returnPoints;
            document.getElementById('custom-uma-1').value = config.uma[1];
            document.getElementById('custom-uma-2').value = config.uma[2];
            document.getElementById('custom-uma-3').value = config.uma[3];
            document.getElementById('custom-uma-4').value = config.uma[4];
            document.getElementById('custom-oka').value = config.oka;
            document.getElementById('custom-riichi-on-draw').value = config.riichiOnDraw || 'first';
        } catch (e) {
            console.error('カスタムルール読込エラー:', e);
        }
    },

    /**
     * 履歴をCSVでエクスポート
     */
    exportHistoryCSV() {
        const history = JSON.parse(localStorage.getItem('mahjong-calc-history') || '[]');
        if (history.length === 0) {
            alert('エクスポートする履歴がありません。');
            return;
        }

        // ヘッダー行
        const headers = ['日時', 'ルール', '1位名前', '1位スコア', '2位名前', '2位スコア', '3位名前', '3位スコア', '4位名前', '4位スコア'];
        const rows = [headers.join(',')];

        history.forEach(entry => {
            const date = new Date(entry.date);
            const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

            const cols = [dateStr, entry.ruleName];
            entry.players.forEach(p => {
                const sign = p.totalDiff >= 0 ? '+' : '';
                cols.push(p.name);
                cols.push(`${sign}${p.totalDiff.toFixed(1)}`);
            });

            rows.push(cols.join(','));
        });

        const csv = '\uFEFF' + rows.join('\n'); // BOM付きUTF-8
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        const now = new Date();
        const filename = `麻雀履歴_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`;
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    /**
     * テーマ切替
     */
    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', newTheme);

        const toggleBtn = document.getElementById('theme-toggle');
        toggleBtn.textContent = newTheme === 'light' ? '☀️' : '🌙';

        localStorage.setItem('mahjong-calc-theme', newTheme);
    },

    /**
     * テーマ読み込み
     */
    loadTheme() {
        const savedTheme = localStorage.getItem('mahjong-calc-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);

        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = savedTheme === 'light' ? '☀️' : '🌙';
        }
    },

    /**
     * プレイヤーアコーディオン開閉
     */
    toggleAccordion(bodyId, headerEl) {
        const body = document.getElementById(bodyId);
        if (body) {
            body.classList.toggle('open');
            headerEl.classList.toggle('open');
        }
    },

    /**
     * 共有用テキストを生成
     */
    generateShareText() {
        if (!this.lastResults) return '';

        const ruleConfig = MahjongRules[this.gameState.rule];
        const returnPoints = ruleConfig ? ruleConfig.returnPoints : 30000;
        const sorted = [...this.lastResults].sort((a, b) => b.projectedTotalScore - a.projectedTotalScore);

        let text = `🀄 ${ruleConfig ? ruleConfig.name : 'ルール不明'}\n`;
        text += `━━━━━━━━━━━━━━\n`;

        sorted.forEach((r, i) => {
            const rank = i + 1;
            const medal = ['🥇', '🥈', '🥉', ''][rank - 1] || '';
            const totalDiff = (r.projectedTotalScore - returnPoints) / 1000;
            const sign = totalDiff > 0 ? '+' : '';
            text += `${medal} ${rank}位 ${r.playerName}  ${sign}${totalDiff.toFixed(1)}\n`;
        });

        text += `━━━━━━━━━━━━━━\n`;

        // 各プレイヤーの主要条件を追加
        this.lastResults.forEach(r => {
            const cond = r.conditions.toFirst;
            if (cond && cond.possible && r.currentRank > 1) {
                const ronMin = cond.ron ? cond.ron.minScore : null;
                const tsumoMin = cond.tsumo ? cond.tsumo.minScore : null;
                let condText = `${r.playerName}→1位: `;
                if (ronMin) condText += `ロン${ronMin.toLocaleString()}点〜`;
                if (tsumoMin) condText += ` ツモ${tsumoMin.toLocaleString()}点〜`;
                text += condText + '\n';
            }
        });

        return text.trim();
    },

    /**
     * 結果をクリップボードにコピー
     */
    copyResultsToClipboard() {
        const text = this.generateShareText();
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('copy-results-btn');
            const original = btn.textContent;
            btn.textContent = '✅ コピーしました！';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = original;
                btn.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            // fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            const btn = document.getElementById('copy-results-btn');
            const original = btn.textContent;
            btn.textContent = '✅ コピーしました！';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = original;
                btn.classList.remove('copied');
            }, 2000);
        });
    },

    /**
     * LINEで結果を共有
     */
    shareToLINE() {
        const text = this.generateShareText();
        if (!text) return;

        const encoded = encodeURIComponent(text);
        const lineUrl = `https://line.me/R/share?text=${encoded}`;
        window.open(lineUrl, '_blank');
    },

    /**
     * テンパイ料シミュレーション結果をフォーマット
     */
    formatTenpaiScenarios(scenarios) {
        const { currentRank, notenScenarios, tenpaiScenarios } = scenarios;

        // 順位変動があるシナリオのみに絞り込み
        const notenDanger = notenScenarios.filter(s => s.worsened);
        const notenChance = notenScenarios.filter(s => s.improved);
        const tenpaiDanger = tenpaiScenarios.filter(s => s.worsened);
        const tenpaiChance = tenpaiScenarios.filter(s => s.improved);

        // 順位変動がまったくなければ簡略表示
        const hasAnyChange = notenDanger.length > 0 || notenChance.length > 0 ||
            tenpaiDanger.length > 0 || tenpaiChance.length > 0;
        const ruleConfig = MahjongRules[this.gameState.rule];
        const riichiOnDraw = ruleConfig.riichiOnDraw || 'kyoutaku';
        const riichiSticks = this.gameState.riichiSticks || 0;
        const riichiNote = riichiSticks > 0
            ? (riichiOnDraw === 'first'
                ? `<br>📍 立直棒${riichiSticks}本（${riichiSticks * 1000}点）→ 1位が総取り`
                : `<br>📍 立直棒${riichiSticks}本（${riichiSticks * 1000}点）→ 供託（場に残る）`)
            : '';

        let html = `
      <div class="condition-item" style="border-left: 3px solid var(--color-info, #8b5cf6);">
        <h4>🏁 流局時テンパイ料シミュレーション</h4>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--spacing-sm);">テンパイ/ノーテンの組み合わせで順位がどう変動するか${riichiNote}</p>
    `;

        if (!hasAnyChange) {
            html += `<p style="font-size: var(--font-size-sm); color: var(--color-success, #22c55e);">
              ✅ どのテンパイ組み合わせでも順位変動なし（${currentRank}位のまま）
            </p>`;
            html += `</div>`;
            return html;
        }

        // --- 自分がノーテンの場合 ---
        html += `<div style="margin-bottom: var(--spacing-md);">`;
        html += `<p style="font-weight: 600; font-size: var(--font-size-sm); margin-bottom: var(--spacing-xs);">📌 自分がノーテンの場合：</p>`;

        if (notenDanger.length === 0 && notenChance.length === 0) {
            html += `<p style="font-size: var(--font-size-sm); color: var(--color-success, #22c55e); margin-left: var(--spacing-md);">
              ✅ どのパターンでも${currentRank}位維持
            </p>`;
        } else {
            // 全8パターンを表示
            notenScenarios.forEach(s => {
                const label = s.otherTenpaiNames.length === 0
                    ? '全員ノーテン'
                    : `${s.otherTenpaiNames.join('・')}がテンパイ`;

                if (s.worsened) {
                    html += `<p style="font-size: var(--font-size-sm); color: var(--color-danger, #ef4444); margin-left: var(--spacing-md);">
                      ⚠️ ${label} → <strong>${s.resultRank}位に転落</strong>
                    </p>`;
                } else if (s.improved) {
                    html += `<p style="font-size: var(--font-size-sm); color: var(--color-success, #22c55e); margin-left: var(--spacing-md);">
                      🎉 ${label} → <strong>${s.resultRank}位に浮上！</strong>
                    </p>`;
                } else {
                    html += `<p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-left: var(--spacing-md);">
                      ✅ ${label} → ${s.resultRank}位維持
                    </p>`;
                }
            });
        }
        html += `</div>`;

        // --- 自分がテンパイの場合 ---
        html += `<div>`;
        html += `<p style="font-weight: 600; font-size: var(--font-size-sm); margin-bottom: var(--spacing-xs);">📌 自分がテンパイの場合：</p>`;

        if (tenpaiDanger.length === 0 && tenpaiChance.length === 0) {
            html += `<p style="font-size: var(--font-size-sm); color: var(--color-success, #22c55e); margin-left: var(--spacing-md);">
              ✅ どのパターンでも${currentRank}位維持
            </p>`;
        } else {
            tenpaiScenarios.forEach(s => {
                const label = s.otherTenpaiNames.length === 0
                    ? '他家全員ノーテン'
                    : `${s.otherTenpaiNames.join('・')}もテンパイ`;

                if (s.worsened) {
                    html += `<p style="font-size: var(--font-size-sm); color: var(--color-danger, #ef4444); margin-left: var(--spacing-md);">
                      ⚠️ ${label} → <strong>${s.resultRank}位に転落</strong>
                    </p>`;
                } else if (s.improved) {
                    html += `<p style="font-size: var(--font-size-sm); color: var(--color-success, #22c55e); margin-left: var(--spacing-md);">
                      🎉 ${label} → <strong>${s.resultRank}位に浮上！</strong>
                    </p>`;
                } else {
                    html += `<p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-left: var(--spacing-md);">
                      ✅ ${label} → ${s.resultRank}位維持
                    </p>`;
                }
            });
        }
        html += `</div>`;

        html += `</div>`;
        return html;
    },

    /**
     * 順位バッジのクラスを取得
     */
    getRankBadgeClass(rank) {
        switch (rank) {
            case 1: return 'badge-success';
            case 2: return 'badge-warning';
            default: return 'badge-danger';
        }
    }
};

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
