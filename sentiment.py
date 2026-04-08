"""
Sentiment analysis using VADER (fast, no GPU needed).
Optionally swap to HuggingFace Transformers by setting USE_TRANSFORMERS=1 env var.
"""

import os
import re
from collections import Counter

# ── VADER (default) ───────────────────────────────────────────────────────────
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_vader = SentimentIntensityAnalyzer()

# ── HuggingFace (optional) ────────────────────────────────────────────────────
_hf_pipeline = None
if os.environ.get('USE_TRANSFORMERS', '0') == '1':
    try:
        from transformers import pipeline as hf_pipeline
        _hf_pipeline = hf_pipeline(
            'sentiment-analysis',
            model='distilbert-base-uncased-finetuned-sst-2-english',
            truncation=True,
            max_length=512,
        )
        print('[sentiment] Using HuggingFace DistilBERT model.')
    except Exception as e:
        print(f'[sentiment] HuggingFace load failed ({e}), falling back to VADER.')

# ── Stop words (simple built-in set — no NLTK required) ──────────────────────
STOP_WORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
    'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its',
    'they', 'them', 'their', 'what', 'which', 'who', 'this', 'that', 'these',
    'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'shall', 'can', 'a', 'an', 'the', 'and', 'but', 'or',
    'so', 'yet', 'for', 'nor', 'at', 'by', 'in', 'of', 'on', 'to', 'up',
    'as', 'with', 'about', 'into', 'through', 'very', 'not', 'no', 'just',
    'also', 'even', 'here', 'there', 'then', 'than', 'too', 'more', 'most',
    'other', 'some', 'such', 'only', 'own', 'same', 'few', 'both', 'all',
    'each', 'every', 'because', 'after', 'before', 'while', 'if', 'when',
    'where', 'how', 'again', 'further', 'once', 'from', 'out', 'off', 'over',
    'under', 'between', 'during', 'until', 'against', 'among', 'throughout',
    'despite', 'towards', 'upon', 'concerning',
}


def _extract_keywords(text: str, top_n: int = 8) -> list[str]:
    """Extract meaningful keywords from review text."""
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    words = [w for w in words if w not in STOP_WORDS]
    common = Counter(words).most_common(top_n)
    return [w for w, _ in common]


def _vader_sentiment(text: str) -> dict:
    scores = _vader.polarity_scores(text)
    compound = scores['compound']
    if compound >= 0.05:
        label = 'positive'
    elif compound <= -0.05:
        label = 'negative'
    else:
        label = 'neutral'
    return {'label': label, 'score': compound}


def _hf_sentiment(text: str) -> dict:
    result = _hf_pipeline(text[:512])[0]
    hf_label = result['label'].lower()   # POSITIVE / NEGATIVE
    hf_conf = result['score']            # 0.0 – 1.0
    # Map to our –1 … +1 score
    if hf_label == 'positive':
        label, score = 'positive', hf_conf
    elif hf_label == 'negative':
        label, score = 'negative', -hf_conf
    else:
        label, score = 'neutral', 0.0
    # If confidence is low, treat as neutral
    if abs(score) < 0.2:
        label = 'neutral'
    return {'label': label, 'score': score}


def analyze_sentiment(text: str) -> dict:
    """
    Returns:
        {
            'label':    'positive' | 'neutral' | 'negative',
            'score':    float  (-1.0 → +1.0),
            'keywords': list[str],
        }
    """
    if _hf_pipeline:
        result = _hf_sentiment(text)
    else:
        result = _vader_sentiment(text)

    result['keywords'] = _extract_keywords(text)
    return result
