/**
 * メインアプリケーションロジック
 */

const App = {
    currentScreen: 'rule-selection',
    selectedRule: null,
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
        this.setupEventListeners();
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
        document.querySelector(`[data-rule="${rule}"]`).classList.add('selected');

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

            // 結果を表示
            this.displayResults(results, ronLimits);
            console.log('結果表示完了');

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
        // オーラススコアの合計チェック
        // 4者の点数合計 + 立直棒×1000 = 120000 であること
        const total = this.gameState.currentScores.reduce((sum, score) => sum + score, 0);
        const riichiTotal = this.gameState.riichiSticks * 1000;
        const expectedPlayerTotal = 120000 - riichiTotal;

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
    displayResults(results, ronLimits) {
        const container = document.getElementById('results-container');
        container.innerHTML = '';

        // 合計スコア一覧を先頭に表示
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'score-summary';
        summaryDiv.style.cssText = 'margin-bottom: var(--spacing-xl); padding: var(--spacing-lg); background: var(--color-surface); border-radius: var(--border-radius); border: 1px solid var(--color-border);';

        let summaryHtml = '<h3 style="margin-bottom: var(--spacing-md);">現在の合計スコア</h3>';
        summaryHtml += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-md);">';

        // 順位順にソート
        const sortedResults = [...results].sort((a, b) => b.projectedTotalScore - a.projectedTotalScore);

        sortedResults.forEach((result, index) => {
            const rank = index + 1;
            const rankBadge = this.getRankBadgeClass(rank);
            summaryHtml += `
                <div style="padding: var(--spacing-md); background: var(--color-background); border-radius: var(--border-radius); text-align: center;">
                    <div style="font-weight: 600; margin-bottom: var(--spacing-xs);">
                        ${result.playerName} <span class="badge ${rankBadge}">${rank}位</span>
                    </div>
                    <div style="font-size: var(--font-size-lg); font-weight: 700; color: var(--color-primary); margin: var(--spacing-xs) 0;">
                        ${((result.projectedTotalScore - 30000) / 1000) > 0 ? '+' : ''}${((result.projectedTotalScore - 30000) / 1000).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </div>
                    <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                        3回戦: ${(result.round3TotalScore / 1000).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<br>
                        オーラス: ${((result.currentScore - 30000) / 1000) > 0 ? '+' : ''}${((result.currentScore - 30000) / 1000).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<br>
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

            let html = `
        <h3>${playerResult.playerName} 
          <span class="badge ${this.getRankBadgeClass(playerResult.currentRank)}">
            現在${playerResult.currentRank}位
          </span>
          ${playerResult.isDealer ? '<span class="badge badge-warning">親</span>' : ''}
        </h3>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-lg);">
          現在スコア: ${playerResult.currentScore.toLocaleString()}点
        </p>
      `;

            // 1位になる条件
            html += this.formatCondition('1位になる条件', playerResult.conditions.toFirst);

            // 3位→2位の条件
            if (playerResult.currentRank === 3) {
                html += this.formatCondition('2位になる条件', playerResult.conditions.fromThirdToSecond);
            }

            // 4位→2位の条件
            if (playerResult.currentRank === 4) {
                html += this.formatCondition('2位になる条件', playerResult.conditions.fromFourthToSecond);
            }

            // 放銃限度（1位・2位のプレイヤーのみ表示）
            if (playerResult.currentRank <= 2) {
                const ronLimit = ronLimits.find(r => r.playerIndex === playerResult.playerIndex);
                if (ronLimit) {
                    html += this.formatRonLimit(ronLimit.limits);
                }
            }

            playerDiv.innerHTML = html;
            container.appendChild(playerDiv);
        });
    },

    /**
     * 条件をフォーマット
     */
    formatCondition(title, condition) {
        if (!condition || !condition.possible) {
            return `
        <div class="condition-item">
          <h4>${title}</h4>
          <p>${(condition && condition.reason) || '達成不可能'}</p>
        </div>
      `;
        }

        let html = `
      <div class="condition-item">
        <h4>${title}</h4>
    `;

        // ツモ条件
        const tsumo = condition.tsumo;
        if (tsumo && tsumo.possible) {
            html += `<p><strong>ツモ:</strong> ${tsumo.description}`;
            if (tsumo.payment) {
                if (tsumo.payment.allPayment) {
                    html += ` (${tsumo.payment.allPayment.toLocaleString()}点オール)`;
                } else {
                    html += ` (子${tsumo.payment.koPayment.toLocaleString()}点/親${tsumo.payment.oyaPayment.toLocaleString()}点)`;
                }
            }
            html += `</p>`;
        } else if (tsumo) {
            html += `<p><strong>ツモ:</strong> ${tsumo.reason || '達成不可'}</p>`;
        }

        // ロン条件（放銃者ごとに異なる条件）
        if (condition.ron && condition.ron.length > 0) {
            html += `<p style="margin-top: var(--spacing-sm);"><strong>ロン:</strong></p>`;
            condition.ron.forEach(ronCond => {
                const fromPlayer = this.gameState.players[ronCond.fromPlayerIndex];
                if (ronCond.possible) {
                    html += `<p style="margin-left: var(--spacing-md); font-size: var(--font-size-sm);">
            ${fromPlayer}から: ${ronCond.description} (${ronCond.score.toLocaleString()}点)
          </p>`;
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
     * 放銃限度をフォーマット（2位以内で勝ち上がれる最大放銃点数）
     */
    formatRonLimit(limits) {
        let html = `
      <div class="condition-item" style="border-left: 3px solid var(--color-warning, #f59e0b);">
        <h4>🛡️ 放銃限度（2位以内で勝ち上がれる条件）</h4>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--spacing-sm);">誰に何点まで放銃しても2位以内を維持できるか</p>
    `;

        limits.forEach(limit => {
            const winnerName = this.gameState.players[limit.winnerIndex];
            if (!limit.canSurvive) {
                html += `<p style="font-size: var(--font-size-sm); color: var(--color-danger, #ef4444);">
          ${winnerName}への放銃: 現状すでに3位以下（放銃不可）
        </p>`;
            } else if (limit.maxAllowed === 0) {
                html += `<p style="font-size: var(--font-size-sm); color: var(--color-danger, #ef4444);">
          ${winnerName}への放銃: 1点でも放銃すると3位以下
        </p>`;
            } else if (limit.maxAllowed >= 32000) {
                html += `<p style="font-size: var(--font-size-sm); color: var(--color-success, #22c55e);">
          ${winnerName}への放銃: 役満（32,000点）でも2位以内 ✓
        </p>`;
            } else {
                html += `<p style="font-size: var(--font-size-sm);">
          ${winnerName}への放銃: <strong>${limit.maxAllowed.toLocaleString()}点まで</strong>なら2位以内
        </p>`;
            }
        });

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
