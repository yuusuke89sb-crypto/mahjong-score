/**
 * 点棒管理アプリ - メインロジック (局自動進行対応)
 */

const Tenbou = {
    // ===== State =====
    state: {
        players: ['プレイヤー1', 'プレイヤー2', 'プレイヤー3', 'プレイヤー4'],
        scores: [25000, 25000, 25000, 25000],
        chips: [20, 20, 20, 20],
        dealerIndex: 0,
        honba: 0,
        kyoutaku: 0,
        startingPoints: 25000,
        returnPoints: 30000,
        uma: [30, 10, -10, -30],
        oka: 20,
        chipEnabled: true,
        chipValue: 500,
        initialChips: 20,
        // Round progression
        gameType: 'hanchan',   // 'tonpu' | 'hanchan'
        currentRound: 0,       // 0=東1, 1=東2, ... 4=南1, ... 7=南4
        tenpaiRenchan: true,
        agariYame: false,
        // History & session
        history: [],
        sessionGames: [],
        currentScreen: 'setup'
    },

    // Manual input state
    manualMode: null,
    selectedWinner: null,
    selectedLoser: null,
    selectedChipFrom: null,
    selectedChipTo: null,

    // ===== Init =====
    init() {
        this.loadTheme();
        this.setupThemeToggle();
        this.setupChipToggle();
        this.setupRuleToggles();
        this.setupInputAutoSelect();
        this.loadState();
    },

    loadTheme() {
        const theme = localStorage.getItem('tenbou-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
    },

    setupThemeToggle() {
        document.getElementById('theme-toggle').addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('tenbou-theme', next);
            document.getElementById('theme-toggle').textContent = next === 'dark' ? '🌙' : '☀️';
        });
    },

    setupChipToggle() {
        const toggle = document.getElementById('setup-chip-enabled');
        const settings = document.getElementById('chip-settings');
        toggle.addEventListener('change', () => {
            settings.classList.toggle('hidden', !toggle.checked);
            toggle.closest('.chip-toggle-group').querySelector('.toggle-label').textContent = toggle.checked ? 'チップあり' : 'チップなし';
        });
        document.getElementById('start-game-btn').addEventListener('click', () => this.startGame());
    },

    setupRuleToggles() {
        const tenpai = document.getElementById('setup-tenpai-renchan');
        tenpai.addEventListener('change', () => {
            document.getElementById('tenpai-renchan-label').textContent = tenpai.checked ? 'テンパイ連荘あり' : 'テンパイ連荘なし';
        });
        const agari = document.getElementById('setup-agari-yame');
        agari.addEventListener('change', () => {
            document.getElementById('agari-yame-label').textContent = agari.checked ? '上がり止めあり' : '上がり止めなし';
        });
    },

    setupInputAutoSelect() {
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('focus', () => input.select());
        });
    },

    selectGameType(type, btn) {
        document.querySelectorAll('.game-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._selectedGameType = type;
    },

    // ===== Screen Management =====
    showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(`${name}-screen`).classList.remove('hidden');
        this.state.currentScreen = name;
        window.scrollTo(0, 0);
    },

    // ===== Round Helpers =====
    getRoundName(round) {
        const winds = ['東', '南'];
        const wind = winds[Math.floor(round / 4)];
        const num = (round % 4) + 1;
        return `${wind}${num}局`;
    },

    getMaxRound() {
        return this.state.gameType === 'tonpu' ? 3 : 7;
    },

    isLastRound() {
        return this.state.currentRound >= this.getMaxRound();
    },

    updateRoundDisplay() {
        const nameEl = document.getElementById('round-name');
        const honbaEl = document.getElementById('round-honba');
        if (nameEl) nameEl.textContent = this.getRoundName(this.state.currentRound);
        if (honbaEl) honbaEl.textContent = `${this.state.honba}本場`;
    },

    // ===== Start Game =====
    startGame() {
        for (let i = 0; i < 4; i++) {
            const val = document.getElementById(`setup-name-${i}`).value.trim();
            if (val) this.state.players[i] = val;
        }

        this.state.startingPoints = parseInt(document.getElementById('setup-starting-points').value) || 25000;
        this.state.returnPoints = parseInt(document.getElementById('setup-return-points').value) || 30000;
        this.state.uma = [
            parseFloat(document.getElementById('setup-uma-1').value) || 0,
            parseFloat(document.getElementById('setup-uma-2').value) || 0,
            parseFloat(document.getElementById('setup-uma-3').value) || 0,
            parseFloat(document.getElementById('setup-uma-4').value) || 0,
        ];
        this.state.oka = parseFloat(document.getElementById('setup-oka').value) || 0;

        this.state.gameType = this._selectedGameType || 'hanchan';
        this.state.tenpaiRenchan = document.getElementById('setup-tenpai-renchan').checked;
        this.state.agariYame = document.getElementById('setup-agari-yame').checked;

        this.state.chipEnabled = document.getElementById('setup-chip-enabled').checked;
        this.state.initialChips = parseInt(document.getElementById('setup-chip-count').value) || 20;
        this.state.chipValue = parseInt(document.getElementById('setup-chip-value').value) || 500;

        for (let i = 0; i < 4; i++) {
            this.state.scores[i] = this.state.startingPoints;
            this.state.chips[i] = this.state.chipEnabled ? this.state.initialChips : 0;
        }
        this.state.currentRound = 0;
        this.state.dealerIndex = 0;
        this.state.honba = 0;
        this.state.kyoutaku = 0;
        this.state.history = [];
        this.state.sessionGames = [];

        const chipBtn = document.getElementById('chip-action-btn');
        if (chipBtn) chipBtn.classList.toggle('hidden', !this.state.chipEnabled);

        this.showScreen('game');
        this.renderPlayers();
        this.renderHistory();
        this.updateRoundDisplay();
        this.saveState();
    },

    // ===== Render =====
    renderPlayers() {
        const grid = document.getElementById('player-grid');
        grid.innerHTML = '';

        for (let i = 0; i < 4; i++) {
            const card = document.createElement('div');
            card.className = 'player-card' + (i === this.state.dealerIndex ? ' is-dealer' : '');
            card.setAttribute('data-wind', i);
            card.setAttribute('data-index', i);
            card.onclick = () => this.onPlayerCardClick(i);

            const diff = this.state.scores[i] - this.state.startingPoints;
            const diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';
            const diffText = diff > 0 ? `+${diff.toLocaleString()}` : diff < 0 ? diff.toLocaleString() : '±0';
            const scoreClass = this.state.scores[i] < 0 ? ' negative' : '';

            let chipHtml = '';
            if (this.state.chipEnabled) {
                const chipDiff = this.state.chips[i] - this.state.initialChips;
                const chipDiffText = chipDiff > 0 ? `(+${chipDiff})` : chipDiff < 0 ? `(${chipDiff})` : '';
                chipHtml = `<div class="player-chips">🎰 ${this.state.chips[i]}枚 ${chipDiffText}</div>`;
            }

            card.innerHTML = `
        <div class="player-name">${this.state.players[i]}</div>
        <div class="player-score${scoreClass}">${this.state.scores[i].toLocaleString()}</div>
        ${chipHtml}
        <div class="player-diff ${diffClass}">${diffText}</div>
      `;
            grid.appendChild(card);
        }

        document.getElementById('honba-display').textContent = this.state.honba;
        document.getElementById('kyoutaku-display').textContent = this.state.kyoutaku.toLocaleString();
        this.updateRoundDisplay();
    },

    renderHistory() {
        const list = document.getElementById('history-list');
        if (this.state.history.length === 0) {
            list.innerHTML = '<p class="history-empty">まだ取引がありません</p>';
            return;
        }
        list.innerHTML = '';
        for (let i = this.state.history.length - 1; i >= 0; i--) {
            const h = this.state.history[i];
            const entry = document.createElement('div');
            entry.className = 'history-entry';
            const typeClass = h.type === 'tsumo' ? 'type-tsumo' : h.type === 'ron' ? 'type-ron' : 'type-chip';
            const typeLabel = h.type === 'tsumo' ? 'ツモ' : h.type === 'ron' ? 'ロン' : h.type === 'ryukyoku' ? '流局' : 'チップ';
            entry.innerHTML = `
        <div class="history-entry-text">
          <span class="history-entry-type ${typeClass}">${typeLabel}</span>
          ${h.description}
        </div>`;
            list.appendChild(entry);
        }
    },

    onPlayerCardClick(index) {
        this.state.dealerIndex = index;
        this.renderPlayers();
        this.saveState();
    },

    // ===== Honba / Kyoutaku =====
    changeHonba(delta) {
        this.state.honba = Math.max(0, this.state.honba + delta);
        document.getElementById('honba-display').textContent = this.state.honba;
        this.updateRoundDisplay();
        this.saveState();
    },

    changeKyoutaku(delta) {
        this.state.kyoutaku = Math.max(0, this.state.kyoutaku + delta);
        document.getElementById('kyoutaku-display').textContent = this.state.kyoutaku.toLocaleString();
        this.saveState();
    },

    // ===== Round Advancement =====
    advanceRound(dealerWon) {
        if (dealerWon) {
            // 親の和了 → 連荘
            this.state.honba++;

            // 上がり止めチェック（最終局 + 上がり止めON）
            if (this.isLastRound() && this.state.agariYame) {
                setTimeout(() => {
                    if (confirm(`${this.getRoundName(this.state.currentRound)} ${this.state.honba}本場\n\n親の和了です。上がり止めしますか？`)) {
                        this.showResult();
                        this._gameEnded = true;
                    }
                }, 300);
            }
        } else {
            // 子の和了 → 次局へ
            this.state.honba = 0;
            this.state.currentRound++;
            this.state.dealerIndex = this.state.currentRound % 4;

            // 終局チェック
            if (this.state.currentRound > this.getMaxRound()) {
                setTimeout(() => {
                    this.showResult();
                    this._gameEnded = true;
                }, 300);
                return;
            }
        }

        this.renderPlayers();
        this.saveState();
    },

    advanceRoundRyukyoku(dealerTenpai) {
        this.state.honba++;

        if (!dealerTenpai) {
            // 親ノーテン → 次局へ
            this.state.currentRound++;
            this.state.dealerIndex = this.state.currentRound % 4;

            if (this.state.currentRound > this.getMaxRound()) {
                setTimeout(() => {
                    this.showResult();
                    this._gameEnded = true;
                }, 300);
                return;
            }
        }
        // 親テンパイ → 連荘（局は進まない）

        this.renderPlayers();
        this.saveState();
    },

    // ===== Process Tsumo =====
    processTsumo(winnerIdx, koScore, oyaScore) {
        const scoreDiffs = [0, 0, 0, 0];
        const honbaBonus = this.state.honba * 100;
        const isDealer = winnerIdx === this.state.dealerIndex;

        if (isDealer) {
            for (let i = 0; i < 4; i++) {
                if (i === winnerIdx) continue;
                const payment = koScore + honbaBonus;
                scoreDiffs[i] = -payment;
                scoreDiffs[winnerIdx] += payment;
            }
        } else {
            for (let i = 0; i < 4; i++) {
                if (i === winnerIdx) continue;
                const isOya = (i === this.state.dealerIndex);
                const payment = (isOya ? oyaScore : koScore) + honbaBonus;
                scoreDiffs[i] = -payment;
                scoreDiffs[winnerIdx] += payment;
            }
        }

        scoreDiffs[winnerIdx] += this.state.kyoutaku;

        for (let i = 0; i < 4; i++) {
            this.state.scores[i] += scoreDiffs[i];
        }

        const winner = this.state.players[winnerIdx];
        let desc = `【${this.getRoundName(this.state.currentRound)}】`;
        if (isDealer) {
            desc += `${winner} ${koScore.toLocaleString()}オール ツモ`;
        } else {
            desc += `${winner} ${koScore.toLocaleString()}/${oyaScore.toLocaleString()} ツモ`;
        }
        if (this.state.honba > 0) desc += ` (${this.state.honba}本場)`;
        if (this.state.kyoutaku > 0) desc += ` +供託${this.state.kyoutaku.toLocaleString()}`;

        const entry = {
            type: 'tsumo', description: desc, scoreDiffs,
            chipDiffs: [0, 0, 0, 0],
            prevKyoutaku: this.state.kyoutaku, prevHonba: this.state.honba,
            prevRound: this.state.currentRound, prevDealerIndex: this.state.dealerIndex
        };

        this.state.history.push(entry);
        this.state.kyoutaku = 0;

        this.renderPlayers();
        this.renderHistory();
        this.saveState();
        if (navigator.vibrate) navigator.vibrate(50);

        // 局進行
        this._gameEnded = false;
        this.advanceRound(isDealer);
    },

    // ===== Process Ron =====
    processRon(winnerIdx, loserIdx, score) {
        const scoreDiffs = [0, 0, 0, 0];
        const honbaBonus = this.state.honba * 300;
        const totalScore = score + honbaBonus;

        scoreDiffs[loserIdx] = -totalScore;
        scoreDiffs[winnerIdx] = totalScore + this.state.kyoutaku;

        for (let i = 0; i < 4; i++) {
            this.state.scores[i] += scoreDiffs[i];
        }

        const winner = this.state.players[winnerIdx];
        const loser = this.state.players[loserIdx];
        let desc = `【${this.getRoundName(this.state.currentRound)}】`;
        desc += `${loser}→${winner} ${score.toLocaleString()}点 ロン`;
        if (this.state.honba > 0) desc += ` (${this.state.honba}本場 +${honbaBonus.toLocaleString()})`;
        if (this.state.kyoutaku > 0) desc += ` +供託${this.state.kyoutaku.toLocaleString()}`;

        const isDealer = winnerIdx === this.state.dealerIndex;

        const entry = {
            type: 'ron', description: desc, scoreDiffs,
            chipDiffs: [0, 0, 0, 0],
            prevKyoutaku: this.state.kyoutaku, prevHonba: this.state.honba,
            prevRound: this.state.currentRound, prevDealerIndex: this.state.dealerIndex
        };

        this.state.history.push(entry);
        this.state.kyoutaku = 0;

        this.renderPlayers();
        this.renderHistory();
        this.saveState();
        if (navigator.vibrate) navigator.vibrate(50);

        // 局進行
        this._gameEnded = false;
        this.advanceRound(isDealer);
    },

    // ===== Process Chip =====
    processChip(fromIdx, toIdx, count) {
        const chipDiffs = [0, 0, 0, 0];
        chipDiffs[fromIdx] = -count;
        chipDiffs[toIdx] = count;
        this.state.chips[fromIdx] -= count;
        this.state.chips[toIdx] += count;

        const from = this.state.players[fromIdx];
        const to = this.state.players[toIdx];
        const desc = `${from}→${to} チップ${count}枚`;

        const entry = {
            type: 'chip', description: desc,
            scoreDiffs: [0, 0, 0, 0], chipDiffs,
            prevKyoutaku: this.state.kyoutaku, prevHonba: this.state.honba,
            prevRound: this.state.currentRound, prevDealerIndex: this.state.dealerIndex
        };
        this.state.history.push(entry);

        this.renderPlayers();
        this.renderHistory();
        this.saveState();
        if (navigator.vibrate) navigator.vibrate(50);
    },

    processTsumoChips(winnerIdx, countPerPerson) {
        const chipDiffs = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
            if (i === winnerIdx) continue;
            chipDiffs[i] = -countPerPerson;
            chipDiffs[winnerIdx] += countPerPerson;
            this.state.chips[i] -= countPerPerson;
            this.state.chips[winnerIdx] += countPerPerson;
        }

        const winner = this.state.players[winnerIdx];
        const total = countPerPerson * 3;
        const desc = `🎰 ${winner} チップ+${total}枚 (各${countPerPerson}枚×3人)`;

        const entry = {
            type: 'tsumo-chip', description: desc,
            scoreDiffs: [0, 0, 0, 0], chipDiffs,
            prevKyoutaku: this.state.kyoutaku, prevHonba: this.state.honba,
            prevRound: this.state.currentRound, prevDealerIndex: this.state.dealerIndex
        };
        this.state.history.push(entry);

        this.renderPlayers();
        this.renderHistory();
        this.saveState();
    },

    // ===== Process Ryukyoku =====
    handleRyukyoku() {
        if (this.state.tenpaiRenchan) {
            // テンパイ連荘あり → 親テンパイか確認
            document.getElementById('ryukyoku-select').classList.remove('hidden');
        } else {
            // テンパイ連荘なし → 常に親流れ
            this.processRyukyoku(false);
        }
    },

    processRyukyoku(dealerTenpai) {
        document.getElementById('ryukyoku-select').classList.add('hidden');

        const desc = `【${this.getRoundName(this.state.currentRound)}】流局 (${this.state.honba}本場)` +
            (this.state.tenpaiRenchan ? (dealerTenpai ? ' 親テンパイ' : ' 親ノーテン') : '');

        const entry = {
            type: 'ryukyoku', description: desc,
            scoreDiffs: [0, 0, 0, 0], chipDiffs: [0, 0, 0, 0],
            prevKyoutaku: this.state.kyoutaku, prevHonba: this.state.honba,
            prevRound: this.state.currentRound, prevDealerIndex: this.state.dealerIndex
        };
        this.state.history.push(entry);

        this.renderPlayers();
        this.renderHistory();
        this.saveState();
        if (navigator.vibrate) navigator.vibrate(50);

        // 局進行
        this._gameEnded = false;
        if (this.state.tenpaiRenchan) {
            this.advanceRoundRyukyoku(dealerTenpai);
        } else {
            // テンパイ連荘なし: 常に次局に進む
            this.advanceRoundRyukyoku(false);
        }
    },

    // ===== Riichi =====
    showRiichiSelect() {
        const panel = document.getElementById('riichi-select');
        panel.classList.remove('hidden');
        const container = document.getElementById('riichi-player-select');
        container.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const btn = document.createElement('button');
            btn.className = 'player-select-btn';
            btn.textContent = this.state.players[i];
            btn.onclick = () => {
                this.processRiichi(i);
                panel.classList.add('hidden');
            };
            container.appendChild(btn);
        }
    },

    processRiichi(playerIdx) {
        const scoreDiffs = [0, 0, 0, 0];
        scoreDiffs[playerIdx] = -1000;
        this.state.scores[playerIdx] -= 1000;
        this.state.kyoutaku += 1000;

        const name = this.state.players[playerIdx];
        const desc = `🔴 ${name} 立直宣言 (-1,000点 供託へ)`;

        const entry = {
            type: 'riichi', description: desc, scoreDiffs,
            chipDiffs: [0, 0, 0, 0],
            prevKyoutaku: this.state.kyoutaku - 1000, prevHonba: this.state.honba,
            prevRound: this.state.currentRound, prevDealerIndex: this.state.dealerIndex
        };
        this.state.history.push(entry);

        this.renderPlayers();
        this.renderHistory();
        this.saveState();
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    },

    // ===== Undo =====
    undoLast() {
        if (this.state.history.length === 0) {
            alert('取り消す取引がありません');
            return;
        }

        const last = this.state.history.pop();

        for (let i = 0; i < 4; i++) {
            this.state.scores[i] -= last.scoreDiffs[i];
            this.state.chips[i] -= last.chipDiffs[i];
        }

        if (last.prevKyoutaku !== undefined) this.state.kyoutaku = last.prevKyoutaku;
        if (last.prevHonba !== undefined) this.state.honba = last.prevHonba;
        if (last.prevRound !== undefined) this.state.currentRound = last.prevRound;
        if (last.prevDealerIndex !== undefined) this.state.dealerIndex = last.prevDealerIndex;

        this._gameEnded = false;

        this.renderPlayers();
        this.renderHistory();
        this.saveState();
    },

    // ===== Manual Input =====
    showManualInput(mode) {
        this.manualMode = mode;
        this.selectedWinner = null;
        this.selectedLoser = null;
        this.selectedChipFrom = null;
        this.selectedChipTo = null;

        document.querySelectorAll('.manual-section').forEach(s => s.classList.add('hidden'));
        document.getElementById('manual-panel').classList.remove('hidden');

        const title = document.getElementById('manual-title');

        if (mode === 'tsumo') {
            title.textContent = '✋ ツモ入力';
            document.getElementById('manual-tsumo').classList.remove('hidden');
            this.renderPlayerSelect('tsumo-winner-select', (idx) => { this.selectedWinner = idx; });
            document.getElementById('tsumo-ko').value = '';
            document.getElementById('tsumo-oya').value = '';
            const chipSection = document.getElementById('tsumo-chip-section');
            if (chipSection) {
                chipSection.style.display = this.state.chipEnabled ? '' : 'none';
                document.getElementById('tsumo-chip-count').value = '0';
            }
        } else if (mode === 'ron') {
            title.textContent = '👊 ロン入力';
            document.getElementById('manual-ron').classList.remove('hidden');
            this.renderPlayerSelect('ron-winner-select', (idx) => { this.selectedWinner = idx; });
            this.renderPlayerSelect('ron-loser-select', (idx) => { this.selectedLoser = idx; });
            document.getElementById('ron-score').value = '';
        } else if (mode === 'chip') {
            title.textContent = '🎰 チップ移動';
            document.getElementById('manual-chip').classList.remove('hidden');
            this.renderPlayerSelect('chip-from-select', (idx) => { this.selectedChipFrom = idx; });
            this.renderPlayerSelect('chip-to-select', (idx) => { this.selectedChipTo = idx; });
            document.getElementById('chip-count').value = '1';
        }
    },

    hideManualInput() {
        document.getElementById('manual-panel').classList.add('hidden');
        this.manualMode = null;
    },

    renderPlayerSelect(containerId, onSelect) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const btn = document.createElement('button');
            btn.className = 'player-select-btn';
            btn.textContent = this.state.players[i];
            btn.setAttribute('data-index', i);
            btn.onclick = () => {
                container.querySelectorAll('.player-select-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                onSelect(i);
            };
            container.appendChild(btn);
        }
    },

    submitManual() {
        if (this.manualMode === 'tsumo') {
            if (this.selectedWinner === null) { alert('和了者を選択してください'); return; }
            const ko = parseInt(document.getElementById('tsumo-ko').value) || 0;
            const oya = parseInt(document.getElementById('tsumo-oya').value) || 0;
            if (ko <= 0) { alert('子の支払いを入力してください'); return; }

            const isDealer = this.selectedWinner === this.state.dealerIndex;
            const oyaScore = isDealer ? ko : (oya > 0 ? oya : ko * 2);

            this.processTsumo(this.selectedWinner, ko, oyaScore);

            if (this.state.chipEnabled) {
                const chipCount = parseInt(document.getElementById('tsumo-chip-count').value) || 0;
                if (chipCount > 0) this.processTsumoChips(this.selectedWinner, chipCount);
            }
            this.hideManualInput();
        } else if (this.manualMode === 'ron') {
            if (this.selectedWinner === null) { alert('和了者を選択してください'); return; }
            if (this.selectedLoser === null) { alert('放銃者を選択してください'); return; }
            if (this.selectedWinner === this.selectedLoser) { alert('和了者と放銃者は異なる必要があります'); return; }
            const score = parseInt(document.getElementById('ron-score').value) || 0;
            if (score <= 0) { alert('点数を入力してください'); return; }

            this.processRon(this.selectedWinner, this.selectedLoser, score);
            this.hideManualInput();
        } else if (this.manualMode === 'chip') {
            if (this.selectedChipFrom === null) { alert('渡す人を選択してください'); return; }
            if (this.selectedChipTo === null) { alert('受け取る人を選択してください'); return; }
            if (this.selectedChipFrom === this.selectedChipTo) { alert('渡す人と受け取る人は異なる必要があります'); return; }
            const count = parseInt(document.getElementById('chip-count').value) || 0;
            if (count <= 0) { alert('枚数を入力してください'); return; }

            this.processChip(this.selectedChipFrom, this.selectedChipTo, count);
            this.hideManualInput();
        }
    },

    // ===== Session Management =====
    startNextHanchan() {
        if (!this.lastResults) {
            this.showResult();
            return;
        }
        this.saveCurrentGameToSession();

        // 点数リセット、チップ持ち越し
        for (let i = 0; i < 4; i++) {
            this.state.scores[i] = this.state.startingPoints;
        }
        this.state.currentRound = 0;
        this.state.dealerIndex = 0;
        this.state.honba = 0;
        this.state.kyoutaku = 0;
        this.state.history = [];
        this.lastResults = null;
        this._gameEnded = false;

        this.showScreen('game');
        this.renderPlayers();
        this.renderHistory();
        this.updateRoundDisplay();
        this.saveState();
        if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
    },

    saveCurrentGameToSession() {
        if (!this.lastResults) return;
        const lastId = this.state.sessionGames.length > 0 ? this.state.sessionGames[this.state.sessionGames.length - 1].id : null;
        if (lastId && this._lastSavedResultId === lastId) return;

        const gameId = Date.now();
        const gameRecord = {
            id: gameId,
            date: new Date().toISOString(),
            gameType: this.state.gameType,
            results: this.lastResults.map(r => ({
                index: r.index, name: r.name, rank: r.rank,
                rawScore: r.rawScore, rawDiff: r.rawDiff,
                umaValue: r.umaValue, okaValue: r.okaValue,
                finalPoint: r.finalPoint,
                chipDiff: r.chipDiff, chipPoint: r.chipPoint, totalPoint: r.totalPoint,
            })),
            history: [...this.state.history],
        };
        this.state.sessionGames.push(gameRecord);
        this._lastSavedResultId = gameId;
        this.saveState();
    },

    // ===== Player Stats =====
    showStats() {
        const stats = this.calcPlayerStats();
        const container = document.getElementById('stats-container');
        const summary = document.getElementById('stats-session-summary');
        const gameCount = this.state.sessionGames.length;

        let summaryHtml = `<div class="stats-summary">`;
        summaryHtml += `<div class="stats-summary-item"><span class="stats-label">完了半荘数</span><span class="stats-value">${gameCount}</span></div>`;
        if (gameCount > 0) {
            summaryHtml += `<div class="stats-cumulative">`;
            summaryHtml += `<h4 style="margin-bottom:8px;color:var(--color-text-secondary)">📊 通算ポイント（チップ除く）</h4>`;
            const sorted = [...stats].sort((a, b) => b.cumulativePoint - a.cumulativePoint);
            sorted.forEach((s, i) => {
                const cls = s.cumulativePoint >= 0 ? 'positive' : 'negative';
                const sign = s.cumulativePoint >= 0 ? '+' : '';
                summaryHtml += `<div class="stats-cumulative-row">
                    <span class="stats-rank">${i + 1}.</span>
                    <span class="stats-name">${s.name}</span>
                    <span class="stats-point ${cls}">${sign}${s.cumulativePoint.toFixed(1)}</span>
                </div>`;
            });
            summaryHtml += `</div>`;
        }
        summaryHtml += `</div>`;
        summary.innerHTML = summaryHtml;

        let html = '';
        stats.forEach(s => {
            const totalRounds = s.tsumoCount + s.ronWinCount + s.ronLoseCount + s.drawCount + s.otherCount;
            const winCount = s.tsumoCount + s.ronWinCount;
            const winRate = totalRounds > 0 ? (winCount / totalRounds * 100).toFixed(1) : '-';
            const dealInRate = totalRounds > 0 ? (s.ronLoseCount / totalRounds * 100).toFixed(1) : '-';

            html += `<div class="stats-card">
                <h3 class="stats-player-name">${s.name}</h3>
                <div class="stats-grid">
                    <div class="stats-item">
                        <div class="stats-item-label">和了回数</div>
                        <div class="stats-item-value">${winCount}</div>
                        <div class="stats-item-sub">ツモ${s.tsumoCount} / ロン${s.ronWinCount}</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-item-label">平均打点</div>
                        <div class="stats-item-value">${s.avgWinScore > 0 ? s.avgWinScore.toLocaleString() : '-'}</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-item-label">最高打点</div>
                        <div class="stats-item-value">${s.maxWinScore > 0 ? s.maxWinScore.toLocaleString() : '-'}</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-item-label">放銃回数</div>
                        <div class="stats-item-value">${s.ronLoseCount}</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-item-label">和了率</div>
                        <div class="stats-item-value">${winRate}%</div>
                    </div>
                    <div class="stats-item">
                        <div class="stats-item-label">放銃率</div>
                        <div class="stats-item-value">${dealInRate}%</div>
                    </div>
                </div>
            </div>`;
        });

        if (stats.every(s => s.tsumoCount + s.ronWinCount + s.ronLoseCount === 0) && gameCount === 0) {
            html = '<p class="history-empty">まだデータがありません</p>';
        }

        container.innerHTML = html;
        this.showScreen('stats');
    },

    calcPlayerStats() {
        const players = this.state.players;
        const stats = players.map((name, i) => ({
            index: i, name, tsumoCount: 0, ronWinCount: 0, ronLoseCount: 0,
            drawCount: 0, otherCount: 0, totalWinScore: 0, maxWinScore: 0,
            avgWinScore: 0, cumulativePoint: 0,
        }));

        const allHistories = [];
        for (const game of this.state.sessionGames) {
            for (const r of game.results) {
                const s = stats.find(st => st.index === r.index);
                if (s) s.cumulativePoint += r.finalPoint;
            }
            allHistories.push(...game.history);
        }
        allHistories.push(...this.state.history);

        for (const h of allHistories) {
            if (h.type === 'tsumo') {
                let winnerIdx = -1, maxGain = 0;
                for (let i = 0; i < 4; i++) {
                    if (h.scoreDiffs[i] > maxGain) { maxGain = h.scoreDiffs[i]; winnerIdx = i; }
                }
                if (winnerIdx >= 0) {
                    stats[winnerIdx].tsumoCount++;
                    stats[winnerIdx].totalWinScore += maxGain;
                    if (maxGain > stats[winnerIdx].maxWinScore) stats[winnerIdx].maxWinScore = maxGain;
                }
            } else if (h.type === 'ron') {
                let winnerIdx = -1, loserIdx = -1, maxGain = 0, maxLoss = 0;
                for (let i = 0; i < 4; i++) {
                    if (h.scoreDiffs[i] > maxGain) { maxGain = h.scoreDiffs[i]; winnerIdx = i; }
                    if (h.scoreDiffs[i] < maxLoss) { maxLoss = h.scoreDiffs[i]; loserIdx = i; }
                }
                if (winnerIdx >= 0) {
                    stats[winnerIdx].ronWinCount++;
                    stats[winnerIdx].totalWinScore += maxGain;
                    if (maxGain > stats[winnerIdx].maxWinScore) stats[winnerIdx].maxWinScore = maxGain;
                }
                if (loserIdx >= 0) stats[loserIdx].ronLoseCount++;
            } else if (h.type === 'ryukyoku') {
                for (let i = 0; i < 4; i++) stats[i].drawCount++;
            }
        }

        for (const s of stats) {
            const totalWins = s.tsumoCount + s.ronWinCount;
            s.avgWinScore = totalWins > 0 ? Math.round(s.totalWinScore / totalWins) : 0;
        }
        return stats;
    },

    // ===== Settlement (精算) =====
    showResult() {
        const results = [];
        for (let i = 0; i < 4; i++) {
            results.push({
                index: i, name: this.state.players[i],
                rawScore: this.state.scores[i],
                chips: this.state.chips[i],
                chipDiff: this.state.chips[i] - this.state.initialChips,
            });
        }

        results.sort((a, b) => b.rawScore - a.rawScore);

        const returnPts = this.state.returnPoints;
        for (let rank = 0; rank < 4; rank++) {
            const r = results[rank];
            r.rank = rank + 1;
            r.rawDiff = (r.rawScore - returnPts) / 1000;
            r.umaValue = this.state.uma[rank];
            r.okaValue = rank === 0 ? this.state.oka : 0;
            r.finalPoint = r.rawDiff + r.umaValue + r.okaValue;
            r.chipPoint = this.state.chipEnabled ? r.chipDiff * (this.state.chipValue / 1000) : 0;
            r.totalPoint = r.finalPoint + r.chipPoint;
        }

        const container = document.getElementById('result-container');
        const gameNum = this.state.sessionGames.length + 1;
        const gameTypeLabel = this.state.gameType === 'tonpu' ? '東風戦' : '半荘戦';
        let html = `<div style="text-align:center;margin-bottom:12px;color:var(--color-text-secondary);font-size:var(--font-size-sm)">第${gameNum}回 ${gameTypeLabel}</div>`;

        results.forEach(r => {
            const mainClass = r.totalPoint >= 0 ? 'positive' : 'negative';
            const mainText = r.totalPoint >= 0 ? `+${r.totalPoint.toFixed(1)}` : r.totalPoint.toFixed(1);
            html += `
        <div class="result-player rank-${r.rank}">
          <div>
            <span class="result-player-name">${r.name}</span>
            <span class="result-player-rank rank-badge-${r.rank}">${r.rank}位</span>
          </div>
          <div class="result-player-score">
            <div class="result-score-main ${mainClass}">${mainText}</div>
            <div class="result-score-detail">
              素点: ${r.rawDiff >= 0 ? '+' : ''}${r.rawDiff.toFixed(1)} / ウマ: ${r.umaValue >= 0 ? '+' : ''}${r.umaValue} / オカ: ${r.okaValue >= 0 ? '+' : ''}${r.okaValue}
            </div>
            ${this.state.chipEnabled ? `<div class="result-chip-line">🎰 チップ: ${r.chipDiff >= 0 ? '+' : ''}${r.chipDiff}枚 (${r.chipPoint >= 0 ? '+' : ''}${r.chipPoint.toFixed(1)})</div>` : ''}
          </div>
        </div>`;
        });

        container.innerHTML = html;
        this.lastResults = results;
        this.showScreen('result');
    },

    backToGame() {
        this.showScreen('game');
    },

    // ===== End Session =====
    endSession() {
        // 現在の半荘を保存
        if (this.lastResults) {
            this.saveCurrentGameToSession();
        } else if (this.state.history.length > 0) {
            // 未精算なら先に精算
            this.showResult();
            this.saveCurrentGameToSession();
        }

        const container = document.getElementById('session-end-container');
        const games = this.state.sessionGames;

        if (games.length === 0) {
            container.innerHTML = '<p class="history-empty">完了した半荘がありません</p>';
            this.showScreen('session-end');
            return;
        }

        // プレイヤーごとの通算集計
        const totals = {};
        for (const game of games) {
            for (const r of game.results) {
                if (!totals[r.name]) {
                    totals[r.name] = { name: r.name, totalPoint: 0, totalChipPoint: 0, games: 0, ranks: [] };
                }
                totals[r.name].totalPoint += r.finalPoint;
                totals[r.name].totalChipPoint += r.chipPoint || 0;
                totals[r.name].games++;
                totals[r.name].ranks.push(r.rank);
            }
        }

        const sorted = Object.values(totals).sort((a, b) => (b.totalPoint + b.totalChipPoint) - (a.totalPoint + a.totalChipPoint));

        let html = `<div style="text-align:center;margin-bottom:16px;color:var(--color-text-secondary)">全${games.length}半荘</div>`;

        sorted.forEach((p, i) => {
            const total = p.totalPoint + p.totalChipPoint;
            const mainClass = total >= 0 ? 'positive' : 'negative';
            const mainText = total >= 0 ? `+${total.toFixed(1)}` : total.toFixed(1);
            const avgRank = (p.ranks.reduce((a, b) => a + b, 0) / p.ranks.length).toFixed(2);

            html += `
        <div class="result-player rank-${i + 1}">
          <div>
            <span class="result-player-name">${p.name}</span>
            <span class="result-player-rank rank-badge-${i + 1}">${i + 1}位</span>
          </div>
          <div class="result-player-score">
            <div class="result-score-main ${mainClass}">${mainText}</div>
            <div class="result-score-detail">
              ポイント: ${p.totalPoint >= 0 ? '+' : ''}${p.totalPoint.toFixed(1)}${this.state.chipEnabled ? ` / チップ: ${p.totalChipPoint >= 0 ? '+' : ''}${p.totalChipPoint.toFixed(1)}` : ''} / 平均着順: ${avgRank}
            </div>
          </div>
        </div>`;
        });

        // 各半荘の結果一覧
        html += `<div style="margin-top:20px"><h4 style="color:var(--color-text-secondary);margin-bottom:8px">📋 各半荘の結果</h4>`;
        games.forEach((game, gi) => {
            const sorted = [...game.results].sort((a, b) => a.rank - b.rank);
            html += `<div style="padding:8px 12px;background:var(--color-bg-tertiary);border-radius:8px;margin-bottom:6px;font-size:var(--font-size-sm)">`;
            html += `<strong>第${gi + 1}回</strong> `;
            sorted.forEach(r => {
                const t = r.totalPoint >= 0 ? `+${r.totalPoint.toFixed(1)}` : r.totalPoint.toFixed(1);
                html += `${r.name}:${t} `;
            });
            html += `</div>`;
        });
        html += `</div>`;

        this._sessionEndResults = sorted;
        container.innerHTML = html;
        this.showScreen('session-end');
    },

    copyResult() {
        if (!this.lastResults) return;
        let text = '📊 精算結果\n' + '─'.repeat(20) + '\n';
        this.lastResults.forEach(r => {
            const mainText = r.totalPoint >= 0 ? `+${r.totalPoint.toFixed(1)}` : r.totalPoint.toFixed(1);
            text += `${r.rank}位 ${r.name}: ${mainText}\n`;
        });
        this._copyText(text, '.btn-share:not(.btn-line)');
    },

    shareToLINE() {
        if (!this.lastResults) return;
        let text = '📊 精算結果\n';
        this.lastResults.forEach(r => {
            const mainText = r.totalPoint >= 0 ? `+${r.totalPoint.toFixed(1)}` : r.totalPoint.toFixed(1);
            text += `${r.rank}位 ${r.name}: ${mainText}\n`;
        });
        window.open(`https://social-plugins.line.me/lineit/share?url=&text=${encodeURIComponent(text)}`, '_blank');
    },

    copySessionResult() {
        if (!this._sessionEndResults) return;
        const games = this.state.sessionGames;
        let text = `🏁 本日の対局結果（全${games.length}半荘）\n` + '─'.repeat(20) + '\n';
        this._sessionEndResults.forEach((p, i) => {
            const total = p.totalPoint + p.totalChipPoint;
            const mainText = total >= 0 ? `+${total.toFixed(1)}` : total.toFixed(1);
            text += `${i + 1}位 ${p.name}: ${mainText}\n`;
        });
        this._copyText(text);
    },

    shareSessionToLINE() {
        if (!this._sessionEndResults) return;
        const games = this.state.sessionGames;
        let text = `🏁 本日の対局結果（全${games.length}半荘）\n`;
        this._sessionEndResults.forEach((p, i) => {
            const total = p.totalPoint + p.totalChipPoint;
            const mainText = total >= 0 ? `+${total.toFixed(1)}` : total.toFixed(1);
            text += `${i + 1}位 ${p.name}: ${mainText}\n`;
        });
        window.open(`https://social-plugins.line.me/lineit/share?url=&text=${encodeURIComponent(text)}`, '_blank');
    },

    _copyText(text, btnSelector) {
        navigator.clipboard.writeText(text).then(() => {
            if (btnSelector) {
                const btn = document.querySelector(btnSelector);
                if (btn) {
                    btn.textContent = '✅ コピー済み';
                    setTimeout(() => { btn.textContent = '📋 コピー'; }, 2000);
                }
            }
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
    },

    // ===== Reset =====
    resetGame() {
        if (!confirm('対局データをリセットしますか？\nすべての取引履歴・セッションデータが消去されます。')) return;
        localStorage.removeItem('tenbou-state');
        this.state.scores = [this.state.startingPoints, this.state.startingPoints, this.state.startingPoints, this.state.startingPoints];
        this.state.chips = [this.state.initialChips, this.state.initialChips, this.state.initialChips, this.state.initialChips];
        this.state.currentRound = 0;
        this.state.dealerIndex = 0;
        this.state.honba = 0;
        this.state.kyoutaku = 0;
        this.state.history = [];
        this.state.sessionGames = [];
        this.lastResults = null;
        this._lastSavedResultId = null;
        this._gameEnded = false;
        this.showScreen('setup');
    },

    // ===== LocalStorage =====
    saveState() {
        try {
            localStorage.setItem('tenbou-state', JSON.stringify(this.state));
        } catch (e) { console.error('保存エラー:', e); }
    },

    loadState() {
        try {
            const data = JSON.parse(localStorage.getItem('tenbou-state'));
            if (!data || !data.currentScreen) return;

            if (data.currentScreen === 'game') {
                Object.assign(this.state, data);
                if (!this.state.sessionGames) this.state.sessionGames = [];
                if (this.state.currentRound === undefined) this.state.currentRound = 0;
                if (!this.state.gameType) this.state.gameType = 'hanchan';
                this.showScreen('game');
                this.renderPlayers();
                this.renderHistory();
                this.updateRoundDisplay();

                const chipBtn = document.getElementById('chip-action-btn');
                if (chipBtn) chipBtn.classList.toggle('hidden', !this.state.chipEnabled);

                this.restoreSetupInputs();
            }
        } catch (e) { console.error('復元エラー:', e); }
    },

    restoreSetupInputs() {
        for (let i = 0; i < 4; i++) {
            const name = this.state.players[i];
            const defaultNames = ['プレイヤー1', 'プレイヤー2', 'プレイヤー3', 'プレイヤー4'];
            if (name !== defaultNames[i]) {
                document.getElementById(`setup-name-${i}`).value = name;
            }
        }
        document.getElementById('setup-starting-points').value = this.state.startingPoints;
        document.getElementById('setup-return-points').value = this.state.returnPoints;
        document.getElementById('setup-uma-1').value = this.state.uma[0];
        document.getElementById('setup-uma-2').value = this.state.uma[1];
        document.getElementById('setup-uma-3').value = this.state.uma[2];
        document.getElementById('setup-uma-4').value = this.state.uma[3];
        document.getElementById('setup-oka').value = this.state.oka;
        document.getElementById('setup-chip-enabled').checked = this.state.chipEnabled;
        document.getElementById('chip-settings').classList.toggle('hidden', !this.state.chipEnabled);
        document.getElementById('setup-chip-count').value = this.state.initialChips;
        document.getElementById('setup-chip-value').value = this.state.chipValue;
        document.getElementById('setup-tenpai-renchan').checked = this.state.tenpaiRenchan;
        document.getElementById('setup-agari-yame').checked = this.state.agariYame;
        // Restore game type button
        document.querySelectorAll('.game-type-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.type === this.state.gameType);
        });
        this._selectedGameType = this.state.gameType;
    }
};

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => Tenbou.init());
