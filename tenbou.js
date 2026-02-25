/**
 * 点棒管理アプリ - メインロジック
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
        history: [],      // { type, description, scoreDiffs, chipDiffs }
        currentScreen: 'setup'
    },

    // Manual input state
    manualMode: null,  // 'tsumo' | 'ron' | 'chip'
    selectedWinner: null,
    selectedLoser: null,
    selectedChipFrom: null,
    selectedChipTo: null,

    // Voice
    recognition: null,
    pendingVoiceAction: null,

    // ===== Init =====
    init() {
        this.loadTheme();
        this.setupThemeToggle();
        this.setupChipToggle();
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
            document.querySelector('.toggle-label').textContent = toggle.checked ? 'チップあり' : 'チップなし';
        });

        document.getElementById('start-game-btn').addEventListener('click', () => this.startGame());
    },

    setupInputAutoSelect() {
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('focus', () => input.select());
        });
    },

    // ===== Screen Management =====
    showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(`${name}-screen`).classList.remove('hidden');
        this.state.currentScreen = name;
        window.scrollTo(0, 0);
    },

    // ===== Start Game =====
    startGame() {
        // Collect setup
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

        this.state.chipEnabled = document.getElementById('setup-chip-enabled').checked;
        this.state.initialChips = parseInt(document.getElementById('setup-chip-count').value) || 20;
        this.state.chipValue = parseInt(document.getElementById('setup-chip-value').value) || 500;

        // Init scores
        for (let i = 0; i < 4; i++) {
            this.state.scores[i] = this.state.startingPoints;
            this.state.chips[i] = this.state.chipEnabled ? this.state.initialChips : 0;
        }
        this.state.dealerIndex = 0;
        this.state.honba = 0;
        this.state.kyoutaku = 0;
        this.state.history = [];

        // Show/hide chip button
        const chipBtn = document.getElementById('chip-action-btn');
        if (chipBtn) chipBtn.classList.toggle('hidden', !this.state.chipEnabled);

        this.showScreen('game');
        this.renderPlayers();
        this.renderHistory();
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

        // Update info bar
        document.getElementById('honba-display').textContent = this.state.honba;
        document.getElementById('kyoutaku-display').textContent = this.state.kyoutaku.toLocaleString();
    },

    renderHistory() {
        const list = document.getElementById('history-list');
        if (this.state.history.length === 0) {
            list.innerHTML = '<p class="history-empty">まだ取引がありません</p>';
            return;
        }

        list.innerHTML = '';
        // Show newest first
        for (let i = this.state.history.length - 1; i >= 0; i--) {
            const h = this.state.history[i];
            const entry = document.createElement('div');
            entry.className = 'history-entry';

            const typeClass = h.type === 'tsumo' ? 'type-tsumo' : h.type === 'ron' ? 'type-ron' : 'type-chip';
            const typeLabel = h.type === 'tsumo' ? 'ツモ' : h.type === 'ron' ? 'ロン' : 'チップ';

            entry.innerHTML = `
        <div class="history-entry-text">
          <span class="history-entry-type ${typeClass}">${typeLabel}</span>
          ${h.description}
        </div>
      `;
            list.appendChild(entry);
        }
    },

    // ===== Player Card Click =====
    onPlayerCardClick(index) {
        // Toggle dealer on long press or simple click cycles dealer
        this.state.dealerIndex = index;
        this.renderPlayers();
        this.saveState();
    },

    // ===== Honba / Kyoutaku =====
    changeHonba(delta) {
        this.state.honba = Math.max(0, this.state.honba + delta);
        document.getElementById('honba-display').textContent = this.state.honba;
        this.saveState();
    },

    changeKyoutaku(delta) {
        this.state.kyoutaku = Math.max(0, this.state.kyoutaku + delta);
        document.getElementById('kyoutaku-display').textContent = this.state.kyoutaku.toLocaleString();
        this.saveState();
    },

    // ===== Process Tsumo =====
    processTsumo(winnerIdx, koScore, oyaScore) {
        const scoreDiffs = [0, 0, 0, 0];
        const honbaBonus = this.state.honba * 100;
        const isDealer = winnerIdx === this.state.dealerIndex;

        if (isDealer) {
            // 親ツモ: 全員から koScore (= オール)
            for (let i = 0; i < 4; i++) {
                if (i === winnerIdx) continue;
                const payment = koScore + honbaBonus;
                scoreDiffs[i] = -payment;
                scoreDiffs[winnerIdx] += payment;
            }
        } else {
            // 子ツモ
            for (let i = 0; i < 4; i++) {
                if (i === winnerIdx) continue;
                const isOya = (i === this.state.dealerIndex);
                const payment = (isOya ? oyaScore : koScore) + honbaBonus;
                scoreDiffs[i] = -payment;
                scoreDiffs[winnerIdx] += payment;
            }
        }

        // Add kyoutaku
        scoreDiffs[winnerIdx] += this.state.kyoutaku;

        // Apply
        for (let i = 0; i < 4; i++) {
            this.state.scores[i] += scoreDiffs[i];
        }

        // Build description
        const winner = this.state.players[winnerIdx];
        let desc;
        if (isDealer) {
            desc = `${winner} ${koScore.toLocaleString()}オール ツモ`;
        } else {
            desc = `${winner} ${koScore.toLocaleString()}/${oyaScore.toLocaleString()} ツモ`;
        }
        if (this.state.honba > 0) desc += ` (${this.state.honba}本場)`;
        if (this.state.kyoutaku > 0) desc += ` +供託${this.state.kyoutaku.toLocaleString()}`;

        const entry = { type: 'tsumo', description: desc, scoreDiffs, chipDiffs: [0, 0, 0, 0], prevKyoutaku: this.state.kyoutaku, prevHonba: this.state.honba };

        this.state.history.push(entry);
        this.state.kyoutaku = 0;

        this.renderPlayers();
        this.renderHistory();
        this.saveState();
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
        let desc = `${loser}→${winner} ${score.toLocaleString()}点 ロン`;
        if (this.state.honba > 0) desc += ` (${this.state.honba}本場 +${honbaBonus.toLocaleString()})`;
        if (this.state.kyoutaku > 0) desc += ` +供託${this.state.kyoutaku.toLocaleString()}`;

        const entry = { type: 'ron', description: desc, scoreDiffs, chipDiffs: [0, 0, 0, 0], prevKyoutaku: this.state.kyoutaku, prevHonba: this.state.honba };

        this.state.history.push(entry);
        this.state.kyoutaku = 0;

        this.renderPlayers();
        this.renderHistory();
        this.saveState();
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

        const entry = { type: 'chip', description: desc, scoreDiffs: [0, 0, 0, 0], chipDiffs, prevKyoutaku: this.state.kyoutaku, prevHonba: this.state.honba };
        this.state.history.push(entry);

        this.renderPlayers();
        this.renderHistory();
        this.saveState();
    },

    // ===== Undo =====
    undoLast() {
        if (this.state.history.length === 0) {
            alert('取り消す取引がありません');
            return;
        }

        const last = this.state.history.pop();

        // Reverse score changes
        for (let i = 0; i < 4; i++) {
            this.state.scores[i] -= last.scoreDiffs[i];
            this.state.chips[i] -= last.chipDiffs[i];
        }

        // Restore kyoutaku and honba
        if (last.prevKyoutaku !== undefined) this.state.kyoutaku = last.prevKyoutaku;
        if (last.prevHonba !== undefined) this.state.honba = last.prevHonba;

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

        // Hide all sections
        document.querySelectorAll('.manual-section').forEach(s => s.classList.add('hidden'));
        document.getElementById('manual-panel').classList.remove('hidden');

        const title = document.getElementById('manual-title');

        if (mode === 'tsumo') {
            title.textContent = '✋ ツモ入力';
            document.getElementById('manual-tsumo').classList.remove('hidden');
            this.renderPlayerSelect('tsumo-winner-select', (idx) => { this.selectedWinner = idx; });
            // Clear inputs
            document.getElementById('tsumo-ko').value = '';
            document.getElementById('tsumo-oya').value = '';
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

            // If winner is dealer, oya score is not needed (it's ko all)
            // If winner is not dealer and oya is 0, assume it's ko for oya too (unlikely)
            const isDealer = this.selectedWinner === this.state.dealerIndex;
            const oyaScore = isDealer ? ko : (oya > 0 ? oya : ko * 2);

            this.processTsumo(this.selectedWinner, ko, oyaScore);
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

    // ===== Voice Recognition =====
    startVoice() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('お使いのブラウザは音声認識に対応していません。\nChrome/Edge/Safariをお試しください。');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ja-JP';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        document.getElementById('voice-status').classList.remove('hidden');
        document.getElementById('voice-text').textContent = '聴いています...';
        document.getElementById('voice-btn').classList.add('listening');

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('音声認識結果:', transcript);
            this.handleVoiceResult(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('音声認識エラー:', event.error);
            document.getElementById('voice-text').textContent = `エラー: ${event.error}`;
            setTimeout(() => this.stopVoice(), 1500);
        };

        this.recognition.onend = () => {
            document.getElementById('voice-btn').classList.remove('listening');
            if (!this.pendingVoiceAction) {
                document.getElementById('voice-status').classList.add('hidden');
            }
        };

        this.recognition.start();
    },

    stopVoice() {
        if (this.recognition) {
            this.recognition.abort();
        }
        document.getElementById('voice-status').classList.add('hidden');
        document.getElementById('voice-btn').classList.remove('listening');
    },

    handleVoiceResult(text) {
        document.getElementById('voice-status').classList.add('hidden');
        const parsed = this.parseVoiceText(text);

        if (!parsed) {
            document.getElementById('voice-preview').classList.remove('hidden');
            document.getElementById('voice-preview-text').textContent = `「${text}」\n\n認識できませんでした。もう一度お試しください。`;
            this.pendingVoiceAction = null;
            return;
        }

        this.pendingVoiceAction = parsed;
        document.getElementById('voice-preview').classList.remove('hidden');
        document.getElementById('voice-preview-text').textContent = `「${text}」\n\n→ ${parsed.description}`;
    },

    parseVoiceText(text) {
        // Normalize
        const t = text.replace(/\s+/g, '').toLowerCase();
        const names = this.state.players.map(n => n.toLowerCase());

        // Find player by name
        const findPlayer = (str) => {
            for (let i = 0; i < 4; i++) {
                if (str.includes(names[i])) return i;
            }
            return -1;
        };

        // Pattern 1: "Aが2000/4000ツモ" or "Aが2000 4000ツモ"
        const tsumoMatch = t.match(/(.+?)が(\d+)[\/／](\d+)(?:ツモ|つも)/i) ||
            t.match(/(.+?)が(\d+)\s*(\d+)(?:ツモ|つも)/i);
        if (tsumoMatch) {
            const winner = findPlayer(tsumoMatch[1]);
            if (winner >= 0) {
                const ko = parseInt(tsumoMatch[2]);
                const oya = parseInt(tsumoMatch[3]);
                return {
                    type: 'tsumo',
                    winnerIdx: winner,
                    koScore: ko,
                    oyaScore: oya,
                    description: `${this.state.players[winner]} ${ko.toLocaleString()}/${oya.toLocaleString()} ツモ`
                };
            }
        }

        // Pattern 2: "Aが8000オール" (dealer tsumo)
        const allMatch = t.match(/(.+?)が(\d+)(?:オール|おーる|all)/i);
        if (allMatch) {
            const winner = findPlayer(allMatch[1]);
            if (winner >= 0) {
                const score = parseInt(allMatch[2]);
                return {
                    type: 'tsumo',
                    winnerIdx: winner,
                    koScore: score,
                    oyaScore: score,
                    description: `${this.state.players[winner]} ${score.toLocaleString()}オール ツモ`
                };
            }
        }

        // Pattern 3: "AからBへ3900ロン" or "AからBに3900"
        const ronMatch = t.match(/(.+?)から(.+?)[へに](\d+)(?:ロン|ろん|点)?/i) ||
            t.match(/(.+?)が(.+?)から(\d+)(?:ロン|ろん)/i);
        if (ronMatch) {
            // Check if it's a chip transaction
            if (t.includes('チップ') || t.includes('ちっぷ')) {
                // handled below
            } else {
                const loser = findPlayer(ronMatch[1]);
                const winner = findPlayer(ronMatch[2]);
                if (loser >= 0 && winner >= 0 && loser !== winner) {
                    const score = parseInt(ronMatch[3]);
                    return {
                        type: 'ron',
                        winnerIdx: winner,
                        loserIdx: loser,
                        score: score,
                        description: `${this.state.players[loser]}→${this.state.players[winner]} ${score.toLocaleString()}点 ロン`
                    };
                }
            }
        }

        // Pattern 4: "AからBへチップ3枚" or "AからBに2枚チップ"
        const chipMatch = t.match(/(.+?)から(.+?)[へに](?:チップ|ちっぷ)\s*(\d+)\s*(?:枚|まい)/i) ||
            t.match(/(.+?)から(.+?)[へに](\d+)\s*(?:枚|まい)\s*(?:チップ|ちっぷ)/i);
        if (chipMatch && this.state.chipEnabled) {
            const from = findPlayer(chipMatch[1]);
            const to = findPlayer(chipMatch[2]);
            if (from >= 0 && to >= 0 && from !== to) {
                const count = parseInt(chipMatch[3]);
                return {
                    type: 'chip',
                    fromIdx: from,
                    toIdx: to,
                    count: count,
                    description: `${this.state.players[from]}→${this.state.players[to]} チップ${count}枚`
                };
            }
        }

        return null;
    },

    confirmVoice() {
        const action = this.pendingVoiceAction;
        if (!action) return;

        if (action.type === 'tsumo') {
            this.processTsumo(action.winnerIdx, action.koScore, action.oyaScore);
        } else if (action.type === 'ron') {
            this.processRon(action.winnerIdx, action.loserIdx, action.score);
        } else if (action.type === 'chip') {
            this.processChip(action.fromIdx, action.toIdx, action.count);
        }

        this.pendingVoiceAction = null;
        document.getElementById('voice-preview').classList.add('hidden');
    },

    cancelVoice() {
        this.pendingVoiceAction = null;
        document.getElementById('voice-preview').classList.add('hidden');
    },

    // ===== Settlement (精算) =====
    showResult() {
        // Calculate final scores with uma/oka
        const results = [];
        for (let i = 0; i < 4; i++) {
            results.push({
                index: i,
                name: this.state.players[i],
                rawScore: this.state.scores[i],
                chips: this.state.chips[i],
                chipDiff: this.state.chips[i] - this.state.initialChips,
            });
        }

        // Sort by score (descending) for ranking
        results.sort((a, b) => b.rawScore - a.rawScore);

        // Assign ranks and calculate final points
        const returnPts = this.state.returnPoints;
        for (let rank = 0; rank < 4; rank++) {
            const r = results[rank];
            r.rank = rank + 1;
            // 素点 (rawScore - returnPoints) / 1000
            r.rawDiff = (r.rawScore - returnPts) / 1000;
            // ウマ
            r.umaValue = this.state.uma[rank];
            // オカ (1位のみ)
            r.okaValue = rank === 0 ? this.state.oka : 0;
            // 最終ポイント
            r.finalPoint = r.rawDiff + r.umaValue + r.okaValue;
            // チップ精算
            r.chipPoint = this.state.chipEnabled ? r.chipDiff * (this.state.chipValue / 1000) : 0;
            // 総合
            r.totalPoint = r.finalPoint + r.chipPoint;
        }

        // Render result
        const container = document.getElementById('result-container');
        let html = '';

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
        </div>
      `;
        });

        container.innerHTML = html;
        this.lastResults = results;
        this.showScreen('result');
    },

    backToGame() {
        this.showScreen('game');
    },

    copyResult() {
        if (!this.lastResults) return;
        let text = '📊 精算結果\n';
        text += '─'.repeat(20) + '\n';

        this.lastResults.forEach(r => {
            const mainText = r.totalPoint >= 0 ? `+${r.totalPoint.toFixed(1)}` : r.totalPoint.toFixed(1);
            text += `${r.rank}位 ${r.name}: ${mainText}\n`;
            text += `  素点:${r.rawDiff >= 0 ? '+' : ''}${r.rawDiff.toFixed(1)} ウマ:${r.umaValue >= 0 ? '+' : ''}${r.umaValue} オカ:${r.okaValue >= 0 ? '+' : ''}${r.okaValue}\n`;
            if (this.state.chipEnabled) {
                text += `  チップ: ${r.chipDiff >= 0 ? '+' : ''}${r.chipDiff}枚 (${r.chipPoint >= 0 ? '+' : ''}${r.chipPoint.toFixed(1)})\n`;
            }
        });

        navigator.clipboard.writeText(text).then(() => {
            const btn = document.querySelector('.btn-share:not(.btn-line)');
            if (btn) {
                btn.textContent = '✅ コピー済み';
                setTimeout(() => { btn.textContent = '📋 コピー'; }, 2000);
            }
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
    },

    shareToLINE() {
        if (!this.lastResults) return;
        let text = '📊 精算結果\n';
        this.lastResults.forEach(r => {
            const mainText = r.totalPoint >= 0 ? `+${r.totalPoint.toFixed(1)}` : r.totalPoint.toFixed(1);
            text += `${r.rank}位 ${r.name}: ${mainText}\n`;
        });

        const url = `https://social-plugins.line.me/lineit/share?url=&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    },

    // ===== Reset =====
    resetGame() {
        if (!confirm('対局データをリセットしますか？\nすべての取引履歴が消去されます。')) return;

        localStorage.removeItem('tenbou-state');
        this.state.scores = [this.state.startingPoints, this.state.startingPoints, this.state.startingPoints, this.state.startingPoints];
        this.state.chips = [this.state.initialChips, this.state.initialChips, this.state.initialChips, this.state.initialChips];
        this.state.dealerIndex = 0;
        this.state.honba = 0;
        this.state.kyoutaku = 0;
        this.state.history = [];

        this.showScreen('setup');
    },

    // ===== LocalStorage =====
    saveState() {
        try {
            localStorage.setItem('tenbou-state', JSON.stringify(this.state));
        } catch (e) {
            console.error('保存エラー:', e);
        }
    },

    loadState() {
        try {
            const data = JSON.parse(localStorage.getItem('tenbou-state'));
            if (!data || !data.currentScreen) return;

            // Only restore if was in game
            if (data.currentScreen === 'game') {
                Object.assign(this.state, data);
                this.showScreen('game');
                this.renderPlayers();
                this.renderHistory();

                // Hide chip button if disabled
                const chipBtn = document.getElementById('chip-action-btn');
                if (chipBtn) chipBtn.classList.toggle('hidden', !this.state.chipEnabled);

                // Restore setup inputs for reference
                this.restoreSetupInputs();
            }
        } catch (e) {
            console.error('復元エラー:', e);
        }
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
        document.querySelector('.toggle-label').textContent = this.state.chipEnabled ? 'チップあり' : 'チップなし';
    }
};

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => Tenbou.init());
