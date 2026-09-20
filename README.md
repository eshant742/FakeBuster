# 🛡️ FakeBuster — AI-Powered Scam & Deepfake Detector

> **Protect your family from digital deception.** FakeBuster uses Amazon Bedrock's Claude AI to analyze suspicious text messages, images, and audio calls in real-time — detecting scams, phishing, and manipulation that humans often miss.

**Built for [AWS First Commit Hackathon](https://www.wemakedevs.org/aws/first-commit) — Bharat Builds Tour 2026** | Team Gawds

---

## 🎯 The Problem

In India, digital fraud losses exceeded **₹1,750 crore** in 2023-24 (RBI data). Our parents and grandparents are the most vulnerable — they receive fake bank OTP messages, fraudulent job offers, AI-generated scam calls, and manipulated UPI receipts on WhatsApp every single day.

**Most people don't know how to tell a scam from a real message.** The psychological manipulation in modern scams is sophisticated enough to fool even tech-savvy users.

## ✨ The Solution

FakeBuster provides a **dead-simple, one-click interface** where anyone — including your grandmother — can verify if a message, image, or call is a scam. No technical knowledge required.

### Features

| Feature | How It Works | AWS Service |
|---------|-------------|-------------|
| **📝 Text & Social Analysis** | Paste any SMS, WhatsApp forward, Instagram DM, or URL | Amazon Bedrock (Claude 3 Haiku) |
| **🖼️ Image & Screenshot Analysis** | Upload payment receipts, UPI screenshots, fake login pages | Amazon Bedrock (Multimodal) |
| **🎙️ Audio Call Analysis** | Upload voice notes or call recordings | Amazon S3 → Amazon Transcribe → Amazon Bedrock |
| **🎯 Instant Threat Score** | 0-100 score with visual gauge, verdict, and red flags | — |
| **🧪 Sample Scam Library** | One-click samples to test instantly | — |
| **📋 Copy Report** | Share the analysis with family | — |

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│             │     │   Next.js API    │     │  Amazon Bedrock  │
│   Browser   │────▶│     Routes       │────▶│  Claude 3 Haiku  │
│  (React UI) │     │                  │     │  (AI Analysis)   │
│             │◀────│  /api/analyze/*  │◀────│                  │
└─────────────┘     └──────┬───────────┘     └─────────────────┘
                           │
                    ┌──────┴───────┐
                    │  Amazon S3   │──────▶ Amazon Transcribe
                    │ (Audio Store)│◀────── (Speech-to-Text)
                    └──────────────┘
```

### Data Flow

1. **Text Analysis**: User text → API route → Bedrock Claude 3 Haiku → JSON result
2. **Image Analysis**: Image → base64 encode → API route → Bedrock multimodal → JSON result
3. **Audio Analysis**: Audio file → S3 upload → Transcribe job → transcript → Bedrock analysis → JSON result

---

## 🔧 AWS Services Used

| Service | Purpose | Why This Service |
|---------|---------|-----------------|
| **Amazon Bedrock** (Claude 3 Haiku) | AI analysis of text and images | Ultra-fast (~0.5s), ultra-cheap ($0.00025/1K tokens), supports multimodal input |
| **Amazon S3** | Temporary storage of uploaded audio | Required as input source for Amazon Transcribe |
| **Amazon Transcribe** | Speech-to-text conversion for audio analysis | Supports 100+ languages, high accuracy, pay-per-use |
| **AWS Amplify** | Hosting and CI/CD deployment | Auto-deploys from GitHub, handles Next.js SSR natively |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **AWS Account** with Free Tier or credits
- **Bedrock Model Access** enabled for Claude 3 Haiku in `us-east-1`

### 1. Clone & Install

```bash
git clone https://github.com/eshant742/FakeBuster.git
cd FakeBuster
npm install
```

### 2. Configure AWS Credentials

Create a `.env.local` file in the project root (or copy from `.env.example`):

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=fakebuster-audio-uploads
```

### 3. Enable Bedrock Model Access

1. Go to [AWS Console → Amazon Bedrock → Model Access](https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess)
2. Click **"Manage model access"**
3. Enable **"Claude 3 Haiku"** by Anthropic
4. Click **"Save changes"** (approval is usually instant)

### 4. Create S3 Bucket (for Audio Analysis)

```bash
aws s3 mb s3://fakebuster-audio-uploads --region us-east-1
```

Or create it via the AWS Console → S3 → Create Bucket.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📸 Screenshots

> _Screenshots will be added after demo recording._

---

## 👥 Team Gawds

| Name | Role | Key Contributions |
|------|------|-------------------|
| **Eshant Gupta** (Leader) | Full-Stack Developer | Architecture design, AWS Bedrock integration, frontend UI |
| **Aditya** | Backend Developer | API route development, Bedrock prompt engineering |
| **Mayank** | Frontend Developer | UI/UX design, responsive layout, CSS animations |
| **Arun Kumar Swami** | Cloud Engineer | AWS S3/Transcribe setup, IAM configuration, deployment |

---

## 📝 What We Learned

- Integrating **Amazon Bedrock** with the Claude 3 Messages API for both text and multimodal (image) analysis
- Building the **S3 → Transcribe → Bedrock pipeline** for audio processing, including async job polling
- Crafting effective **AI prompts for cybersecurity** that reliably produce structured JSON output
- Designing a **dark-mode glassmorphism UI** with CSS animations for a premium feel
- Using **Next.js 14 App Router** API routes as lightweight serverless functions connected to AWS

---

## 💰 Cost Analysis

FakeBuster is extremely cost-efficient:

| Operation | Cost per Request | With $100 Credits |
|-----------|-----------------|-------------------|
| Text scan | ~$0.0003 | ~333,000 scans |
| Image scan | ~$0.001 | ~100,000 scans |
| Audio scan (30s clip) | ~$0.01 | ~10,000 scans |

---

## 🔒 Security

- All AWS credentials stored in `.env.local` (never committed to git)
- User inputs are truncated to prevent prompt injection
- System prompts are separated from user content
- Audio files can be auto-deleted from S3 via lifecycle policies
- No user data is stored permanently

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS 3, Lucide React icons
- **Backend**: Next.js App Router API routes (Node.js runtime)
- **AI**: Amazon Bedrock (Claude 3 Haiku by Anthropic)
- **Storage**: Amazon S3
- **Speech-to-Text**: Amazon Transcribe
- **Hosting**: AWS Amplify
- **Language**: TypeScript

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ by <strong>Team Gawds</strong> for <strong>AWS First Commit Hackathon</strong> — Bharat Builds Tour 2026
</p>
