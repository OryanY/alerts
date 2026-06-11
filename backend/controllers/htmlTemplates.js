/**
 * Escape a value for safe interpolation into HTML text/attributes.
 * Error messages can echo request input (e.g. application names), so
 * everything injected into the page below must pass through here.
 */
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Generate a styled HTML error page matching the application theme
 */
const getErrorHtml = (error, details = '', action = null) => `
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>שגיאה ביצירת תקלה</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background-color: #111217; /* Grafana Dark Bg */
            color: #d8d9da;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            direction: rtl;
        }
        .container {
            background-color: #22252b; /* Grafana Panel Bg */
            padding: 32px;
            border-radius: 8px;
            border-top: 4px solid #F24F4C; /* Red Error */
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            max-width: 500px;
            width: 90%;
            text-align: center;
        }
        h1 {
            color: #F24F4C;
            margin-top: 0;
            font-size: 24px;
        }
        .icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        p {
            line-height: 1.5;
            margin-bottom: 24px;
            font-size: 16px;
        }
        .details {
            background-color: #111217;
            padding: 12px;
            border-radius: 4px;
            text-align: left;
            direction: ltr;
            font-family: monospace;
            font-size: 13px;
            color: #ff9999;
            margin-bottom: 24px;
            white-space: pre-wrap;
            border: 1px solid #3d3d3d;
        }
        .buttons {
            display: flex;
            gap: 12px;
            justify-content: center;
        }
        button, .action-btn {
            background-color: #3274D9; /* Grafana Blue */
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            transition: background 0.2s;
            display: inline-block;
        }
        button:hover, .action-btn:hover {
            background-color: #245bba;
        }
        .secondary-btn {
            background-color: transparent;
            border: 1px solid #3274D9;
            color: #3274D9;
        }
        .secondary-btn:hover {
            background-color: rgba(50, 116, 217, 0.1);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">❌</div>
        <h1>שגיאה ביצירת תקלה</h1>
        <p>${escapeHtml(error)}</p>
        ${details ? `<div class="details">${escapeHtml(details)}</div>` : ''}
        <div class="buttons">
            ${action ? `<a href="${escapeHtml(action.url)}" class="action-btn" target="_blank">${escapeHtml(action.label)}</a>` : ''}
            <button class="${action ? 'secondary-btn' : ''}" onclick="window.close()">סגור חלונית</button>
        </div>
    </div>
</body>
</html>
`;

module.exports = { getErrorHtml };
