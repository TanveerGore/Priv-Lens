# 🔒 PrivLens — AI Privacy Guardian

> Real-time AI-powered privacy policy analysis, risk scoring, and tracker detection for every website you visit.

![PrivLens](https://img.shields.io/badge/PrivLens-v1.0.0-6366F1?style=for-the-badge&logo=shield&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Summarization** | GPT-4o-mini / Gemini / Claude summarizes policies in plain English |
| 📊 **Privacy Score** | Algorithmic 0–10 scoring with animated ring visualization |
| ⚠️ **Risk Detection** | Identifies risky clauses: data selling, tracking, retention |
| 🕵️ **Tracker Detection** | Real-time detection of 35+ known trackers via Chrome WebRequest |
| 🔍 **Policy Discovery** | Automatically finds privacy policy links on any website |
| 🔄 **Mismatch Warning** | Detects contradictions between policy claims and actual trackers |
| 💾 **30-min Cache** | Results cached to avoid redundant API calls |

---

## 📁 Project Structure

```
privlens/
├── extension/              # Chrome Extension
│   ├── manifest.json       # Extension manifest (v3)
│   ├── popup.html          # Extension popup UI
│   ├── popup.css           # Premium dark glassmorphic styles
│   ├── popup.js            # Popup logic & API integration
│   ├── content.js          # Page-injected policy URL detector
│   ├── background.js       # Service worker + tracker detection
│   └── icons/              # Extension icons (16, 48, 128px)
│
├── backend/                # Node.js Express API
│   ├── server.js           # Express server entry point
│   ├── .env.example        # Environment variables template
│   ├── package.json        # Node dependencies
│   └── routes/
│       └── analyze.js      # POST /api/analyze route
│   └── services/
│       ├── policyScraper.js   # Fetches & parses privacy pages
│       ├── aiSummarizer.js    # OpenAI / Gemini / Claude integration
│       └── privacyScore.js    # Privacy scoring algorithm
│
├── ui-assets/
│   └── design-tokens.css   # Shared CSS design system
│
└── README.md
```

---

## 🚀 Installation & Setup

### Prerequisites

- Node.js 18+ installed
- Chrome browser
- An API key for **OpenAI**, **Google Gemini**, or **Anthropic Claude**

---

### 1. Clone / Download

```bash
git clone https://github.com/your-repo/privlens.git
cd privlens
```

---

### 2. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
```

Edit `.env` and add your API key:

```env
# Choose your AI provider
AI_PROVIDER=openai          # or: gemini | claude

# OpenAI (recommended for best results)
OPENAI_API_KEY=sk-...your-key...
OPENAI_MODEL=gpt-4o-mini

# OR Google Gemini (free tier available)
# GEMINI_API_KEY=AIza...your-key...
# GEMINI_MODEL=gemini-1.5-flash

# OR Anthropic Claude
# ANTHROPIC_API_KEY=sk-ant-...your-key...
# CLAUDE_MODEL=claude-3-haiku-20240307

PORT=3000
```

---

### 3. Start the Backend Server

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

You should see:
```
🔒 PrivLens API running at http://localhost:3000
   Health: http://localhost:3000/health
   Analyze: POST http://localhost:3000/api/analyze
```

---

### 4. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer Mode** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `privlens/extension/` folder
5. The PrivLens icon will appear in your toolbar

---

### 5. Using PrivLens

1. Navigate to any website (e.g., `amazon.com`, `instagram.com`)
2. Click the PrivLens icon in Chrome toolbar
3. The extension will automatically:
   - Detect the website domain
   - Find the privacy policy link
   - Scrape and analyze the policy
   - Display your privacy score + AI summary

---

## 🔌 API Reference

### `POST /api/analyze`

Analyze a website's privacy policy.

**Request:**
```json
{
  "domain": "amazon.com",
  "policyUrl": "https://www.amazon.com/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ",
  "trackers": ["Google Analytics", "Amazon Pixel"]
}
```

**Response:**
```json
{
  "domain": "amazon.com",
  "policy_url": "https://amazon.com/privacy",
  "summary": "Amazon collects extensive behavioral data for personalization and advertising across its ecosystem.",
  "risk_points": [
    "User behavior data shared with advertising partners",
    "Third-party tracking cookies enabled",
    "Data retained indefinitely or for long periods"
  ],
  "privacy_score": 4,
  "risk_level": "High Risk",
  "trackers": ["Google Analytics", "Amazon Pixel"],
  "mismatches": [],
  "policy_found": true
}
```

### `GET /health`

```json
{ "status": "ok", "service": "PrivLens API", "version": "1.0.0" }
```

---

## 🎨 UI Design System

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#6366F1` | Indigo — brand, buttons |
| `--color-success` | `#22C55E` | Green — safe score |
| `--color-warning` | `#FACC15` | Yellow — moderate risk |
| `--color-danger`  | `#EF4444` | Red — high risk |
| `--bg-base`       | `#0A0F1E` | Dark background |
| `--font-display`  | Syne      | Headings |
| `--font-body`     | DM Sans   | Body text |

---

## 🛡️ Privacy Score Algorithm

| Condition | Points |
|---|---|
| Data shared with advertisers | −2 |
| Third-party tracking enabled | −2 |
| Long/undefined data retention | −1 |
| Vague privacy language | −1 |
| No user rights mentioned | −1 |
| Data sold to third parties | −2 |
| Tracker detected on page (each) | −0.5 to −1.5 |
| User data deletion allowed | +1 |

**Levels:**
- 🟢 **Safe** (8–10)
- 🟡 **Moderate Risk** (5–7)
- 🔴 **High Risk** (0–4)

---

## 🐛 Troubleshooting

**Extension shows "Analysis failed"**
- Make sure the backend is running: `npm start` in the `backend/` folder
- Verify your API key is set in `.env`
- Check the browser console for errors

**"Could not find policy"**
- The site may block scraping (e.g. very large SPAs)
- The extension will fall back to AI analysis based on domain + trackers

**CORS errors**
- The backend already allows all origins including `chrome-extension://`
- If issues persist, check your firewall isn't blocking port 3000

---

## 📄 License

MIT License — built for demonstration and educational purposes.

---

*Built with ❤️ for hackathon demo — PrivLens v1.0.0*
