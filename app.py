from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import random
import os
from sentiment import analyze_sentiment

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 'sqlite:///reviews.db'
).replace("postgres://", "postgresql://")  # Fix for Render PostgreSQL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    business_name = db.Column(db.String(200), nullable=False)
    reviewer_name = db.Column(db.String(100), default='Anonymous')
    review_text = db.Column(db.Text, nullable=False)
    rating = db.Column(db.Float, nullable=True)
    sentiment_label = db.Column(db.String(20))   # positive / neutral / negative
    sentiment_score = db.Column(db.Float)         # –1.0 → +1.0
    keywords = db.Column(db.String(500))
    source = db.Column(db.String(50), default='manual')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'business_name': self.business_name,
            'reviewer_name': self.reviewer_name,
            'review_text': self.review_text,
            'rating': self.rating,
            'sentiment_label': self.sentiment_label,
            'sentiment_score': round(self.sentiment_score, 3),
            'keywords': self.keywords.split(',') if self.keywords else [],
            'source': self.source,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


with app.app_context():
    db.create_all()


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    businesses = db.session.query(Review.business_name).distinct().all()
    businesses = [b[0] for b in businesses]
    return render_template('index.html', businesses=businesses)


@app.route('/api/submit_review', methods=['POST'])
def submit_review():
    data = request.get_json()
    if not data or not data.get('review_text') or not data.get('business_name'):
        return jsonify({'error': 'business_name and review_text are required'}), 400

    result = analyze_sentiment(data['review_text'])

    review = Review(
        business_name=data['business_name'].strip(),
        reviewer_name=data.get('reviewer_name', 'Anonymous').strip(),
        review_text=data['review_text'].strip(),
        rating=data.get('rating'),
        sentiment_label=result['label'],
        sentiment_score=result['score'],
        keywords=','.join(result['keywords']),
        source='manual',
    )
    db.session.add(review)
    db.session.commit()
    return jsonify({'success': True, 'review': review.to_dict()}), 201


@app.route('/api/reviews')
def get_reviews():
    business = request.args.get('business', '')
    limit = min(int(request.args.get('limit', 50)), 200)
    q = Review.query
    if business:
        q = q.filter_by(business_name=business)
    reviews = q.order_by(Review.created_at.desc()).limit(limit).all()
    return jsonify([r.to_dict() for r in reviews])


@app.route('/api/dashboard')
def dashboard_data():
    business = request.args.get('business', '')
    days = int(request.args.get('days', 30))
    since = datetime.utcnow() - timedelta(days=days)

    q = Review.query.filter(Review.created_at >= since)
    if business:
        q = q.filter_by(business_name=business)
    reviews = q.order_by(Review.created_at.asc()).all()

    if not reviews:
        return jsonify({'error': 'No reviews found'}), 404

    # ── Sentiment breakdown ───────────────────────────────────────────────
    counts = {'positive': 0, 'neutral': 0, 'negative': 0}
    for r in reviews:
        counts[r.sentiment_label] = counts.get(r.sentiment_label, 0) + 1

    # ── Daily trend ───────────────────────────────────────────────────────
    from collections import defaultdict
    daily = defaultdict(lambda: {'positive': 0, 'neutral': 0, 'negative': 0, 'total': 0, 'score_sum': 0})
    for r in reviews:
        day = r.created_at.strftime('%Y-%m-%d')
        daily[day][r.sentiment_label] += 1
        daily[day]['total'] += 1
        daily[day]['score_sum'] += r.sentiment_score

    trend = []
    for day in sorted(daily):
        d = daily[day]
        trend.append({
            'date': day,
            'positive': d['positive'],
            'neutral': d['neutral'],
            'negative': d['negative'],
            'avg_score': round(d['score_sum'] / d['total'], 3),
        })

    # ── Keyword frequency ─────────────────────────────────────────────────
    from collections import Counter
    kw_counter = Counter()
    pos_kw = Counter()
    neg_kw = Counter()
    for r in reviews:
        for kw in (r.keywords or '').split(','):
            kw = kw.strip()
            if kw:
                kw_counter[kw] += 1
                if r.sentiment_label == 'positive':
                    pos_kw[kw] += 1
                elif r.sentiment_label == 'negative':
                    neg_kw[kw] += 1

    avg_score = sum(r.sentiment_score for r in reviews) / len(reviews)
    avg_rating = None
    rated = [r.rating for r in reviews if r.rating is not None]
    if rated:
        avg_rating = round(sum(rated) / len(rated), 2)

    return jsonify({
        'total_reviews': len(reviews),
        'avg_score': round(avg_score, 3),
        'avg_rating': avg_rating,
        'counts': counts,
        'trend': trend,
        'top_keywords': kw_counter.most_common(20),
        'positive_keywords': pos_kw.most_common(10),
        'negative_keywords': neg_kw.most_common(10),
        'recent_reviews': [r.to_dict() for r in reversed(reviews[-5:])],
    })


@app.route('/api/seed_demo', methods=['POST'])
def seed_demo():
    """Seed database with realistic demo reviews for showcase purposes."""
    data = request.get_json() or {}
    business = data.get('business_name', 'Demo Cafe')

    # Delete existing demo data for this business
    Review.query.filter_by(business_name=business).delete()

    demo_reviews = [
        ("Alice M.", "Absolutely fantastic experience! The staff were incredibly friendly and the food was outstanding. Will definitely return!", 5, 1),
        ("Bob K.", "Good food but the waiting time was a bit long. The ambiance is great though.", 3, 3),
        ("Carol T.", "Terrible service. Waited 45 minutes and the order was wrong. Very disappointed.", 1, 5),
        ("David L.", "One of the best places I've visited. Everything was perfect — from the decor to the dessert.", 5, 7),
        ("Eva R.", "Average experience. Nothing special, nothing bad. Might come back.", 3, 9),
        ("Frank W.", "The coffee is amazing! Best espresso in town. Highly recommend.", 5, 11),
        ("Grace H.", "Not impressed. Overpriced for what you get. The food was mediocre at best.", 2, 14),
        ("Henry J.", "Lovely place, cozy atmosphere. The pastries are fresh and delicious.", 4, 16),
        ("Iris B.", "Staff was rude and dismissive. Won't be coming back here.", 1, 18),
        ("Jack N.", "Phenomenal brunch spot! The pancakes were fluffy and the mimosas were perfectly made.", 5, 20),
        ("Karen S.", "Decent place for a quick bite. Nothing extraordinary.", 3, 22),
        ("Liam P.", "Love the new menu changes. The seasonal dishes are innovative and tasty.", 5, 24),
        ("Mia C.", "Had an issue with my order but the manager resolved it quickly. Good recovery!", 4, 26),
        ("Noah F.", "The place was dirty and the food took forever. Disappointing.", 1, 28),
        ("Olivia D.", "Charming little cafe with great Wi-Fi. Perfect for working remotely.", 4, 29),
    ]

    base_date = datetime.utcnow() - timedelta(days=30)
    for name, text, rating, days_offset in demo_reviews:
        result = analyze_sentiment(text)
        review = Review(
            business_name=business,
            reviewer_name=name,
            review_text=text,
            rating=rating,
            sentiment_label=result['label'],
            sentiment_score=result['score'],
            keywords=','.join(result['keywords']),
            source='demo',
            created_at=base_date + timedelta(days=days_offset, hours=random.randint(8, 20)),
        )
        db.session.add(review)

    db.session.commit()
    return jsonify({'success': True, 'count': len(demo_reviews), 'business': business})


@app.route('/api/businesses')
def get_businesses():
    businesses = db.session.query(Review.business_name).distinct().all()
    return jsonify([b[0] for b in businesses])


if __name__ == '__main__':
    app.run(debug=True)
