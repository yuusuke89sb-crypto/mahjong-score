/**
 * 麻雀点数表
 * 日本プロ麻雀連盟公式ルールとWRC/WRC-Rルールの点数を管理
 */

const ScoreTable = {

  /**
   * ロン時の点数
   */
  getRonScore(fu, han, isDealer, rule = 'official') {
    if (han >= 13) {
      const mult = Math.floor(han / 13);
      return (isDealer ? 48000 : 32000) * mult;
    }
    if (han >= 5) return this.getManganScore(han, isDealer);

    // 30符4翻の特殊処理
    if (fu === 30 && han === 4) {
      if (rule === 'wrc') return isDealer ? 12000 : 8000;
      return isDealer ? 11600 : 7700;
    }

    const baseScore = fu * Math.pow(2, 2 + han);
    let score = isDealer ? this.roundUp(baseScore * 6) : this.roundUp(baseScore * 4);

    // 1〜4翻で満貫点以上になった場合は満貫に丸める
    // （han>=5の跳満以上は上で処理済みなので、ここに来るのは必ず満貫相当）
    const manganThreshold = isDealer ? 12000 : 8000;
    if (score >= manganThreshold) {
      return manganThreshold;
    }

    return score;
  },

  /**
   * ツモ時の点数
   */
  getTsumoScore(fu, han, isDealer, rule = 'official') {
    if (han >= 13) {
      const mult = Math.floor(han / 13);
      if (isDealer) return { allPayment: 16000 * mult };
      return { koPayment: 8000 * mult, oyaPayment: 16000 * mult };
    }
    if (han >= 5) return this.getManganTsumoScore(han, isDealer);

    // 30符4翻の特殊処理
    if (fu === 30 && han === 4) {
      if (rule === 'wrc') {
        return isDealer ? { allPayment: 4000 } : { koPayment: 2000, oyaPayment: 4000 };
      }
      return isDealer ? { allPayment: 3900 } : { koPayment: 2000, oyaPayment: 3900 };
    }

    const baseScore = fu * Math.pow(2, 2 + han);
    let result;
    if (isDealer) {
      result = { allPayment: this.roundUp(baseScore * 2) };
    } else {
      result = {
        koPayment: this.roundUp(baseScore),
        oyaPayment: this.roundUp(baseScore * 2)
      };
    }

    // 1〜4翻で合計収入が満貫閾値以上になった場合は満貫に丸める
    // （han>=5の跳満以上は上で処理済みなので、ここに来るのは必ず満貫相当）
    let totalIncome = result.allPayment ? result.allPayment * 3 : result.koPayment * 2 + result.oyaPayment;
    const manganThreshold = isDealer ? 12000 : 8000;
    if (totalIncome >= manganThreshold) {
      return this.getManganTsumoScore(5, isDealer);
    }

    return result;
  },

  /**
   * 満貫以上のロン点数
   */
  getManganScore(han, isDealer) {
    const table = {
      5: isDealer ? 12000 : 8000,
      6: isDealer ? 18000 : 12000,
      7: isDealer ? 18000 : 12000,
      8: isDealer ? 24000 : 16000,
      9: isDealer ? 24000 : 16000,
      10: isDealer ? 24000 : 16000,
      11: isDealer ? 36000 : 24000,
      12: isDealer ? 36000 : 24000
    };
    return table[han] || (isDealer ? 48000 : 32000);
  },

  /**
   * 満貫以上のツモ点数
   */
  getManganTsumoScore(han, isDealer) {
    if (isDealer) {
      const table = { 5: 4000, 6: 6000, 7: 6000, 8: 8000, 9: 8000, 10: 8000, 11: 12000, 12: 12000 };
      return { allPayment: table[han] || 16000 };
    }
    const table = {
      5: { koPayment: 2000, oyaPayment: 4000 },
      6: { koPayment: 3000, oyaPayment: 6000 },
      7: { koPayment: 3000, oyaPayment: 6000 },
      8: { koPayment: 4000, oyaPayment: 8000 },
      9: { koPayment: 4000, oyaPayment: 8000 },
      10: { koPayment: 4000, oyaPayment: 8000 },
      11: { koPayment: 6000, oyaPayment: 12000 },
      12: { koPayment: 6000, oyaPayment: 12000 }
    };
    return table[han] || { koPayment: 8000, oyaPayment: 16000 };
  },

  /**
   * 100点単位に切り上げ
   */
  roundUp(score) {
    return Math.ceil(score / 100) * 100;
  },

  /**
   * 全ての手役の組み合わせを点数の低い順に返す
   * calculator.jsのシミュレーションで使用
   */
  getAllHands(isDealer, isTsumo, rule = 'official') {
    const results = [];

    // 有効な符の組み合わせ
    // ツモ: 20符（平和ツモ）、30符以上
    // ロン: 25符（七対子）、30符以上
    const fuList = isTsumo
      ? [20, 30, 40, 50, 60, 70]
      : [25, 30, 40, 50, 60, 70];

    for (let han = 1; han <= 39; han++) {
      for (const fu of fuList) {
        // 20符（平和ツモ）は2翻以上
        if (fu === 20 && han < 2) continue;
        // 25符（七対子）は2翻以上
        if (fu === 25 && han < 2) continue;

        let score;
        if (isTsumo) {
          const t = this.getTsumoScore(fu, han, isDealer, rule);
          score = t.allPayment ? t.allPayment * 3 : t.koPayment * 2 + t.oyaPayment;
        } else {
          score = this.getRonScore(fu, han, isDealer, rule);
        }

        results.push({ fu, han, score });
      }
    }

    // 点数の低い順にソートし、重複スコアを除去（最小の翻・符を優先）
    results.sort((a, b) => a.score - b.score || a.han - b.han || a.fu - b.fu);

    // 同じスコアは最初の1つだけ残す
    const seen = new Set();
    return results.filter(h => {
      if (seen.has(h.score)) return false;
      seen.add(h.score);
      return true;
    });
  },

  /**
   * 指定点数以上になる最小の役・符の組み合わせを取得（後方互換用）
   */
  findMinimumHands(targetScore, isDealer, isTsumo, rule = 'official') {
    return this.getAllHands(isDealer, isTsumo, rule).filter(h => h.score >= targetScore);
  },

  /**
   * 点数を表示用の文字列に変換
   */
  formatScore(fu, han) {
    if (han >= 13) {
      const count = Math.floor(han / 13);
      const names = ['役満', '二倍役満', '三倍役満'];
      return names[count - 1] || `${count}倍役満`;
    }
    const hanNames = {
      5: '満貫', 6: '跳満', 7: '跳満',
      8: '倍満', 9: '倍満', 10: '倍満',
      11: '三倍満', 12: '三倍満'
    };
    if (hanNames[han]) return hanNames[han];
    return `${fu}符${han}翻`;
  }
};
