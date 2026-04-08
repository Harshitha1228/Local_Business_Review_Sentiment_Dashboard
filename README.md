# SentimentScope — Local Business Review Sentiment Dashboard

A full-stack Flask application that performs **NLP sentiment analysis** on business reviews and visualises trends through an interactive dashboard.

---

## ✨ Features

- **Sentiment analysis** via VADER (fast, offline) or HuggingFace DistilBERT (optional)
- **Interactive dashboard** with Chart.js — trend lines, donut chart, keyword bar charts
- **Review submission** with star rating and instant sentiment feedback
- **Keyword extraction** — top positive & negative keywords per business
- **Demo data seeder** — one-click demo data for showcasing
- **Multi-business support** — analyse multiple businesses independently
- **Deployable to Render** with PostgreSQL in minutes

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11 + Flask |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | SQLAlchemy via Flask-SQLAlchemy |
| NLP | VADER Sentiment + optional HuggingFace |
| Charts | Chart.js 4 |
| Deployment | Render (render.yaml included) |

---

## 🚀 Local Setup

### 1. Clone & enter the project

```bash
git clone https://github.com/YOUR_USERNAME/sentiment-dashboard.git
cd sentiment-dashboard
```

### 2. Create a virtual environment

```bash
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the app

```bash
python app.py
```

Open **http://127.0.0.1:5000** in your browser.

### 5. Load demo data

Click **⚡ Load Demo Data** on the dashboard, or call the API directly:

```bash
curl -X POST http://127.0.0.1:5000/api/seed_demo \
     -H "Content-Type: application/json" \
     -d '{"business_name": "My Cafe"}'
```

---

## 🤗 Optional: HuggingFace Transformers (higher accuracy)

```bash
pip install transformers torch
USE_TRANSFORMERS=1 python app.py
```

This loads `distilbert-base-uncased-finetuned-sst-2-english` (first run downloads ~260 MB).

---

## 🌐 Deploy to Render (Free Tier)

### Option A — Auto deploy with render.yaml (recommended)

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New → Blueprint**.
3. Select your repo — Render reads `render.yaml` and creates both the web service and PostgreSQL database automatically.
4. Done ✅

### Option B — Manual deploy

1. **New Web Service** → connect your GitHub repo
2. Build command: `pip install -r requirements.txt`
3. Start command: `gunicorn app:app`
4. Add environment variable: `DATABASE_URL` → your Render PostgreSQL connection string

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Dashboard UI |
| `GET` | `/api/dashboard?business=&days=30` | Dashboard analytics data |
| `GET` | `/api/reviews?business=&limit=50` | Paginated review list |
| `GET` | `/api/businesses` | List of all businesses |
| `POST` | `/api/submit_review` | Submit a new review |
| `POST` | `/api/seed_demo` | Seed demo reviews |

### Submit Review — Request Body

```json
{
  "business_name": "Cafe Mornings",
  "reviewer_name": "Alice",
  "review_text": "Amazing coffee and friendly staff!",
  "rating": 5
}
```

### Submit Review — Response

```json
{
  "success": true,
  "review": {
    "id": 1,
    "sentiment_label": "positive",
    "sentiment_score": 0.784,
    "keywords": ["amazing", "coffee", "friendly", "staff"]
  }
}
```

---

## 📁 Project Structure

```
sentiment-dashboard/
├── app.py               # Flask routes + SQLAlchemy models
├── sentiment.py         # Sentiment analysis (VADER / HuggingFace)
├── requirements.txt
├── Procfile             # Gunicorn start command
├── render.yaml          # Render deployment blueprint
├── .gitignore
├── templates/
│   └── index.html       # Single-page dashboard UI
└── static/
    ├── css/style.css    # Dark theme dashboard styles
    └── js/app.js        # Chart.js + fetch API interactions
```

---

## 🧪 Running Tests

```bash
pip install pytest
pytest tests/          # (add tests/test_api.py for your own test cases)
```

---

## 📄 Licence

MIT — free to use, modify, and deploy.
