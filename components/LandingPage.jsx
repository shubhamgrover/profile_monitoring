'use client';

import { useState } from 'react';

export default function LandingPage({ onGetStarted }) {
  const [accounts, setAccounts] = useState(150);
  const [trackExtraExecs, setTrackExtraExecs] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);

  // Calculate slots & pricing tier
  const slotsNeeded = accounts * (trackExtraExecs ? 3 : 2);
  let recommendedPlan = 'Starter Plan';
  let planPrice = '₹9,900';

  if (slotsNeeded > 100 && slotsNeeded <= 450) {
    recommendedPlan = 'Pro Plan';
    planPrice = '₹24,900';
  } else if (slotsNeeded > 450) {
    recommendedPlan = 'Scale Plan';
    planPrice = '₹49,900';
  }

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="landing-root">
      {/* Google Fonts and Material Icons */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Geist:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {/* High-Fidelity Custom CSS Stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Container and resets */
        .landing-root {
          background-color: #131318;
          color: #e4e1e9;
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
          line-height: 1.6;
        }
        .landing-root * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* Typography */
        h1, h2, h3, h4 {
          font-family: 'Geist', sans-serif;
          color: #ffffff;
        }

        /* Header & Nav */
        .header {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          z-index: 100;
          background-color: rgba(19, 19, 24, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .nav-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          height: 80px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo {
          font-size: 24px;
          font-weight: 800;
          color: #e4e1e9;
          letter-spacing: -0.04em;
          font-family: 'Geist', sans-serif;
          display: flex;
          align-items: center;
          text-decoration: none;
        }
        .logo-highlight {
          color: #FF2A00;
        }
        .nav-menu {
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .nav-link {
          color: #c5c5d3;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          transition: color 0.2s;
          text-decoration: none;
        }
        .nav-link:hover {
          color: #ffffff;
        }

        /* Buttons */
        .btn-primary {
          background-color: #FF2A00;
          color: #ffffff;
          border: none;
          padding: 10px 24px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(255, 42, 0, 0.25);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }
        .btn-primary:hover {
          box-shadow: 0 0 25px rgba(255, 42, 0, 0.6);
          transform: translateY(-1px);
        }
        .btn-outline {
          border: 1px solid #132D7D;
          background-color: transparent;
          color: #b7c4ff;
          padding: 14px 32px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn-outline:hover {
          background-color: rgba(19, 45, 125, 0.15);
          border-color: #b7c4ff;
          color: #ffffff;
        }

        /* Hero Section */
        .hero {
          position: relative;
          max-width: 1200px;
          margin: 0 auto;
          padding: 140px 24px 60px 24px;
          text-align: center;
        }
        .glow-blur {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 800px;
          height: 400px;
          background-color: rgba(19, 45, 125, 0.12);
          filter: blur(100px);
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
        }
        .hero-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.15em;
          color: #FF2A00;
          text-transform: uppercase;
          margin-bottom: 24px;
          z-index: 2;
          position: relative;
        }
        .hero-title {
          font-size: 64px;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.02em;
          max-width: 900px;
          margin: 0 auto 32px auto;
          z-index: 2;
          position: relative;
        }
        .hero-title span {
          color: #FF2A00;
        }
        .hero-actions {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 64px;
          z-index: 2;
          position: relative;
        }
        .hero-preview-container {
          max-width: 960px;
          margin: 0 auto;
          background: rgba(26, 26, 33, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 8px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(12px);
          z-index: 2;
          position: relative;
        }
        .hero-preview-img {
          width: 100%;
          border-radius: 12px;
          display: block;
        }

        /* Section Layouts */
        .section {
          padding: 96px 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .section-alt {
          background-color: #0e0e13;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .section-header {
          text-align: center;
          margin-bottom: 64px;
        }
        .section-title {
          font-size: 36px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .section-subtitle {
          color: #c5c5d3;
          max-width: 600px;
          margin: 0 auto;
          font-size: 16px;
        }

        /* How It Works Grid */
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }
        .card {
          background: rgba(26, 26, 33, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px 32px;
          text-align: center;
          transition: all 0.3s ease;
          backdrop-filter: blur(12px);
        }
        .card:hover {
          transform: translateY(-8px);
          border-color: rgba(183, 196, 255, 0.3);
          box-shadow: 0 12px 30px rgba(19, 45, 125, 0.2);
        }
        .card-featured {
          border-top: 2px solid #FF2A00;
        }
        .card-icon-wrapper {
          width: 64px;
          height: 64px;
          background-color: rgba(19, 45, 125, 0.2);
          border: 1px solid rgba(183, 196, 255, 0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px auto;
          transition: all 0.3s;
        }
        .card:hover .card-icon-wrapper {
          background-color: rgba(255, 42, 0, 0.15);
          border-color: rgba(255, 42, 0, 0.4);
        }
        .card-icon {
          font-size: 32px;
          color: #b7c4ff;
          transition: color 0.3s;
        }
        .card:hover .card-icon {
          color: #FF2A00;
        }
        .card-title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .card-description {
          color: #c5c5d3;
          font-size: 14px;
          line-height: 1.6;
        }

        /* Feature Showcase Rows */
        .feature-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
          margin-bottom: 96px;
        }
        .feature-row:last-child {
          margin-bottom: 0;
        }
        .feature-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 4px;
          background-color: rgba(255, 42, 0, 0.1);
          color: #FF2A00;
          border: 1px solid rgba(255, 42, 0, 0.2);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          margin-bottom: 24px;
        }
        .feature-badge-blue {
          background-color: rgba(183, 196, 255, 0.1);
          color: #b7c4ff;
          border: 1px solid rgba(183, 196, 255, 0.2);
        }
        .feature-badge-white {
          background-color: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .feature-title {
          font-size: 36px;
          font-weight: 700;
          margin-bottom: 20px;
        }
        .feature-text {
          color: #c5c5d3;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 32px;
        }
        .feature-list {
          list-style: none;
        }
        .feature-list-item {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 15px;
        }
        .feature-list-item span {
          color: #4CAF82;
        }
        .feature-image-wrapper {
          background: rgba(26, 26, 33, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 6px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          overflow: hidden;
          aspect-ratio: 16/9;
        }
        .feature-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 14px;
          transition: transform 0.7s ease;
        }
        .feature-image-wrapper:hover .feature-image {
          transform: scale(1.03);
        }
        .feature-alert-box {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: #1b1b20;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          margin-top: 24px;
        }
        .feature-alert-icon {
          color: #FF2A00;
          font-size: 24px;
        }
        .feature-alert-text {
          font-size: 14px;
          color: #e4e1e9;
        }

        /* Calculator Sandbox */
        .calc-card {
          background: rgba(26, 26, 33, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 48px;
          max-width: 768px;
          margin: 0 auto;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .calc-title {
          font-size: 32px;
          text-align: center;
          margin-bottom: 40px;
        }
        .calc-group {
          margin-bottom: 40px;
        }
        .calc-label-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
          font-size: 18px;
          font-weight: 500;
        }
        .calc-value-highlight {
          color: #FF2A00;
          font-weight: 700;
        }
        .calc-slider {
          width: 100%;
          height: 8px;
          background-color: #2a292f;
          border-radius: 4px;
          outline: none;
          -webkit-appearance: none;
          cursor: pointer;
        }
        .calc-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: #FF2A00;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .calc-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .calc-checkbox-row {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 16px;
        }
        .calc-checkbox {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          accent-color: #FF2A00;
          cursor: pointer;
        }
        .calc-result-box {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 32px;
          text-align: center;
        }
        .calc-result-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          text-transform: uppercase;
          color: #c5c5d3;
          margin-bottom: 8px;
        }
        .calc-result-title {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .calc-badge {
          display: inline-block;
          padding: 12px 24px;
          background-color: rgba(19, 45, 125, 0.2);
          color: #b7c4ff;
          border: 1px solid rgba(19, 45, 125, 0.4);
          border-radius: 30px;
          font-weight: 700;
        }

        /* Social Proof & Quotes */
        .stats-showcase {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
        }
        .stat-item {
          text-align: left;
        }
        .stat-number {
          font-size: 72px;
          font-weight: 800;
          color: #FF2A00;
          margin-bottom: 8px;
          line-height: 1;
        }
        .stat-desc-title {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .stat-desc {
          color: #c5c5d3;
          line-height: 1.6;
        }
        .quote-card {
          background: rgba(26, 26, 33, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px;
          position: relative;
        }
        .quote-icon {
          position: absolute;
          top: -20px;
          left: -20px;
          font-size: 96px;
          color: rgba(183, 196, 255, 0.05);
          font-family: serif;
        }
        .quote-text {
          font-size: 20px;
          font-style: italic;
          line-height: 1.6;
          margin-bottom: 24px;
          position: relative;
          z-index: 2;
        }
        .quote-author {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .quote-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: rgba(19, 45, 125, 0.3);
          overflow: hidden;
        }
        .quote-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .quote-meta-name {
          font-weight: 700;
          color: #ffffff;
        }
        .quote-meta-title {
          font-size: 13px;
          color: #c5c5d3;
        }

        /* Pricing Grid */
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          align-items: stretch;
        }
        .price-card {
          background: rgba(26, 26, 33, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 48px 40px;
          display: flex;
          flex-direction: column;
          transition: all 0.3s;
        }
        .price-card:hover {
          border-color: rgba(183, 196, 255, 0.3);
          transform: translateY(-4px);
        }
        .price-card-popular {
          border: 2px solid #FF2A00;
          box-shadow: 0 24px 50px rgba(0, 0, 0, 0.5);
          transform: scale(1.03);
          position: relative;
          z-index: 10;
        }
        .price-card-popular:hover {
          border-color: #FF2A00;
          transform: scale(1.03) translateY(-4px);
        }
        .popular-badge {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #FF2A00;
          color: #ffffff;
          padding: 4px 16px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .price-tier {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .price-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 24px;
        }
        .price-amount {
          font-size: 40px;
          font-weight: 800;
          color: #ffffff;
        }
        .price-period {
          color: #c5c5d3;
          font-size: 14px;
        }
        .price-slots {
          color: #b7c4ff;
          font-weight: 700;
          margin-bottom: 32px;
          font-size: 15px;
        }
        .price-slots-red {
          color: #FF2A00;
        }
        .price-features {
          list-style: none;
          margin-bottom: 40px;
          flex-grow: 1;
        }
        .price-feature-item {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 14px;
          color: #c5c5d3;
        }
        .price-feature-item span {
          color: #4CAF82;
          font-size: 18px;
        }
        .btn-price-primary {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          background-color: #FF2A00;
          color: #ffffff;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          display: block;
          text-align: center;
          text-decoration: none;
        }
        .btn-price-primary:hover {
          box-shadow: 0 0 20px rgba(255, 42, 0, 0.5);
        }
        .btn-price-outline {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          background-color: transparent;
          border: 1px solid #b7c4ff;
          color: #b7c4ff;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: block;
          text-align: center;
          text-decoration: none;
        }
        .btn-price-outline:hover {
          background-color: rgba(183, 196, 255, 0.08);
        }

        /* FAQ Accordion */
        .faq-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .faq-item {
          background: rgba(26, 26, 33, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          overflow: hidden;
        }
        .faq-trigger {
          width: 100%;
          padding: 24px;
          background: transparent;
          border: none;
          text-align: left;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }
        .faq-question {
          font-size: 18px;
          font-weight: 600;
          color: #ffffff;
        }
        .faq-trigger:hover .faq-question {
          color: #FF2A00;
        }
        .faq-answer {
          padding: 0 24px 24px 24px;
          color: #c5c5d3;
          font-size: 15px;
          line-height: 1.6;
        }

        /* Grand CTA */
        .grand-cta-card {
          position: relative;
          background: rgba(26, 26, 33, 0.7);
          border: 2px solid rgba(255, 42, 0, 0.2);
          border-radius: 48px;
          padding: 80px 40px;
          text-align: center;
          overflow: hidden;
        }
        .grand-cta-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 42, 0, 0.05) 0%, transparent 50%, rgba(19, 45, 125, 0.05) 100%);
          z-index: 1;
        }
        .grand-cta-title {
          font-size: 48px;
          font-weight: 800;
          margin-bottom: 32px;
          z-index: 2;
          position: relative;
        }
        .grand-cta-buttons {
          display: flex;
          justify-content: center;
          gap: 16px;
          z-index: 2;
          position: relative;
          margin-bottom: 32px;
        }
        .btn-large {
          padding: 16px 40px;
          border-radius: 16px;
          font-size: 18px;
          font-weight: 700;
        }
        .btn-large-white {
          background-color: #ffffff;
          color: #000000;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-large-white:hover {
          background-color: #e4e1e9;
        }
        .grand-cta-sub {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #c5c5d3;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          z-index: 2;
          position: relative;
        }

        /* Footer styling */
        .footer {
          background-color: #0e0e13;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 80px 24px;
        }
        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 64px;
        }
        .footer-logo-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .footer-logo-text {
          color: #c5c5d3;
          font-size: 14px;
        }
        .footer-links-col {
          display: flex;
          justify-content: flex-end;
          gap: 64px;
        }
        .footer-link-group {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .footer-group-title {
          font-size: 12px;
          font-weight: 700;
          color: #ffffff;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .footer-group-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .footer-group-list a {
          color: #c5c5d3;
          font-size: 14px;
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-group-list a:hover {
          color: #ffffff;
        }
        .footer-bottom {
          max-width: 1200px;
          margin: 48px auto 0 auto;
          padding-top: 32px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #c5c5d3;
        }

        /* Responsive Utilities */
        .desktop-only {
          display: flex !important;
        }

        /* Media Queries for Mobile Responsiveness */
        @media (max-width: 992px) {
          .pricing-grid {
            grid-template-columns: 1fr;
            gap: 48px;
            max-width: 480px;
            margin: 0 auto;
          }
          .price-card-popular {
            transform: scale(1);
          }
          .price-card-popular:hover {
            transform: translateY(-4px);
          }
        }

        @media (max-width: 768px) {
          .desktop-only {
            display: none !important;
          }
          .hero-title {
            font-size: 36px;
            margin-bottom: 24px;
          }
          .hero {
            padding-top: 120px;
          }
          .hero-actions {
            flex-direction: column;
            gap: 12px;
            padding: 0 20px;
          }
          .hero-actions button, .hero-actions a {
            width: 100%;
          }
          .grid-3 {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .feature-row {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .feature-row:nth-child(even) .md-order-1 {
            order: 2;
          }
          .feature-row:nth-child(even) .md-order-2 {
            order: 1;
          }
          .stats-showcase {
            grid-template-columns: 1fr;
            gap: 48px;
          }
          .calc-card {
            padding: 24px;
          }
          .calc-title {
            font-size: 24px;
          }
          .footer-container {
            grid-template-columns: 1fr;
            gap: 48px;
          }
          .footer-links-col {
            justify-content: flex-start;
            gap: 48px;
          }
          .grand-cta-card {
            padding: 48px 24px;
            border-radius: 24px;
          }
          .grand-cta-title {
            font-size: 32px;
          }
          .grand-cta-buttons {
            flex-direction: column;
            gap: 12px;
          }
          .grand-cta-buttons button {
            width: 100%;
          }
          .footer-bottom {
            flex-direction: column;
            gap: 16px;
            align-items: center;
            text-align: center;
          }
        }
      `}} />

      {/* Header & Navigation */}
      <header className="header">
        <nav className="nav-container">
          <a href="#" className="logo">
            signal<span className="logo-highlight">IQ</span>
          </a>
          <div className="nav-menu desktop-only">
            <a className="nav-link" href="#features">Features</a>
            <a className="nav-link" href="#pricing">Pricing</a>
            <a className="nav-link" href="#faq">FAQ</a>
          </div>
          <div>
            <button 
              onClick={onGetStarted}
              className="btn-primary"
            >
              Sign In
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main style={{ paddingTop: '80px' }}>
        <section className="hero">
          <div className="glow-blur"></div>
          <p className="hero-tag">Stop wasting ad spend on cold databases.</p>
          <h1 className="hero-title">
            Turn Buying Intent and Executive Activity into <span>Warm Conversations.</span>
          </h1>
          <div className="hero-actions">
            <button 
              onClick={onGetStarted}
              className="btn-primary btn-large"
              style={{ fontSize: '16px', padding: '16px 36px', borderRadius: '12px' }}
            >
              [ Start Free Trial ]
            </button>
            <a 
              href="#pricing"
              className="btn-outline"
            >
              Calculate Plan
            </a>
          </div>
          <div className="hero-preview-container">
            <img 
              className="hero-preview-img" 
              alt="Dashboard Preview" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDkF4Y0k7PA1pllX4sVkzDr8Cm4qXCZI9Rq4vDa4lBB0hTmXLmQrTpNNR71bNG80Fg7cgdVU8rcPcdYLzCH6sIe7cq8Zz2jj0uzyd0U3szER-dzqt54x16Cx2LdwgkYTjWMGMriZ-Y2eMV-ESlFxq8PMTsqlXiAOmYVxH1zThasUjqjihN0tDZ-WoWA2r-FpgAZgqOoTAr09qwnSUvu4JfcVS_mPH1D6OV7LkwB9mAfC8dWnmxEmxJu" 
            />
          </div>
        </section>

        {/* Section 2: How It Works */}
        <section className="section section-alt">
          <div className="section-header">
            <h2 className="section-title">Master Your Sales Signals</h2>
            <p className="section-subtitle">Our automated intelligence engine does the heavy lifting, so your team can focus on closing deals.</p>
          </div>
          <div className="grid-3">
            <div className="card">
              <div className="card-icon-wrapper">
                <span className="material-symbols-outlined card-icon">upload_file</span>
              </div>
              <h3 className="card-title">1. Upload or Search</h3>
              <p className="card-description">Enter domains, LinkedIn URLs, or upload a CSV of target accounts. We map the entire buying center instantly.</p>
            </div>
            <div className="card card-featured">
              <div className="card-icon-wrapper">
                <span className="material-symbols-outlined card-icon">psychology</span>
              </div>
              <h3 className="card-title">2. AI Enrichment</h3>
              <p className="card-description">Our engine checks real-time triggers like new funding rounds, department-specific hiring surges, and recent exits.</p>
            </div>
            <div className="card">
              <div className="card-icon-wrapper">
                <span className="material-symbols-outlined card-icon">notifications_active</span>
              </div>
              <h3 className="card-title">3. Twice-Weekly Alerts</h3>
              <p className="card-description">Get a grouped summary email every Tuesday and Thursday with pre-written, tailored copy for each executive.</p>
            </div>
          </div>
        </section>

        {/* Section 3: Feature Deep-Dive */}
        <section className="section" id="features">
          {/* Feature 1 */}
          <div className="feature-row">
            <div>
              <div className="feature-badge">INTENT MONITORING</div>
              <h2 className="feature-title">Sitemap &amp; Job Surge Triggers</h2>
              <p className="feature-text">
                We don't just tell you they are hiring; we tell you why. Our system analyzes sitemap changes and job description keywords to identify specific technical pain points before they post the role on LinkedIn.
              </p>
              <ul className="feature-list">
                <li className="feature-list-item">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>Real-time technical stack detection</span>
                </li>
                <li className="feature-list-item" style={{ marginTop: '12px' }}>
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>Department expansion alerts</span>
                </li>
              </ul>
            </div>
            <div className="feature-image-wrapper">
              <img 
                className="feature-image" 
                alt="Feature Visual" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYwuPkfnHHPJ2nCZoWfSgIMasJbOA_SvXX5ui3ZsulzcuD5ugY5rAZODIoweNq_xjnmCaXF77R3OfNxiEXZhl5C6Xz1CUc00zXVCpfYBSWJyBxqD4uNaHb95y5X_mHwNmA3AhjTJPiAy32mynOmquq5aVuHv89ZkV8Iv2P8MdF4zxDHhQjMC9SN-ud-D6aQtQ1agRa804SY1esqAhW-WpOsZUuYKxyhbNQJTYLKRSlmUaNXPNMK--U" 
              />
            </div>
          </div>

          {/* Feature 2 */}
          <div className="feature-row" style={{ marginTop: '120px' }}>
            <div className="md-order-2">
              <div className="feature-badge feature-badge-blue">SOCIAL INTELLIGENCE</div>
              <h2 className="feature-title">LinkedIn Activity Tracking</h2>
              <p className="feature-text">
                Track what your prospects are actually talking about. signalIQ captures comments, posts, and engagement from your target account C-Suite to give you the perfect personalized hook.
              </p>
              <a href="#pricing" className="nav-link" style={{ borderBottom: '1px solid #b7c4ff', display: 'inline-block', paddingBottom: '4px' }}>
                See plans &amp; pricing
              </a>
            </div>
            <div className="md-order-1 feature-image-wrapper">
              <img 
                className="feature-image" 
                alt="Feature Visual" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDyYBcsYbX3rNXn4JjAVkp5o64ffjokqwqx-3zpq3rhsUpMDB6YGZtNpkmRmT4JpHLyzLzUzGcum5HdvhHVbcxAqKT5V3i2NB3BeuhJJq70l5j8isZfXyxr1oJNVydd0reAKjzQoj66itOoxnJaN4CJgNyndA76bhKmeGDT2mLHBCus7H1dHNQxyn4WMrUj4UltjMAXAJpdxTLPrqsiEAepXAL4SvshK8MrsIcfz1OpS-2KetHa40J3" 
              />
            </div>
          </div>

          {/* Feature 3 */}
          <div className="feature-row" style={{ marginTop: '120px' }}>
            <div>
              <div className="feature-badge feature-badge-white">CREDIT EFFICIENCY</div>
              <h2 className="feature-title">Custom Contact Override</h2>
              <p className="feature-text">
                Control your budget with precision. If our AI suggests a contact you already know or don't want to target, reject the proposal in one click. You only pay for the signals you actually action.
              </p>
              <div className="feature-alert-box">
                <span className="material-symbols-outlined feature-alert-icon">security</span>
                <p className="feature-alert-text">Never double-pay for contacts already in your CRM.</p>
              </div>
            </div>
            <div className="feature-image-wrapper">
              <img 
                className="feature-image" 
                alt="Feature Visual" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmXK2inPCT6EQewze9GkJjF5hs6r3m-kpY5uGEigruUH6Ig9wc9x95lq-32mb0BtgmMEBOFqgfXlu5af3eSpm1d0D7FIitIbPf9Toe9z_doRluyv5dDyKRoLq9yeAYMA07-yEIwljSxjC0JbmtTUcmCJl18G0KBc14QXxsP4ZW85TVfpFLpaZMb8lWmfn-Gp4C7wALDH0SAd12C4u4c50m39ETW-UcEMBc_bSjLV3dgIXeExSsto0b" 
              />
            </div>
          </div>
        </section>

        {/* Section 4: Live Interactive Sandbox */}
        <section className="section section-alt" id="pricing">
          <div className="calc-card">
            <h2 className="calc-title">Calculate Your Scale</h2>
            <div className="calc-group">
              <div className="calc-label-row">
                <label>Target accounts to monitor</label>
                <span className="calc-value-highlight">{accounts} Companies</span>
              </div>
              <input 
                type="range"
                min="10"
                max="500"
                step="10"
                value={accounts}
                onChange={(e) => setAccounts(Number(e.target.value))}
                className="calc-slider" 
              />
            </div>
            <div className="calc-group" style={{ marginBottom: '32px' }}>
              <div className="calc-checkbox-row">
                <input 
                  type="checkbox"
                  id="exec-toggle"
                  checked={trackExtraExecs}
                  onChange={(e) => setTrackExtraExecs(e.target.checked)}
                  className="calc-checkbox" 
                />
                <label htmlFor="exec-toggle" style={{ cursor: 'pointer' }}>Track up to 2 key executives per account</label>
              </div>
            </div>
            <div className="calc-result-box">
              <p className="calc-result-label">Estimated Investment</p>
              <div className="calc-result-title">Requires {slotsNeeded} Slots</div>
              <div className="calc-badge">
                Recommended: <span>{recommendedPlan}</span> ({planPrice}/mo)
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Social Proof */}
        <section className="section">
          <div className="stats-showcase">
            <div>
              <div className="stat-number">22%</div>
              <h3 className="stat-desc-title">Average Response Rate</h3>
              <p className="stat-desc">Industry average is 2.1%. Our signals provide the context that forces prospects to reply.</p>
            </div>
            <div className="quote-card">
              <span className="quote-icon">“</span>
              <p className="quote-text">
                "Our booking rate doubled in 2 weeks. We stopped exporting huge sheets from Apollo and started focusing only on companies with active triggers. It's a game changer."
              </p>
              <div className="quote-author">
                <div className="quote-avatar">
                  <img 
                    alt="Sarah Jenkins Profile" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDdPFy0uiDkm-agTzdM8CXkjmCf3N5aNa6Ad-IrJ2WeIcwJxkfapWSUmg5yPZGILGW3rY1i8PuKVkHblqgln9fxDRzYwVSG2bJbDaKh06oyoZIkrmvPCl3xgfmhFgtLM6eL4TQ8tCoF4fsLvXUkorDZwwu4X0L4HDC2zF6Ug2L7WBOKPF9K7S7BxZcNPtF3hmV1LDdHbe-NWwx99WFSeNjJwQ2WSxJUHr56Ps6K_pIyqjC8NcldkrM" 
                  />
                </div>
                <div>
                  <p className="quote-meta-name">Sarah Jenkins</p>
                  <p className="quote-meta-title">VP of Sales, TechScale</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Pricing Cards */}
        <section className="section section-alt">
          <div className="section-header">
            <h2 className="section-title">Simple, Signal-Based Pricing</h2>
            <p className="section-subtitle">1 Credit = 1 Monitored Target slot for the month.</p>
          </div>
          <div className="pricing-grid">
            {/* Starter */}
            <div className="price-card">
              <h3 className="price-tier">Starter</h3>
              <div className="price-row">
                <span className="price-amount">₹9,900</span>
                <span className="price-period">/mo</span>
              </div>
              <p className="price-slots">50 Companies (100 Slots)</p>
              <ul className="price-features">
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>Weekly AI Reports</span>
                </li>
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>1 Exec per account</span>
                </li>
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>Email Support</span>
                </li>
              </ul>
              <button 
                onClick={onGetStarted}
                className="btn-price-outline"
              >
                Choose Starter
              </button>
            </div>

            {/* Pro */}
            <div className="price-card price-card-popular">
              <div className="popular-badge">MOST POPULAR</div>
              <h3 className="price-tier">Pro</h3>
              <div className="price-row">
                <span className="price-amount">₹24,900</span>
                <span className="price-period">/mo</span>
              </div>
              <p className="price-slots price-slots-red">150 Companies (450 Slots)</p>
              <ul className="price-features">
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>Real-time Signal Alerts</span>
                </li>
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>2 Execs per account</span>
                </li>
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>LinkedIn Post Analysis</span>
                </li>
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>Priority Support</span>
                </li>
              </ul>
              <button 
                onClick={onGetStarted}
                className="btn-price-primary"
              >
                Get Started
              </button>
            </div>

            {/* Scale */}
            <div className="price-card">
              <h3 className="price-tier">Scale</h3>
              <div className="price-row">
                <span className="price-amount">₹49,900</span>
                <span className="price-period">/mo</span>
              </div>
              <p className="price-slots">375 Companies (1,125 Slots)</p>
              <ul className="price-features">
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>CRM Integration</span>
                </li>
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>Unlimited Execs</span>
                </li>
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>Custom Trigger Logic</span>
                </li>
                <li className="price-feature-item">
                  <span className="material-symbols-outlined">check</span>
                  <span>Dedicated CS Manager</span>
                </li>
              </ul>
              <button 
                onClick={onGetStarted}
                className="btn-price-outline"
              >
                Contact Sales
              </button>
            </div>
          </div>
        </section>

        {/* Section 7: FAQ Accordion */}
        <section className="section" id="faq">
          <div className="section-header">
            <h2 className="section-title">Frequently Asked Questions</h2>
          </div>
          <div className="faq-list">
            {[
              {
                q: "Does it consume credits for duplicates?",
                a: "No, our proprietary cooldown engine ensures you pay ₹0 for re-uploads of existing accounts or duplicate contacts. We only deduct credits for new, active monitoring slots."
              },
              {
                q: "Can I add my own contacts?",
                a: "Yes, you can paste LinkedIn URLs directly into the interface or override the AI-suggested contacts with your own specific leads."
              },
              {
                q: "What databases do you enrich from?",
                a: "We use a multi-source orchestration layer including Exa, Firecrawl, ScrapeCreators, and Autobound to ensure the highest data freshness and contact accuracy."
              }
            ].map((faq, idx) => (
              <div key={idx} className="faq-item">
                <button 
                  className="faq-trigger"
                  onClick={() => toggleFaq(idx)}
                >
                  <span className="faq-question">{faq.q}</span>
                  <span className="material-symbols-outlined" style={{ color: '#FF2A00' }}>
                    {activeFaq === idx ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {activeFaq === idx && (
                  <div className="faq-answer">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Section 8: Footer CTA */}
        <section className="section">
          <div className="grand-cta-card">
            <div className="grand-cta-bg"></div>
            <h2 className="grand-cta-title">Start tracking your dream pipeline today.</h2>
            <div className="grand-cta-buttons">
              <button 
                onClick={onGetStarted}
                className="btn-primary btn-large"
              >
                Start 7-Day Free Trial
              </button>
              <button 
                onClick={onGetStarted}
                className="btn-large-white btn-large"
              >
                Book a Demo
              </button>
            </div>
            <p className="grand-cta-sub">No credit card required for trial.</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-logo-col">
            <a href="#" className="logo">
              signal<span className="logo-highlight">IQ</span>
            </a>
            <p className="footer-logo-text">Automated Buying Intent &amp; Executive Activity Intelligence platform.</p>
          </div>
          <div className="footer-links-col">
            <div className="footer-link-group">
              <p className="footer-group-title">Product</p>
              <ul className="footer-group-list">
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
              </ul>
            </div>
            <div className="footer-link-group">
              <p className="footer-group-title">Company</p>
              <ul className="footer-group-list">
                <li><a href="#faq">FAQ</a></li>
                <li><a onClick={onGetStarted} style={{ cursor: 'pointer' }}>Login</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} signalIQ. All rights reserved.</span>
          <span>Ad Momenta Partner Project</span>
        </div>
      </footer>
    </div>
  );
}
