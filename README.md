# ⚡ CampusFlow

> **One campus. One calendar. Zero double bookings.**

CampusFlow is a cloud-native smart campus resource scheduling platform designed to eliminate scheduling collisions, double bookings, and the chaos of coordinating university facilities over informal messaging apps.

Built with modern vanilla web standards and architected for enterprise-scale **AWS Serverless infrastructure**.

---

## 📸 Overview

![CampusFlow](https://img.shields.io/badge/Status-Active-brightgreen)
![AWS](https://img.shields.io/badge/Architecture-AWS%20Serverless-orange)
![Database](https://img.shields.io/badge/Database-Amazon%20DynamoDB-blue)
![Theme](https://img.shields.io/badge/Theme-Light%20%26%20Dark%20Mode-purple)
![License](https://img.shields.io/badge/License-MIT-green)

### The Problem
University labs, conference rooms, and maker-spaces are frequently double-booked because student societies and faculty coordinate bookings across disparate WhatsApp groups, emails, and physical paper logs.

### The Solution
A unified, real-time visual scheduling platform backed by **Amazon DynamoDB atomic conditional checks** (`attribute_not_exists`) that guarantee mathematical concurrency protection and eliminate race conditions at university scale.

---

## ✨ Key Features

- 📅 **Signature Availability Timeline (8:00 AM – 8:00 PM)**:
  - Interactive proportional 12-hour schedule track.
  - Distinct visual states for Booked (🔴), Available (🟢), and User Reservations.
  - Instant click-to-reserve functionality on open gaps.
- 🛡️ **Smart Collision Detection Engine**:
  - Automatically identifies overlapping time intervals (`startA < endB && endA > startB`).
  - Blocks double bookings in real time.
  - Recommends smart alternative non-conflicting time slots (e.g., `4:00 PM – 5:00 PM`, `Tomorrow · 10:00 AM`).
- ☁️ **AWS Serverless Architecture Integration**:
  - Single-Table Design pattern in **Amazon DynamoDB**.
  - Sub-15ms reservation validation via **AWS Lambda**.
  - Real-time client state sync powered by **Amazon API Gateway WebSockets** and **EventBridge**.
  - Interactive live concurrency simulator in the dashboard.
- 🌓 **Dual-Theme Engine (Light & Dark Mode)**:
  - High-contrast, WCAG AAA-compliant typography.
  - Seamless toggle with state persistence in `localStorage`.
- 🎟️ **Instant Pass & Calendar Integration**:
  - RFC 5545 `.ICS` calendar export.
  - Reservation verification code and QR code generation for venue check-in.
  - Cancellation and slot release capabilities.

---

## 🏗️ System Architecture

```
[ Web Browser Client ]
        │
        ▼ (Route 53 + CloudFront CDN)
[ Static S3 Web Distribution ]
        │
        ▼ (HTTPS REST / WebSockets)
[ Amazon API Gateway ]
        │
        ▼ (Invocation)
[ AWS Lambda (Booking Manager) ]
        │
        ├──► [ Amazon DynamoDB (Single-Table Store) ]
        │        └─ ConditionExpression: attribute_not_exists(slotKey)
        │
        └──► [ Amazon EventBridge ]
                 ├─► [ Amazon SNS (Email / SMS Alerts) ]
                 └─► [ Amazon CloudWatch (Metrics & Telemetry) ]
```

### DynamoDB Single-Table Schema Pattern

| Attribute | Value Example | Description |
| :--- | :--- | :--- |
| `PK` | `RESOURCE#INNOVATION_LAB#2026-09-11` | Partition Key (Resource ID + Date) |
| `SK` | `SLOT#1400_1600` | Sort Key (Time interval lock) |
| `BookingId` | `CF-BK-103` | Unique reservation identifier |
| `BookedBy` | `Lakshay Garg` | Student / faculty member identity |
| `Status` | `CONFIRMED` | Lifecycle state |
| `Condition` | `attribute_not_exists(SK)` | Atomic concurrency check |

---

## 🚀 Quick Start & Local Development

No complex build tools or heavy dependencies required. Runs purely on native web standards.

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/CampusFlow.git
cd CampusFlow
```

### 2. Run Automated Conflict Engine Unit Tests
```bash
node test.js
```

### 3. Launch Local Server
Using Python:
```bash
python -m http.server 8080
```
*Or using Node / npx:*
```bash
npx serve -l 8080 .
```

### 4. Access the Application
Open your browser and navigate to:
```
http://localhost:8080
```

---

## 📂 Project Structure

```
CampusFlow/
├── index.html              # Core application layout & markup
├── package.json            # Project manifest & test script runner
├── test.js                 # Unit tests for the conflict detection engine
├── .gitignore              # Git ignore configuration
├── js/
│   ├── app.js              # Application orchestrator, views & theme switcher
│   ├── bookingModal.js     # Modal controller, validation & DynamoDB simulation
│   ├── conflictEngine.js   # Mathematical interval collision detection
│   ├── state.js            # Reactive state management with persistence
│   └── timeline.js         # Proportional 12-hour timeline visualizer
└── styles/
    ├── main.css            # Design tokens, variables & typography for light/dark mode
    ├── landing.css         # Public SaaS landing page styling
    ├── dashboard.css       # App dashboard, KPI cards & timeline styling
    └── modal.css           # Booking drawer, conflict alerts & receipt dialog
```

---

## 👨‍💻 Author

**Lakshay Garg**  
*Computer Science & Artificial Intelligence*

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
