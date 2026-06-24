"""
Spectra AI — Account Risk Scorer.
Analyzes account-level features to detect suspicious accounts.

Input (stdin JSON):
{
  "username": "casino_vulcan_kz",
  "posts": [{"caption": "...", "riskScore": 85}, ...],
  "viewCount": 89000,
  "likeCount": 5400,
  "platform": "youtube"
}

Output:
{
  "accountRisk": 92,
  "flags": ["suspicious_username", "high_avg_risk", "low_engagement"],
  "verdict": "likely_fraud"
}
"""
import sys
import json
import re

# Username patterns that indicate fraud
FRAUD_USERNAME_PATTERNS = [
    r'casin', r'казино', r'slot', r'слот', r'bet\d', r'ставк',
    r'invest\d', r'инвест', r'profit', r'earn_kz', r'заработ',
    r'forex', r'форекс', r'crypto', r'крипт',
    r'kaspi_admin', r'kaspi_help', r'kaspi_gift', r'kaspi_prize',
    r'halyk_bonus', r'bank_help',
    r'prize', r'prizy', r'розыгрыш', r'win_kz',
    r'mlm_kz', r'network_kz', r'реферал',
    r'999', r'777', r'666',  # numeric flags
]

def score_username(username: str) -> tuple[int, list[str]]:
    u = username.lower()
    flags = []
    score = 0
    for pat in FRAUD_USERNAME_PATTERNS:
        if re.search(pat, u):
            flags.append("suspicious_username")
            score += 20
            break
    return min(score, 30), flags

def score_posts(posts: list) -> tuple[int, list[str]]:
    if not posts:
        return 0, []
    flags = []
    risk_scores = [p.get("riskScore", 0) for p in posts]
    avg_risk = sum(risk_scores) / len(risk_scores)
    high_risk_count = sum(1 for r in risk_scores if r >= 70)
    score = 0
    if avg_risk >= 75:
        flags.append("high_avg_risk")
        score += 35
    elif avg_risk >= 50:
        flags.append("medium_avg_risk")
        score += 20
    if high_risk_count >= 2:
        flags.append("multiple_high_risk_posts")
        score += 20
    return min(score, 55), flags

def score_engagement(view_count: int, like_count: int) -> tuple[int, list[str]]:
    flags = []
    score = 0
    if view_count > 0:
        ratio = like_count / view_count
        if ratio < 0.001 and view_count > 10000:
            flags.append("suspicious_low_engagement")
            score += 15
        elif ratio > 0.5:
            flags.append("suspicious_high_engagement")
            score += 10
    return score, flags

def get_verdict(total_score: int) -> str:
    if total_score >= 75:
        return "likely_fraud"
    elif total_score >= 50:
        return "suspicious"
    elif total_score >= 25:
        return "watch"
    else:
        return "clean"

def score_account(data: dict) -> dict:
    username = data.get("username", "")
    posts = data.get("posts", [])
    view_count = data.get("viewCount", 0)
    like_count = data.get("likeCount", 0)

    s1, f1 = score_username(username)
    s2, f2 = score_posts(posts)
    s3, f3 = score_engagement(view_count, like_count)

    total = min(s1 + s2 + s3, 100)
    all_flags = list(set(f1 + f2 + f3))
    verdict = get_verdict(total)

    return {
        "accountRisk": total,
        "flags": all_flags,
        "verdict": verdict,
        "breakdown": {
            "usernameScore": s1,
            "postsScore": s2,
            "engagementScore": s3,
        }
    }

if __name__ == "__main__":
    raw = sys.stdin.read().strip()
    try:
        data = json.loads(raw)
    except Exception:
        print(json.dumps({"error": "Invalid JSON input"}))
        sys.exit(1)

    result = score_account(data)
    print(json.dumps(result, ensure_ascii=False))
