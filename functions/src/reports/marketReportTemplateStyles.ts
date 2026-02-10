export const getMarketReportStyles = (biasColor: string) => `
        :root {
            --bg: #0a0a0f;
            --surface: #14141f;
            --border: rgba(255,255,255,0.1);
            --text: #f4f4f5;
            --muted: #71717a;
            --primary: #a78bfa;
            --green: #22c55e;
            --red: #ef4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            padding: 24px;
            max-width: 900px;
            margin: 0 auto;
        }
        .promo-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            background: linear-gradient(145deg, #12121b, #0d0d14);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 16px 18px;
            margin-bottom: 20px;
        }
        .promo-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .app-logo {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: #fff;
        }
        .promo-title {
            font-size: 0.75rem;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: var(--primary);
            font-weight: 700;
        }
        .promo-sub {
            color: var(--muted);
            font-size: 0.85rem;
            margin-top: 4px;
        }
        .promo-button {
            text-decoration: none;
            background: var(--primary);
            color: #0b0b12;
            padding: 8px 14px;
            border-radius: 10px;
            font-size: 0.8rem;
            font-weight: 700;
            white-space: nowrap;
        }
        .report-header {
            border-bottom: 1px solid var(--border);
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .report-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--primary);
        }
        .headline {
            font-size: 1.05rem;
            font-weight: 600;
            margin-top: 8px;
            color: var(--text);
        }
        .report-header .meta {
            color: var(--muted);
            font-size: 0.875rem;
            margin-top: 4px;
        }
        .bias-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            background: ${biasColor}22;
            color: ${biasColor};
            margin-left: 8px;
        }
        .status-alert {
            background: rgba(245, 158, 11, 0.15);
            border: 1px solid rgba(245, 158, 11, 0.4);
            color: #f59e0b;
            padding: 12px 16px;
            border-radius: 10px;
            font-size: 0.85rem;
            margin: 0 0 20px 0;
        }
        .section {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .section h2 {
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--primary);
            margin-bottom: 12px;
        }
        .section-note {
            color: var(--muted);
            font-size: 0.8rem;
            margin-bottom: 12px;
        }
        .macro-text {
            font-size: 1rem;
            color: var(--text);
            font-style: italic;
        }
        .synopsis-text {
            font-size: 0.95rem;
            color: #e2e8f0;
            font-style: normal;
            margin-bottom: 12px;
        }
        .dates-list {
            list-style: none;
        }
        .dates-list li {
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
        }
        .dates-list li:last-child { border-bottom: none; }
        .impact-high { color: var(--red); }
        .impact-medium { color: #f59e0b; }
        .impact-low { color: var(--muted); }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
        }
        th, td {
            padding: 12px 8px;
            text-align: left;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }
        th {
            color: var(--muted);
            font-weight: 500;
            text-transform: uppercase;
            font-size: 0.75rem;
        }
        .yield { color: var(--green); font-weight: 600; }
        .strategy-cc { color: #60a5fa; }
        .strategy-csp { color: #f472b6; }
        .footer {
            text-align: center;
            color: var(--muted);
            font-size: 0.75rem;
            margin-top: 32px;
        }
        /* New Styles for Enrichment */
        .rsi-badge {
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 6px;
        }
        .rsi-high { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .rsi-low { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .rsi-mid { background: rgba(113, 113, 122, 0.2); color: #a1a1aa; }

        .sparkline-cell { width: 110px; text-align: center; }

        .range-bar {
            width: 100%;
            height: 4px;
            background: #333;
            border-radius: 2px;
            position: relative;
            margin-top: 6px;
        }
        .range-fill {
            position: absolute;
            height: 100%;
            background: var(--primary);
            border-radius: 2px;
        }
        .range-label {
            display: flex;
            justify-content: space-between;
            font-size: 0.65rem;
            color: var(--muted);
            margin-top: 2px;
        }

        /* Deep Dive Styles */
        .featured-card {
            background: linear-gradient(145deg, #1e1e2d, #14141f);
            border: 1px solid #a78bfa33;
            margin-bottom: 16px;
        }
        .chart-container {
            position: relative;
            height: 200px;
            width: 100%;
            margin-top: 16px;
        }
        .backtest-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 12px;
        }
        .stat-box {
            background: rgba(255,255,255,0.03);
            padding: 10px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; }
        .stat-val { font-size: 1.1rem; font-weight: 700; color: #fff; }

        /* Grid for cards */
        .deep-dive-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 24px;
        }
`;
