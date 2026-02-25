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
        this.recognition.interimResults = true; // リアルタイムで途中結果を表示

        document.getElementById('voice-status').classList.remove('hidden');
        document.getElementById('voice-text').textContent = '聴いています...';
        document.getElementById('voice-btn').classList.add('listening');

        this.recognition.onresult = (event) => {
            const result = event.results[0];
            const transcript = result[0].transcript;

            if (result.isFinal) {
                console.log('音声認識確定:', transcript);
                this.handleVoiceResult(transcript);
            } else {
                // 途中結果をリアルタイム表示
                document.getElementById('voice-text').textContent = `🎤 ${transcript}`;
            }
        };

        this.recognition.onerror = (event) => {
            console.error('音声認識エラー:', event.error);
            const msg = {
                'no-speech': '音声が検出されませんでした',
                'audio-capture': 'マイクが見つかりません',
                'not-allowed': 'マイクの使用が許可されていません',
                'network': 'ネットワークエラー',
            }[event.error] || event.error;
            document.getElementById('voice-text').textContent = `⚠️ ${msg}`;
            setTimeout(() => this.stopVoice(), 2000);
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

        // まず完全パースを試みる
        const parsed = this.parseVoiceText(text);

        if (parsed) {
            // 完全認識成功 → 従来通り確認表示
            this.pendingVoiceAction = parsed;
            document.getElementById('voice-preview').classList.remove('hidden');
            document.getElementById('voice-preview-text').innerHTML =
                `<div style="margin-bottom:8px">認識:「${text}」</div>` +
                `<div style="font-size:var(--font-size-xl);font-weight:700">→ ${parsed.description}</div>`;
            return;
        }

        // 完全パース失敗 → 数字とアクションだけ抽出してプレイヤー選択UIを表示
        const partial = this.parseVoicePartial(text);
        if (partial) {
            this.showVoicePlayerSelect(text, partial);
            return;
        }

        // 何も認識できなかった
        document.getElementById('voice-preview').classList.remove('hidden');
        document.getElementById('voice-preview-text').innerHTML =
            `<div style="margin-bottom:8px">認識:「${text}」</div>` +
            `<div style="color:var(--color-warning)">⚠️ 認識できませんでした</div>` +
            `<div style="font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:8px">` +
            `例:「2000の4000ツモ」「3900ロン」</div>`;
        this.pendingVoiceAction = null;
    },

    // 数字 + アクションタイプだけ抽出（プレイヤー名なし）
    parseVoicePartial(text) {
        let t = this.kanjiToNumber(text);
        t = t.replace(/坪/g, 'ツモ').replace(/つぼ/g, 'ツモ');
        t = t.replace(/スモ/g, 'ツモ').replace(/すも/g, 'ツモ');
        t = t.replace(/詰も/g, 'ツモ').replace(/積も/g, 'ツモ').replace(/摘も/g, 'ツモ');
        t = t.replace(/論/g, 'ロン').replace(/ろーん/g, 'ロン').replace(/ローン/g, 'ロン');
        t = t.replace(/ーる$/g, 'オール').replace(/おる$/g, 'オール');
        t = t.replace(/([^\d\s])\/(\d)/g, '$1 $2');
        t = t.replace(/(\d)\/([^\d\s])/g, '$1 $2');
        t = t.replace(/([^\d\s])\/([^\d\s])/g, '$1 $2');
        t = t.replace(/\s+/g, ' ').trim();

        const numbers = t.match(/\d+/g);
        const hasTsumo = /ツモ|つも/.test(t);
        const hasRon = /ロン|ろん/.test(t);
        const hasAll = /オール|おーる|all/i.test(t);
        const hasChip = /チップ|ちっぷ|祝儀/.test(t);

        // 麻雀用語チェック
        const termMatch = t.match(/満貫|まんがん|マンガン|跳満|はねまん|ハネマン|はね満|倍満|ばいまん|バイマン|三倍満|さんばいまん|役満|やくまん/);
        if (termMatch) {
            const termData = this.mahjongTermToScore(termMatch[0]);
            if (termData) {
                if (hasTsumo) {
                    return { type: 'tsumo-term', term: termMatch[0], termData, needPlayers: ['winner'] };
                } else {
                    return { type: 'ron-term', term: termMatch[0], termData, needPlayers: ['winner', 'loser'] };
                }
            }
        }

        if (numbers && numbers.length >= 2 && hasTsumo) {
            const ko = parseInt(numbers[0]);
            const oya = parseInt(numbers[1]);
            if (ko > 0 && oya > 0) {
                return { type: 'tsumo', ko, oya, needPlayers: ['winner'] };
            }
        }

        if (numbers && numbers.length >= 1 && hasAll) {
            const score = parseInt(numbers[0]);
            if (score > 0) {
                return { type: 'tsumo-all', score, needPlayers: ['winner'] };
            }
        }

        if (numbers && numbers.length >= 1 && (hasRon || (!hasTsumo && !hasAll && !hasChip))) {
            const score = parseInt(numbers[0]);
            if (score > 0) {
                return { type: 'ron', score, needPlayers: ['winner', 'loser'] };
            }
        }

        if (numbers && numbers.length >= 1 && hasChip && this.state.chipEnabled) {
            const count = parseInt(numbers[0]);
            if (count > 0) {
                return { type: 'chip', count, needPlayers: ['from', 'to'] };
            }
        }

        // 数字だけでもツモっぽければ
        if (numbers && numbers.length >= 2) {
            const ko = parseInt(numbers[0]);
            const oya = parseInt(numbers[1]);
            if (ko > 0 && oya > 0 && oya >= ko) {
                return { type: 'tsumo', ko, oya, needPlayers: ['winner'] };
            }
        }

        return null;
    },

    // プレイヤー選択UIを表示
    showVoicePlayerSelect(originalText, partial) {
        this.pendingVoicePartial = partial;
        this.voiceSelectedPlayers = {};

        const preview = document.getElementById('voice-preview');
        preview.classList.remove('hidden');

        let desc = '';
        if (partial.type === 'tsumo') desc = `${partial.ko.toLocaleString()}/${partial.oya.toLocaleString()} ツモ`;
        else if (partial.type === 'tsumo-all') desc = `${partial.score.toLocaleString()}オール ツモ`;
        else if (partial.type === 'tsumo-term') desc = `${partial.term} ツモ`;
        else if (partial.type === 'ron') desc = `${partial.score.toLocaleString()}点 ロン`;
        else if (partial.type === 'ron-term') desc = `${partial.term} ロン`;
        else if (partial.type === 'chip') desc = `チップ${partial.count}枚`;

        const labels = {
            'winner': '和了者', 'loser': '放銃者',
            'from': '渡す人', 'to': '受け取る人'
        };

        let playerSelectHTML = '';
        for (const role of partial.needPlayers) {
            playerSelectHTML += `
                <div style="margin:12px 0">
                    <div style="font-weight:600;margin-bottom:6px">${labels[role]}を選択:</div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        ${this.state.players.map((name, i) => `
                            <button class="player-select-btn" data-role="${role}" data-index="${i}"
                                onclick="Tenbou.selectVoicePlayer('${role}', ${i}, this)"
                                style="padding:10px 18px;font-size:16px;font-weight:700;border-radius:10px;border:2px solid var(--color-border);background:var(--color-bg-card);color:var(--color-text);cursor:pointer;transition:all 0.15s">
                                ${name}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        document.getElementById('voice-preview-text').innerHTML =
            `<div style="margin-bottom:8px">認識:「${originalText}」</div>` +
            `<div style="font-size:var(--font-size-xl);font-weight:700;margin-bottom:12px">→ ${desc}</div>` +
            playerSelectHTML;
    },

    selectVoicePlayer(role, index, btnElement) {
        this.voiceSelectedPlayers[role] = index;

        // 同じロールのボタンの選択状態をリセット
        const siblings = btnElement.parentElement.querySelectorAll('.player-select-btn');
        siblings.forEach(b => {
            b.style.background = 'var(--color-bg-card)';
            b.style.borderColor = 'var(--color-border)';
            b.style.color = 'var(--color-text)';
        });
        btnElement.style.background = 'var(--color-primary)';
        btnElement.style.borderColor = 'var(--color-primary)';
        btnElement.style.color = '#fff';

        // 全ロール選択済みか確認
        const partial = this.pendingVoicePartial;
        if (!partial) return;

        const allSelected = partial.needPlayers.every(r => this.voiceSelectedPlayers[r] !== undefined);
        if (allSelected) {
            // 自動的にアクションを構築して反映
            setTimeout(() => this.executeVoicePartial(), 300);
        }
    },

    executeVoicePartial() {
        const p = this.pendingVoicePartial;
        const sel = this.voiceSelectedPlayers;
        if (!p) return;

        if (p.type === 'tsumo') {
            this.processTsumo(sel.winner, p.ko, p.oya);
        } else if (p.type === 'tsumo-all') {
            this.processTsumo(sel.winner, p.score, p.score);
        } else if (p.type === 'tsumo-term') {
            const isDealer = sel.winner === this.state.dealerIndex;
            if (isDealer) {
                this.processTsumo(sel.winner, p.termData.tsumoAll, p.termData.tsumoAll);
            } else {
                this.processTsumo(sel.winner, p.termData.tsumoKo, p.termData.tsumoOya);
            }
        } else if (p.type === 'ron') {
            if (sel.winner === sel.loser) { alert('和了者と放銃者は異なる必要があります'); return; }
            this.processRon(sel.winner, sel.loser, p.score);
        } else if (p.type === 'ron-term') {
            if (sel.winner === sel.loser) { alert('和了者と放銃者は異なる必要があります'); return; }
            const isDealer = sel.winner === this.state.dealerIndex;
            const score = p.termData.ron[isDealer ? 1 : 0];
            this.processRon(sel.winner, sel.loser, score);
        } else if (p.type === 'chip') {
            if (sel.from === sel.to) { alert('渡す人と受け取る人は異なる必要があります'); return; }
            this.processChip(sel.from, sel.to, p.count);
        }

        this.pendingVoicePartial = null;
        this.voiceSelectedPlayers = {};
        document.getElementById('voice-preview').classList.add('hidden');
    },


    // ========================================
    // 漢数字・日本語数字を算用数字に変換
    // ========================================
    kanjiToNumber(str) {
        // まず全角数字→半角
        let s = str.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

        // 単純な漢数字マッピング
        const kanjiDigits = { '零': '0', '〇': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };

        // 漢数字による大きい数の解析 (例: 二千, 三千九百, 八千)
        const parseKanjiNum = (input) => {
            let result = 0;
            let current = 0;
            for (let i = 0; i < input.length; i++) {
                const ch = input[i];
                if (kanjiDigits[ch] !== undefined) {
                    current = parseInt(kanjiDigits[ch]);
                } else if (ch === '万') {
                    result += (current || 1) * 10000;
                    current = 0;
                } else if (ch === '千' || ch === 'せん' || ch === 'ぜん') {
                    result += (current || 1) * 1000;
                    current = 0;
                } else if (ch === '百' || ch === 'ひゃく' || ch === 'びゃく' || ch === 'ぴゃく') {
                    result += (current || 1) * 100;
                    current = 0;
                } else if (ch === '十') {
                    result += (current || 1) * 10;
                    current = 0;
                }
            }
            result += current;
            return result;
        };

        // ひらがな数字パターンの置換テーブル（区切り付きで変換）
        const kanaNumbers = {
            'いっせん': '1000', 'にせん': '2000', 'さんぜん': '3000', 'よんせん': '4000',
            'ごせん': '5000', 'ろくせん': '6000', 'ななせん': '7000', 'はっせん': '8000',
            'きゅうせん': '9000',
            'いちまん': '10000', 'にまん': '20000', 'さんまん': '30000', 'よんまん': '40000',
            'ごまん': '50000',
            'せん': '1000',
            // 下位桁
            'ひゃく': '100', 'にひゃく': '200', 'さんびゃく': '300', 'よんひゃく': '400',
            'ごひゃく': '500', 'ろっぴゃく': '600', 'ななひゃく': '700', 'はっぴゃく': '800',
            'きゅうひゃく': '900',
        };

        // ひらがな複合パターン (例: にせんよんせん → 2000/4000)
        // 区切り文字「/」を入れて連結されないようにする
        for (const [kana, num] of Object.entries(kanaNumbers).sort((a, b) => b[0].length - a[0].length)) {
            s = s.replace(new RegExp(kana, 'g'), '/' + num + '/');
        }
        // 連続する区切りをクリーンアップ
        s = s.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');

        // 漢字パターン (例: 二千 → 2000, 三千九百 → 3900)
        // 区切り文字を挿入して連結を防ぐ
        const kanjiNumPattern = /([零〇一二三四五六七八九十百千万]+)/g;
        s = s.replace(kanjiNumPattern, (match) => {
            const val = parseKanjiNum(match);
            return val > 0 ? '/' + val.toString() + '/' : match;
        });
        // クリーンアップ
        s = s.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');

        return s;
    },

    // ========================================
    // 麻雀用語を点数に変換
    // ========================================
    mahjongTermToScore(term, isDealer) {
        // ツモの場合: {ko, oya} を返す / ロンの場合: 数値を返す
        const terms = {
            // ロン点 (子/親)
            '満貫': { ron: [8000, 12000], tsumoKo: 2000, tsumoOya: 4000, tsumoAll: 4000 },
            'まんがん': { ron: [8000, 12000], tsumoKo: 2000, tsumoOya: 4000, tsumoAll: 4000 },
            'マンガン': { ron: [8000, 12000], tsumoKo: 2000, tsumoOya: 4000, tsumoAll: 4000 },
            '跳満': { ron: [12000, 18000], tsumoKo: 3000, tsumoOya: 6000, tsumoAll: 6000 },
            'はねまん': { ron: [12000, 18000], tsumoKo: 3000, tsumoOya: 6000, tsumoAll: 6000 },
            'ハネマン': { ron: [12000, 18000], tsumoKo: 3000, tsumoOya: 6000, tsumoAll: 6000 },
            'はね満': { ron: [12000, 18000], tsumoKo: 3000, tsumoOya: 6000, tsumoAll: 6000 },
            '倍満': { ron: [16000, 24000], tsumoKo: 4000, tsumoOya: 8000, tsumoAll: 8000 },
            'ばいまん': { ron: [16000, 24000], tsumoKo: 4000, tsumoOya: 8000, tsumoAll: 8000 },
            'バイマン': { ron: [16000, 24000], tsumoKo: 4000, tsumoOya: 8000, tsumoAll: 8000 },
            '三倍満': { ron: [24000, 36000], tsumoKo: 6000, tsumoOya: 12000, tsumoAll: 12000 },
            'さんばいまん': { ron: [24000, 36000], tsumoKo: 6000, tsumoOya: 12000, tsumoAll: 12000 },
            '役満': { ron: [32000, 48000], tsumoKo: 8000, tsumoOya: 16000, tsumoAll: 16000 },
            'やくまん': { ron: [32000, 48000], tsumoKo: 8000, tsumoOya: 16000, tsumoAll: 16000 },
        };
        return terms[term] || null;
    },

    // ========================================
    // プレイヤー名のファジーマッチ
    // ========================================
    findPlayerFuzzy(str) {
        const s = str.toLowerCase().trim();
        if (!s) return -1;

        const names = this.state.players.map(n => n.toLowerCase());

        // 完全一致
        for (let i = 0; i < 4; i++) {
            if (s === names[i]) return i;
        }

        // 部分一致（名前が文字列に含まれる）
        for (let i = 0; i < 4; i++) {
            if (s.includes(names[i]) || names[i].includes(s)) return i;
        }

        // 最初の1文字一致（短い名前の場合）
        for (let i = 0; i < 4; i++) {
            if (names[i].length >= 1 && s.startsWith(names[i][0])) return i;
        }

        // 風の呼び方にもマッチ
        const windNames = [
            ['東', 'ひがし', 'トン', 'とん', '東家', 'とんちゃ'],
            ['南', 'みなみ', 'ナン', 'なん', '南家', 'なんちゃ'],
            ['西', 'にし', 'シャー', 'しゃー', '西家', 'しゃーちゃ'],
            ['北', 'きた', 'ペー', 'ぺー', '北家', 'ぺーちゃ'],
        ];
        for (let i = 0; i < 4; i++) {
            for (const alias of windNames[i]) {
                if (s.includes(alias)) return i;
            }
        }

        return -1;
    },

    // ========================================
    // メインの音声テキスト解析
    // ========================================
    parseVoiceText(text) {
        console.log('parseVoiceText入力:', text);

        // 前処理: 漢数字→算用数字、正規化
        let t = this.kanjiToNumber(text);
        // よくある誤認識の修正
        // プレイヤー名 (A/B/C/D + 助詞)
        t = t.replace(/映画/g, 'Aが').replace(/エイガ/g, 'Aが').replace(/えいが/g, 'Aが');
        t = t.replace(/美が/g, 'Bが').replace(/火が/g, 'Bが').replace(/日が/g, 'Bが');
        t = t.replace(/滋賀/g, 'Cが').replace(/シガ/g, 'Cが').replace(/しが/g, 'Cが');
        t = t.replace(/出が/g, 'Dが').replace(/デイが/g, 'Dが').replace(/ディーが/g, 'Dが');
        t = t.replace(/永から/g, 'Aから').replace(/栄から/g, 'Aから');
        t = t.replace(/死から/g, 'Cから').replace(/市から/g, 'Cから');
        // ツモ・ロン
        t = t.replace(/坪/g, 'ツモ').replace(/つぼ/g, 'ツモ');
        t = t.replace(/スモ/g, 'ツモ').replace(/すも/g, 'ツモ');
        t = t.replace(/詰も/g, 'ツモ').replace(/積も/g, 'ツモ').replace(/摘も/g, 'ツモ');
        t = t.replace(/論/g, 'ロン').replace(/ろーん/g, 'ロン').replace(/ローン/g, 'ロン');
        t = t.replace(/ーる$/g, 'オール').replace(/おる$/g, 'オール');
        // スペースを正規化（複数→1つ）し、前後をトリム
        t = t.replace(/\s+/g, ' ').trim();
        // kanjiToNumberで入った区切り「/」のクリーンアップ:
        // 数字/数字 の形だけ残し（例: 2000/4000）、他の/はスペースに置換
        t = t.replace(/([^\d\s])\/(\d)/g, '$1 $2');  // 非数字/数字 → スペース
        t = t.replace(/(\d)\/([^\d\s])/g, '$1 $2');  // 数字/非数字 → スペース
        t = t.replace(/([^\d\s])\/([^\d\s])/g, '$1 $2'); // 非数字/非数字 → スペース
        t = t.replace(/\s+/g, ' ').trim();

        console.log('正規化後:', t);

        const findPlayer = (str) => this.findPlayerFuzzy(str);

        // ============ ツモパターン ============

        // パターン1: "Aが2000/4000ツモ" or "A 2000の4000ツモ" or "A 2000 4000 ツモ"
        const tsumoPatterns = [
            /(.+?)(?:が|の|は)\s*(\d+)\s*[/／の]\s*(\d+)\s*(?:ツモ|つも|積も)/,
            /(.+?)\s+(\d+)\s*[/／の]\s*(\d+)\s*(?:ツモ|つも)/,
            /(.+?)(?:が|の|は)\s*(\d+)\s+(\d+)\s*(?:ツモ|つも)/,
            /(.+?)\s+(\d+)\s+(\d+)\s*(?:ツモ|つも)/,
            // "2000/4000 Aがツモ" (逆順)
            /(\d+)\s*[/／の]\s*(\d+)\s*(.+?)(?:が|の)\s*(?:ツモ|つも)/,
        ];
        for (const pat of tsumoPatterns) {
            const m = t.match(pat);
            if (m) {
                let winner, ko, oya;
                if (/^\d+$/.test(m[1])) {
                    // 逆順パターン
                    ko = parseInt(m[1]);
                    oya = parseInt(m[2]);
                    winner = findPlayer(m[3]);
                } else {
                    winner = findPlayer(m[1]);
                    ko = parseInt(m[2]);
                    oya = parseInt(m[3]);
                }
                if (winner >= 0 && ko > 0 && oya > 0) {
                    return {
                        type: 'tsumo', winnerIdx: winner, koScore: ko, oyaScore: oya,
                        description: `${this.state.players[winner]} ${ko.toLocaleString()}/${oya.toLocaleString()} ツモ`
                    };
                }
            }
        }

        // パターン2: "Aが8000オール" / "Aが4000点オール" (親ツモ)
        const allPatterns = [
            /(.+?)(?:が|の|は)\s*(\d+)\s*(?:点)?\s*(?:オール|おーる|all|オル)/i,
            /(\d+)\s*(?:点)?\s*(?:オール|おーる|all)\s*(.+?)(?:が|の)\s*(?:ツモ|つも)/i,
        ];
        for (const pat of allPatterns) {
            const m = t.match(pat);
            if (m) {
                let winner, score;
                if (/^\d+$/.test(m[1])) {
                    score = parseInt(m[1]);
                    winner = findPlayer(m[2]);
                } else {
                    winner = findPlayer(m[1]);
                    score = parseInt(m[2]);
                }
                if (winner >= 0 && score > 0) {
                    return {
                        type: 'tsumo', winnerIdx: winner, koScore: score, oyaScore: score,
                        description: `${this.state.players[winner]} ${score.toLocaleString()}オール ツモ`
                    };
                }
            }
        }

        // パターン3: 麻雀用語ツモ "Aが満貫ツモ" / "Aが跳満ツモ"
        const termTsumoPatterns = [
            /(.+?)(?:が|の|は)\s*(満貫|まんがん|マンガン|跳満|はねまん|ハネマン|はね満|倍満|ばいまん|バイマン|三倍満|さんばいまん|役満|やくまん)\s*(?:ツモ|つも)/,
        ];
        for (const pat of termTsumoPatterns) {
            const m = t.match(pat);
            if (m) {
                const winner = findPlayer(m[1]);
                const termData = this.mahjongTermToScore(m[2]);
                if (winner >= 0 && termData) {
                    const isDealer = winner === this.state.dealerIndex;
                    if (isDealer) {
                        return {
                            type: 'tsumo', winnerIdx: winner, koScore: termData.tsumoAll, oyaScore: termData.tsumoAll,
                            description: `${this.state.players[winner]} ${m[2]} ${termData.tsumoAll.toLocaleString()}オール ツモ`
                        };
                    } else {
                        return {
                            type: 'tsumo', winnerIdx: winner, koScore: termData.tsumoKo, oyaScore: termData.tsumoOya,
                            description: `${this.state.players[winner]} ${m[2]} ${termData.tsumoKo.toLocaleString()}/${termData.tsumoOya.toLocaleString()} ツモ`
                        };
                    }
                }
            }
        }

        // ============ ロンパターン ============

        // チップ系キーワードがあればロンとして処理しない
        const isChipContext = /チップ|ちっぷ|祝儀|しゅうぎ/.test(t);

        if (!isChipContext) {
            // パターン4: "AからBへ3900ロン" / "AからBに3900" / "AからBへ3900点"
            const ronPatterns = [
                /(.+?)から(.+?)[へに]\s*(\d+)\s*(?:点)?\s*(?:ロン|ろん)?/,
                /(.+?)が(.+?)(?:から|に)\s*(\d+)\s*(?:点)?\s*(?:ロン|ろん)/,
                // "3900点 AからBへロン"
                /(\d+)\s*(?:点)?\s*(.+?)から(.+?)[へに]\s*(?:ロン|ろん)/,
                // "BがAに3900ロン" (和了者が主語)
                /(.+?)が(.+?)[へに]\s*(\d+)\s*(?:点)?\s*(?:ロン|ろん)/,
            ];
            for (const pat of ronPatterns) {
                const m = t.match(pat);
                if (m) {
                    let loser, winner, score;
                    if (/^\d+$/.test(m[1])) {
                        score = parseInt(m[1]);
                        loser = findPlayer(m[2]);
                        winner = findPlayer(m[3]);
                    } else if (pat === ronPatterns[3]) {
                        // "BがAに3900ロン" → B=winner, A=loser
                        winner = findPlayer(m[1]);
                        loser = findPlayer(m[2]);
                        score = parseInt(m[3]);
                    } else {
                        loser = findPlayer(m[1]);
                        winner = findPlayer(m[2]);
                        score = parseInt(m[3]);
                    }
                    if (loser >= 0 && winner >= 0 && loser !== winner && score > 0) {
                        return {
                            type: 'ron', winnerIdx: winner, loserIdx: loser, score: score,
                            description: `${this.state.players[loser]}→${this.state.players[winner]} ${score.toLocaleString()}点 ロン`
                        };
                    }
                }
            }

            // パターン5: 麻雀用語ロン "AからBへ満貫ロン" / "AからBに跳満"
            const termRonPatterns = [
                /(.+?)から(.+?)[へに]\s*(満貫|まんがん|マンガン|跳満|はねまん|ハネマン|はね満|倍満|ばいまん|バイマン|三倍満|さんばいまん|役満|やくまん)\s*(?:ロン|ろん)?/,
                /(.+?)が(.+?)[へに]\s*(満貫|まんがん|マンガン|跳満|はねまん|ハネマン|はね満|倍満|ばいまん|バイマン|三倍満|さんばいまん|役満|やくまん)\s*(?:ロン|ろん)/,
            ];
            for (const pat of termRonPatterns) {
                const m = t.match(pat);
                if (m) {
                    let loser, winner;
                    if (pat === termRonPatterns[1]) {
                        winner = findPlayer(m[1]);
                        loser = findPlayer(m[2]);
                    } else {
                        loser = findPlayer(m[1]);
                        winner = findPlayer(m[2]);
                    }
                    const termData = this.mahjongTermToScore(m[3]);
                    if (loser >= 0 && winner >= 0 && loser !== winner && termData) {
                        const isWinnerDealer = winner === this.state.dealerIndex;
                        const score = termData.ron[isWinnerDealer ? 1 : 0];
                        return {
                            type: 'ron', winnerIdx: winner, loserIdx: loser, score: score,
                            description: `${this.state.players[loser]}→${this.state.players[winner]} ${m[3]} ${score.toLocaleString()}点 ロン`
                        };
                    }
                }
            }
        }

        // ============ チップパターン ============
        if (this.state.chipEnabled) {
            const chipPatterns = [
                /(.+?)から(.+?)[へに]\s*(?:チップ|ちっぷ|祝儀|しゅうぎ)\s*(\d+)\s*(?:枚|まい)/,
                /(.+?)から(.+?)[へに]\s*(\d+)\s*(?:枚|まい)\s*(?:チップ|ちっぷ|祝儀|しゅうぎ)/,
                /(.+?)から(.+?)[へに]\s*(\d+)\s*(?:チップ|ちっぷ)/,
            ];
            for (const pat of chipPatterns) {
                const m = t.match(pat);
                if (m) {
                    const from = findPlayer(m[1]);
                    const to = findPlayer(m[2]);
                    const count = parseInt(m[3]);
                    if (from >= 0 && to >= 0 && from !== to && count > 0) {
                        return {
                            type: 'chip', fromIdx: from, toIdx: to, count: count,
                            description: `${this.state.players[from]}→${this.state.players[to]} チップ${count}枚`
                        };
                    }
                }
            }
        }

        // ============ 最終フォールバック: 数字のみ抽出 ============
        // 2つの数字 + ツモっぽい言葉があれば候補として提示
        const numbersInText = t.match(/\d+/g);
        if (numbersInText && numbersInText.length >= 2 && /ツモ|つも/.test(t)) {
            const ko = parseInt(numbersInText[0]);
            const oya = parseInt(numbersInText[1]);
            if (ko > 0 && oya > 0) {
                // プレイヤー名探し
                const cleaned = t.replace(/\d+/g, '').replace(/ツモ|つも|が|の|は/g, '');
                const winner = findPlayer(cleaned);
                if (winner >= 0) {
                    return {
                        type: 'tsumo', winnerIdx: winner, koScore: ko, oyaScore: oya,
                        description: `${this.state.players[winner]} ${ko.toLocaleString()}/${oya.toLocaleString()} ツモ`
                    };
                }
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
