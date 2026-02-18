/**
 * カメラ認識モジュール
 * スマートフォンのカメラで点棒スコアを撮影し、OCRで数値を抽出する
 * 100点未満の端数は切り捨て（例: 20080 → 20000）
 */

const CameraRecognizer = {
    stream: null,
    worker: null,
    isWorkerReady: false,

    /**
     * Tesseract.js ワーカーを初期化（バックグラウンドで準備）
     */
    async initWorker() {
        if (this.worker) return;
        try {
            this.worker = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const pct = Math.round(m.progress * 100);
                        const bar = document.getElementById('ocr-progress-bar');
                        if (bar) bar.style.width = pct + '%';
                    }
                }
            });
            // 数字のみ認識
            await this.worker.setParameters({
                tessedit_char_whitelist: '0123456789',
                tessedit_pageseg_mode: '6'
            });
            this.isWorkerReady = true;
        } catch (e) {
            console.error('Tesseract初期化エラー:', e);
            this.worker = null;
        }
    },

    /**
     * カメラを起動してプレビューを開始
     */
    async startCamera() {
        try {
            // 背面カメラを優先
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            const video = document.getElementById('camera-preview');
            video.srcObject = this.stream;
            await video.play();
            return true;
        } catch (e) {
            console.error('カメラ起動エラー:', e);
            return false;
        }
    },

    /**
     * カメラストリームを停止
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        const video = document.getElementById('camera-preview');
        if (video) video.srcObject = null;
    },

    /**
     * 現在のビデオフレームをcanvasに描画して画像データを取得
     */
    captureFrame() {
        const video = document.getElementById('camera-preview');
        const canvas = document.getElementById('camera-canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        return canvas;
    },

    /**
     * 画像前処理：グレースケール化・コントラスト強調
     */
    preprocessImage(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            // グレースケール
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            // コントラスト強調（二値化に近づける）
            const enhanced = gray > 128 ? Math.min(255, gray * 1.3) : Math.max(0, gray * 0.7);
            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    },

    /**
     * OCRを実行して数値を抽出
     * @returns {number[]} 認識した数値の配列（100点単位に丸め済み）
     */
    async recognize() {
        if (!this.isWorkerReady) {
            throw new Error('OCRエンジンが準備できていません');
        }

        const canvas = this.captureFrame();
        this.preprocessImage(canvas);

        const { data: { text } } = await this.worker.recognize(canvas);
        console.log('OCR生テキスト:', text);

        return this.extractScores(text);
    },

    /**
     * OCRテキストから麻雀スコアらしい数値を抽出
     * - 100点未満は切り捨て（100点単位に丸め）
     * - 麻雀の点数として妥当な範囲（0〜60000）でフィルタ
     * @param {string} text
     * @returns {number[]}
     */
    extractScores(text) {
        // 数字の塊を抽出
        const tokens = text.match(/\d+/g) || [];
        console.log('抽出トークン:', tokens);

        const scores = tokens
            .map(t => parseInt(t, 10))
            .filter(n => n >= 0 && n <= 60000)  // 麻雀の点数として妥当な範囲
            .map(n => Math.floor(n / 100) * 100)  // 100点未満切り捨て
            .filter(n => n >= 0);

        console.log('抽出スコア:', scores);
        return scores;
    },

    /**
     * ワーカーを終了（アプリ終了時）
     */
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isWorkerReady = false;
        }
    }
};
