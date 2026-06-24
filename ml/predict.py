"""
Spectra AI — ML inference script.
Called from Node.js via child_process.spawnSync.
Reads JSON from stdin, writes JSON to stdout.

Input:  {"text": "...", "username": "..."}
Output: {"category": "...", "confidence": 0.95, "riskScore": 85, "scores": {...}, "source": "ml"}
"""
import sys
import json
import os
import joblib

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.pkl')

# Load model once (module level)
try:
    _model = joblib.load(MODEL_PATH)
except Exception as e:
    print(json.dumps({"error": f"Model load failed: {e}"}))
    sys.exit(1)

# Risk scores per category (0-100 scale)
CATEGORY_RISK = {
    "casino":  88,
    "pyramid": 82,
    "fraud":   90,
    "safe":    5,
}

# Keyword signals for boosting confidence (lowercase)
KEYWORD_SIGNALS = {
    "casino": [
        "казино", "слот", "ставк", "букмекер", "1xbet", "зеркало", "джекпот",
        "рулетк", "покер", "авиатор", "краш", "мелбет", "mostbet", "pinup",
        "промокод", "ставки", "выигрыш", "азарт", "депозит", "букмек",
        "вулкан", "casino", "slots", "bet", "spin", "bonus",
    ],
    "pyramid": [
        "пассивный доход", "без риска", "реферальн", "форекс", "forex",
        "трейдинг", "сигналы", "токен", "nft", "binance", "usdt", "usdt",
        "млм", "mlm", "в неделю", "в месяц", "% годовых", "робот",
        "инвестиц", "заработок", "доходност", "вложи", "вклад",
    ],
    "fraud": [
        "розыгрыш", "выиграл", "комиссию", "предоплат", "фишинг",
        "halyk_", "kaspi_admin", "kaspi_help", "взлом", "слив",
        "работа для студент", "без опыта", "доставку", "страховой взнос",
        "перевод", "приз", "победитель",
    ],
}

def keyword_boost(text: str, username: str, classes: list, proba):
    """Boost class probabilities based on keyword signals."""
    import numpy as np
    t = (text + " " + username).lower()
    boosts = {c: 0.0 for c in classes}
    for cat, signals in KEYWORD_SIGNALS.items():
        hits = sum(1 for s in signals if s in t)
        if hits > 0:
            boosts[cat] += min(hits * 0.08, 0.35)
    # Apply boosts
    proba = proba.copy().astype(float)
    for i, c in enumerate(classes):
        proba[i] += boosts[c]
    # Reduce safe if fraud keywords found
    fraud_hits = sum(boosts[c] for c in classes if c != "safe")
    safe_idx = classes.index("safe") if "safe" in classes else -1
    if safe_idx >= 0 and fraud_hits > 0:
        proba[safe_idx] = max(0.0, proba[safe_idx] - fraud_hits * 0.5)
    # Renormalize
    total = proba.sum()
    if total > 0:
        proba /= total
    return proba

def predict(text: str, username: str = "") -> dict:
    combined = text.strip()
    if not combined:
        return {"category": "safe", "confidence": 1.0, "riskScore": 0, "scores": {}, "source": "ml"}

    proba = _model.predict_proba([combined])[0]
    classes = list(_model.classes_)

    # Apply keyword boosting
    proba = keyword_boost(combined, username or "", classes, proba)

    scores = {c: round(float(p), 4) for c, p in zip(classes, proba)}
    idx = int(proba.argmax())
    category = classes[idx]
    confidence = round(float(proba[idx]), 4)

    # Compute risk score
    base_risk = CATEGORY_RISK.get(category, 5)
    if category == "safe":
        risk_score = round(base_risk + (1 - confidence) * 20)
    else:
        risk_score = round(base_risk * confidence + (1 - confidence) * 40)

    risk_score = max(0, min(100, risk_score))

    return {
        "category": category,
        "confidence": confidence,
        "riskScore": risk_score,
        "scores": scores,
        "source": "ml",
    }

if __name__ == "__main__":
    raw = sys.stdin.read().strip()
    try:
        payload = json.loads(raw)
        text = payload.get("text", "")
        username = payload.get("username", "")
    except Exception:
        text = raw
        username = ""

    result = predict(text, username)
    print(json.dumps(result, ensure_ascii=False))
