import PptxGenJS from 'pptxgenjs';

// ─── Shared palette ────────────────────────────────────────────────────────────
const C = {
    darkBg:  '1A2233',
    blue:    '1A5276',
    purple:  '6C3483',
    red:     '922B21',
    green:   '1E8449',
    gray:    '555555',
    white:   'FFFFFF',
    cBlue:   '4A90E2',
    cRed:    'E74C3C',
    cGreen:  '2ECC71',
    cOrange: 'F39C12',
    cPurple: '9B59B6',
    cBlueLt: 'A8CAEC', // light blue for stacked second series
    cPurLt:  'C39BD3', // light purple
    cGrayLt: 'BBBBBB',
};

// ─── Shared slide helpers ──────────────────────────────────────────────────────

/** Bold RTL title + grey subtitle + thin blue accent separator line */
const addSlideHeader = (pptx, slide, title, subtitle = '') => {
    slide.addText(title, {
        x: 0.5, y: 0.25, w: '90%', h: 0.55,
        fontSize: 24, bold: true, color: '1A1A2E',
        align: 'right', rtlMode: true,
    });
    if (subtitle) {
        slide.addText(subtitle, {
            x: 0.5, y: 0.82, w: '90%', h: 0.35,
            fontSize: 12, color: C.gray, align: 'right', rtlMode: true,
        });
    }
    slide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: 1.1, w: 9.2, h: 0.03,
        fill: { color: C.cBlue }, line: { color: C.cBlue },
    });
};

/** Dark banner slide used as a section divider (e.g. before Incident BI) */
const addSectionSlide = (pptx, slide, title, subtitle = '') => {
    slide.background = { color: C.darkBg };
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: '35%', w: '100%', h: '30%',
        fill: { color: C.cBlue }, line: { color: C.cBlue },
    });
    slide.addText(title, {
        x: '5%', y: '37%', w: '90%', h: 1.0,
        fontSize: 30, bold: true, align: 'center', color: C.white, rtlMode: true,
    });
    if (subtitle) {
        slide.addText(subtitle, {
            x: '5%', y: '55%', w: '90%', h: 0.5,
            fontSize: 14, align: 'center', color: 'AAAAAA', rtlMode: true,
        });
    }
};

/** Coloured rectangle KPI box (background shape + label + big value) */
const addKpiBox = (pptx, slide, x, y, w, h, label, value, color, unit = '') => {
    slide.addShape(pptx.ShapeType.rect, {
        x, y, w, h, fill: { color },
        line: { color: C.white, size: 1.5 },
        shadow: { type: 'outer', blur: 4, offset: 2, color: '000000', opacity: 0.25 },
    });
    slide.addText(label, {
        x: x + 0.1, y: y + 0.08, w: w - 0.2, h: 0.5,
        align: 'center', color: C.white, fontSize: 11, rtlMode: true,
    });
    slide.addText(`${value}${unit}`, {
        x: x + 0.1, y: y + 0.55, w: w - 0.2, h: 0.85,
        align: 'center', color: C.white, fontSize: 30, bold: true,
    });
};

/** "▲ 12%" or "▼ 8%" */
const trendArrow = (pct) =>
    pct == null ? '—' : `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`;

/** Red if change is bad, green if good */
const trendColor = (pct, higherIsBad = false) => {
    if (pct == null) return C.gray;
    return (pct > 0) === higherIsBad ? C.cRed : C.cGreen;
};

// ─── Incident BI Export (standalone) ──────────────────────────────────────────
export const exportIncidentStatsToPPTX = (data, dateRange, isClustered) => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.rtlMode = true;

    // Slide 1: Title
    const s1 = pptx.addSlide();
    s1.background = { color: C.darkBg };
    s1.addShape(pptx.ShapeType.rect, {
        x: 0, y: '38%', w: '100%', h: '24%',
        fill: { color: C.cBlue }, line: { color: C.cBlue },
    });
    s1.addText('ניהול תקלות וניתוח התראות', {
        x: '5%', y: '39%', w: '90%', h: 1.1,
        fontSize: 34, bold: true, align: 'center', color: C.white, rtlMode: true,
    });
    s1.addText(
        `${dateRange.start_date || 'התחלה'} ← ${dateRange.end_date || 'סיום'}  |  ${isClustered ? 'אירועים מקובצים' : 'התראות גולמיות'}`,
        { x: '5%', y: '57%', w: '90%', h: 0.5, fontSize: 15, align: 'center', color: 'AAAAAA', rtlMode: true }
    );

    // Slide 2: Daily trend
    if (data?.daily_trend && data.daily_trend.length > 0) {
        const s2 = pptx.addSlide();
        addSlideHeader(pptx, s2, 'מגמת התראות ותקלות יומית', 'סך ההתראות לעומת תקלות שנפתחו לאורך הזמן');
        s2.addChart(pptx.ChartType.line, [
            { name: 'סך ההתראות',     labels: data.daily_trend.map(d => d.date_il.substring(5, 10)), values: data.daily_trend.map(d => d.total_alerts    || 0) },
            { name: 'תקלות שנפתחו',  labels: data.daily_trend.map(d => d.date_il.substring(5, 10)), values: data.daily_trend.map(d => d.unique_incidents || 0) },
        ], {
            x: 0.5, y: 1.25, w: '90%', h: '73%',
            showLegend: true, legendPos: 'b', lineDataSymbol: 'none',
            chartColors: [C.cBlue, C.cRed],
        });
    }

    // Slide 3: Top teams
    if (data?.by_team && data.by_team.length > 0) {
        const s3 = pptx.addSlide();
        addSlideHeader(pptx, s3, 'תקלות לפי צוות (10 מובילים)', 'מספר תקלות ייחודיות שנפתחו לכל צוות');
        s3.addChart(pptx.ChartType.bar, [
            {
                name: 'תקלות שנפתחו',
                labels: data.by_team.slice(0, 10).map(d => (d.panel_title || 'לא ידוע').substring(0, 15)),
                values: data.by_team.slice(0, 10).map(d => d.unique_incidents || 0),
            },
        ], { x: 0.5, y: 1.25, w: '90%', h: '73%', barDir: 'col', showLegend: false, chartColors: [C.cPurple] });
    }

    // Slide 4: Top apps
    if (data?.by_application && data.by_application.length > 0) {
        const s4 = pptx.addSlide();
        addSlideHeader(pptx, s4, 'תקלות לפי אפליקציה (10 מובילים)', 'מספר תקלות ייחודיות שנפתחו לכל אפליקציה');
        s4.addChart(pptx.ChartType.bar, [
            {
                name: 'תקלות שנפתחו',
                labels: data.by_application.slice(0, 10).map(d => (d.application || 'לא ידוע').substring(0, 15)),
                values: data.by_application.slice(0, 10).map(d => d.unique_incidents || 0),
            },
        ], { x: 0.5, y: 1.25, w: '90%', h: '73%', barDir: 'col', showLegend: false, chartColors: [C.cGreen] });
    }

    pptx.writeFile({ fileName: `Incident_Analytics_${new Date().toISOString().split('T')[0]}.pptx` });
};

// ─── NOC Analytics Export (with optional Incident BI section) ─────────────────
export const exportNocStatsToPPTX = (
    execData, shiftData, panelData, dateRange, isClustered,
    heatmapData, durationData, incidentData
) => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.rtlMode = true;

    // Period label helper — auto-detects range length
    const getPeriod = () => {
        if (!dateRange?.start_date || !dateRange?.end_date)
            return { adj: 'תקופתית', current: 'תקופה נוכחית', previous: 'תקופה קודמת' };
        const days = Math.round(
            (new Date(dateRange.end_date) - new Date(dateRange.start_date)) / 86400000
        );
        if (days <= 8)   return { adj: 'שבועית',  current: 'שבוע נוכחי',  previous: 'שבוע קודם'  };
        if (days <= 45)  return { adj: 'חודשית',  current: 'חודש נוכחי',  previous: 'חודש קודם'  };
        if (days <= 100) return { adj: 'רבעונית', current: 'רבעון נוכחי', previous: 'רבעון קודם' };
        return { adj: 'תקופתית', current: 'תקופה נוכחית', previous: 'תקופה קודמת' };
    };
    const period = getPeriod();

    // ─── SLIDE 1: Title ───────────────────────────────────────────────────────
    const s1 = pptx.addSlide();
    s1.background = { color: C.darkBg };
    s1.addShape(pptx.ShapeType.rect, {
        x: 0, y: '38%', w: '100%', h: '24%',
        fill: { color: C.cBlue }, line: { color: C.cBlue },
    });
    s1.addText('ניתוח טלמטריה והתראות NOC', {
        x: '5%', y: '39%', w: '90%', h: 1.1,
        fontSize: 34, bold: true, align: 'center', color: C.white, rtlMode: true,
    });
    s1.addText(
        `${dateRange.start_date || 'התחלה'} ← ${dateRange.end_date || 'סיום'}  |  ${isClustered ? 'אירועים מקובצים' : 'התראות גולמיות'}`,
        { x: '5%', y: '57%', w: '90%', h: 0.5, fontSize: 15, align: 'center', color: 'AAAAAA', rtlMode: true }
    );

    // ─── SLIDE 2: מדדי ביצועים NOC ───────────────────────────────────────────
    if (execData) {
        const s2 = pptx.addSlide();
        addSlideHeader(pptx, s2, 'מדדי ביצועים NOC',
            `תקופת הדוח: ${dateRange.start_date} ← ${dateRange.end_date}  |  ${isClustered ? 'אירועים מקובצים' : 'התראות גולמיות'}`
        );

        addKpiBox(pptx, s2, 0.5,  1.35, 4.4, 1.55, 'סך ההתראות',         execData.total_alerts            || 0, C.blue);
        addKpiBox(pptx, s2, 5.2,  1.35, 4.4, 1.55, 'התראות לילה אמיתיות', execData.true_wakeups            || 0, C.purple);
        addKpiBox(pptx, s2, 0.5,  3.05, 4.4, 1.55, 'שיעור התראות שווא',   execData.false_positive_rate_247 || 0, C.red,    '%');
        addKpiBox(pptx, s2, 5.2,  3.05, 4.4, 1.55, 'יחס אות לרעש',        execData.signal_ratio            || 0, C.green,  '%');

        if (execData.total_trend_pct != null) {
            const sym = execData.total_trend_pct > 0 ? '▲' : '▼';
            const col = execData.total_trend_pct > 0 ? C.cRed : C.cGreen;
            s2.addText(
                `שינוי בנפח ההתראות: ${sym} ${Math.abs(execData.total_trend_pct)}% לעומת התקופה הקודמת`,
                { x: 0.5, y: 4.8, w: '90%', h: 0.4, fontSize: 13, bold: true, align: 'center', color: col, rtlMode: true }
            );
        }
    }

    // ─── SLIDE 3: נפח התראות לפי משמרת ──────────────────────────────────────
    if (shiftData && shiftData.length > 0) {
        const s3 = pptx.addSlide();
        addSlideHeader(pptx, s3, 'נפח התראות לפי משמרת',
            'התראות אמיתיות לעומת התראות שווא — חלוקה לפי משמרת'
        );
        s3.addChart(pptx.ChartType.bar, [
            { name: 'התראות אמיתיות', labels: shiftData.map(d => d.shift || 'לא ידוע'), values: shiftData.map(d => d.true_alerts  || 0) },
            { name: 'התראות שווא',    labels: shiftData.map(d => d.shift || 'לא ידוע'), values: shiftData.map(d => d.false_wakeups || 0) },
        ], {
            x: 0.5, y: 1.25, w: '90%', h: '73%',
            barGrouping: 'stacked', barDir: 'col',
            showLegend: true, legendPos: 'b',
            chartColors: [C.cBlue, C.cRed],
        });
    }

    // ─── SLIDE 4: מקורות ההתראות המובילים ────────────────────────────────────
    if (panelData && panelData.length > 0) {
        const s4 = pptx.addSlide();
        addSlideHeader(pptx, s4, 'מקורות ההתראות המובילים',
            'פאנלים מסודרים לפי נפח התראות (10 מובילים)'
        );
        const topPanels = [...panelData]
            .sort((a, b) => (b.alert_count || 0) - (a.alert_count || 0))
            .slice(0, 10);
        s4.addChart(pptx.ChartType.bar, [
            {
                name: 'מספר התראות',
                labels: topPanels.map(d => (d.panel_title || 'לא ידוע').substring(0, 18)),
                values: topPanels.map(d => d.alert_count || 0),
            },
        ], {
            x: 0.5, y: 1.25, w: '90%', h: '73%',
            barDir: 'bar', showLegend: false,
            chartColors: [C.cOrange],
        });
    }

    // ─── SLIDE 5: השוואה תקופתית ──────────────────────────────────────────────
    if (execData && (execData.total_trend_pct != null || execData.noise_trend_pct != null)) {
        const s5 = pptx.addSlide();
        addSlideHeader(pptx, s5, `השוואה ${period.adj}`,
            `השוואת התקופה הנוכחית (${dateRange.start_date} ← ${dateRange.end_date}) לעומת התקופה הקודמת`
        );

        const curTotal   = execData.total_alerts            || 0;
        const curFpRate  = execData.false_positive_rate_247 || 0;
        const curWakeups = execData.true_wakeups             || 0;
        const curSignal  = execData.signal_ratio             || 0;
        const derivePrev = (cur, pct) => pct != null ? Math.round(cur / (1 + pct / 100)) : null;
        const prevTotal  = derivePrev(curTotal,  execData.total_trend_pct);
        const prevFpRate = derivePrev(curFpRate, execData.noise_trend_pct);

        // Table cell style helpers
        const hdr  = (text, fill)  => ({ text, options: { fill, color: C.white, bold: true,  align: 'center', valign: 'middle', fontSize: 12, rtlMode: true } });
        const meta = (text)        => ({ text, options: { fill: 'F5F5F5', color: '1A1A2E', bold: true,  align: 'right',  valign: 'middle', fontSize: 12, rtlMode: true } });
        const cur  = (text)        => ({ text, options: { fill: C.blue,   color: C.white,   bold: true,  align: 'center', valign: 'middle', fontSize: 14 } });
        const prev = (text)        => ({ text, options: { fill: 'EEEEEE', color: C.gray,    bold: false, align: 'center', valign: 'middle', fontSize: 13 } });
        const chng = (pct, bad)    => ({ text: trendArrow(pct), options: { fill: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 13, color: trendColor(pct, bad) } });
        const dash = ()            => ({ text: '—', options: { fill: 'FFFFFF', align: 'center', valign: 'middle', fontSize: 13, color: C.gray } });

        s5.addTable([
            [ hdr('מדד', '363636'), hdr(period.current, C.blue), hdr(period.previous, C.gray), hdr('שינוי', '363636') ],
            [ meta('סך ההתראות'),          cur(String(curTotal)),   prev(prevTotal  != null ? String(prevTotal)  : '—'), chng(execData.total_trend_pct, true) ],
            [ meta('שיעור התראות שווא'),   cur(`${curFpRate}%`),    prev(prevFpRate != null ? `${prevFpRate}%`  : '—'), chng(execData.noise_trend_pct, true) ],
            [ meta('התראות לילה אמיתיות'), cur(String(curWakeups)), prev('—'), dash() ],
            [ meta('יחס אות לרעש'),        cur(`${curSignal}%`),    prev('—'), dash() ],
        ], { x: 0.8, y: 1.35, w: 8.5, colW: [3.2, 2.0, 2.0, 1.3], rowH: 0.75, border: { type: 'solid', pt: 1, color: 'DDDDDD' } });

        s5.addText(
            'הערה: ערכי התקופה הקודמת מחושבים מאחוזי המגמה שמוחזרים על ידי מנוע הניתוח.',
            { x: 0.5, y: 5.1, w: '90%', h: 0.35, fontSize: 10, color: 'AAAAAA', italic: true, align: 'right', rtlMode: true }
        );
    }

    // ─── SLIDE 6: התפלגות התראות לפי שעה ─────────────────────────────────────
    if (heatmapData && heatmapData.length > 0) {
        const s6 = pptx.addSlide();
        addSlideHeader(pptx, s6, 'התפלגות התראות לפי שעה',
            'נפח התראות לפי שעה ביום — שעות לילה בסגול, שעות יום בכחול'
        );
        const labels    = heatmapData.map(h => h.hour_display || String(h.hour));
        const dayVals   = heatmapData.map(h => h.is_night ? 0 : (h.count || 0));
        const nightVals = heatmapData.map(h => h.is_night ? (h.count || 0) : 0);
        s6.addChart(pptx.ChartType.bar, [
            { name: 'שעות יום',  labels, values: dayVals   },
            { name: 'שעות לילה', labels, values: nightVals },
        ], {
            x: 0.5, y: 1.25, w: '90%', h: '73%',
            barDir: 'col', barGrouping: 'stacked',
            showLegend: true, legendPos: 'b',
            chartColors: [C.cBlue, C.cPurple],
        });
    }

    // ─── SLIDE 7: התפלגות משכי התראות ────────────────────────────────────────
    if (durationData && durationData.length > 0) {
        const s7 = pptx.addSlide();
        addSlideHeader(pptx, s7, 'התפלגות משכי התראות',
            'משך ההתראות — התראות קצרות הן ככל הנראה רעש'
        );
        s7.addChart(pptx.ChartType.bar, [
            {
                name: 'מספר התראות',
                labels: durationData.map(d => d.range || ''),
                values: durationData.map(d => d.count  || 0),
            },
        ], {
            x: 0.5, y: 1.25, w: '90%', h: '73%',
            barDir: 'col', showLegend: false,
            chartColors: [C.cGreen],
        });
    }

    // ─── SLIDE 8: פאנלים רועשים לפי שיעור שווא ───────────────────────────────
    if (panelData && panelData.length > 0) {
        const noisyPanels = [...panelData]
            .filter(p => (p.alert_count || 0) >= 5)
            .map(p => ({
                ...p,
                fp_rate: p.alert_count > 0
                    ? Math.round(((p.false_positive_count || 0) / p.alert_count) * 100)
                    : 0,
            }))
            .sort((a, b) => b.fp_rate - a.fp_rate)
            .slice(0, 10);

        if (noisyPanels.length > 0) {
            const s8 = pptx.addSlide();
            addSlideHeader(pptx, s8, 'פאנלים רועשים — לפי שיעור שווא',
                'פאנלים עם האחוז הגבוה ביותר של התראות שווא — מועמדים לכוונון חוקים'
            );
            s8.addChart(pptx.ChartType.bar, [
                {
                    name: 'שיעור שווא (%)',
                    labels: noisyPanels.map(p => (p.panel_title || 'לא ידוע').substring(0, 20)),
                    values: noisyPanels.map(p => p.fp_rate),
                },
            ], {
                x: 0.5, y: 1.25, w: '90%', h: '73%',
                barDir: 'bar', showLegend: false, valAxisMaxVal: 100,
                chartColors: [C.cRed],
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── INCIDENT BI SECTION (appended if incidentData is available) ──────────
    // ═══════════════════════════════════════════════════════════════════════════
    if (incidentData) {
        const inc = incidentData;

        // Section divider slide
        addSectionSlide(pptx, pptx.addSlide(), 'BI — ניהול תקלות', 'כיסוי תקלות, מגמות ופילוח');

        // ─── Incident KPI Boxes ──────────────────────────────────────────────
        if (inc.coverage) {
            const cov  = inc.coverage;
            const si1  = pptx.addSlide();
            addSlideHeader(pptx, si1, 'מדדי כיסוי תקלות',
                'יחס בין התראות שנפתחה עבורן תקלה לסך ההתראות'
            );
            // 3 × 2 grid (width 2.8 each, gap 0.25)
            addKpiBox(pptx, si1, 0.3,  1.35, 2.8, 1.55, 'סך ההתראות',          cov.total_alerts            || 0, C.blue);
            addKpiBox(pptx, si1, 3.35, 1.35, 2.8, 1.55, 'תקלות שנפתחו',        cov.unique_incidents         || 0, C.purple);
            addKpiBox(pptx, si1, 6.4,  1.35, 2.8, 1.55, 'קושרו לתקלה',          cov.alerts_covered           || 0, C.green);
            addKpiBox(pptx, si1, 0.3,  3.1,  2.8, 1.55, 'ללא שיוך לתקלה',      cov.alerts_no_incident       || 0, C.red);
            addKpiBox(pptx, si1, 3.35, 3.1,  2.8, 1.55, 'ממוצע התראות לתקלה',  cov.avg_alerts_per_incident  || 0, C.gray);
            addKpiBox(pptx, si1, 6.4,  3.1,  2.8, 1.55, 'אחוז כיסוי',           cov.coverage_pct             || 0, C.green, '%');
        }

        // ─── Daily Trend: Alerts vs. Incidents ──────────────────────────────
        if (inc.daily_trend && inc.daily_trend.length > 0) {
            const si2 = pptx.addSlide();
            addSlideHeader(pptx, si2, 'מגמת אירועים יומית',
                'סך ההתראות לעומת תקלות שנפתחו לאורך הזמן'
            );
            si2.addChart(pptx.ChartType.line, [
                { name: 'סך ההתראות',    labels: inc.daily_trend.map(d => d.date_il.substring(5, 10)), values: inc.daily_trend.map(d => d.total_alerts     || 0) },
                { name: 'קושרו לתקלה',  labels: inc.daily_trend.map(d => d.date_il.substring(5, 10)), values: inc.daily_trend.map(d => d.alerts_covered    || 0) },
                { name: 'תקלות שנפתחו', labels: inc.daily_trend.map(d => d.date_il.substring(5, 10)), values: inc.daily_trend.map(d => d.unique_incidents   || 0) },
            ], {
                x: 0.5, y: 1.25, w: '90%', h: '73%',
                showLegend: true, legendPos: 'b', lineDataSymbol: 'none',
                chartColors: [C.cBlue, C.cGreen, C.cRed],
            });
        }

        // ─── Breakdown by Team ───────────────────────────────────────────────
        if (inc.by_team && inc.by_team.length > 0) {
            const si3     = pptx.addSlide();
            addSlideHeader(pptx, si3, 'פילוח תקלות לפי צוות (12 מובילים)',
                'תקלות, התראות מכוסות, והתראות ללא שיוך — לפי צוות'
            );
            const topTeams = inc.by_team.slice(0, 12);
            si3.addChart(pptx.ChartType.bar, [
                { name: 'תקלות',                    labels: topTeams.map(r => (r.panel_title || 'לא ידוע').substring(0, 18)), values: topTeams.map(r => r.unique_incidents || 0) },
                { name: 'התראות נוספות באותה תקלה', labels: topTeams.map(r => (r.panel_title || 'לא ידוע').substring(0, 18)), values: topTeams.map(r => Math.max(0, (r.alerts_covered || 0) - (r.unique_incidents || 0))) },
                { name: 'ללא שיוך',                 labels: topTeams.map(r => (r.panel_title || 'לא ידוע').substring(0, 18)), values: topTeams.map(r => r.no_incident || 0) },
            ], {
                x: 0.5, y: 1.25, w: '90%', h: '73%',
                barDir: 'bar', barGrouping: 'stacked',
                showLegend: true, legendPos: 'b',
                chartColors: [C.cBlue, C.cBlueLt, C.cGrayLt],
            });
        }

        // ─── Breakdown by Application ────────────────────────────────────────
        if (inc.by_application && inc.by_application.length > 0) {
            const si4    = pptx.addSlide();
            addSlideHeader(pptx, si4, 'פילוח תקלות לפי אפליקציה (12 מובילים)',
                'תקלות, התראות מכוסות, והתראות ללא שיוך — לפי אפליקציה'
            );
            const topApps = inc.by_application.slice(0, 12);
            si4.addChart(pptx.ChartType.bar, [
                { name: 'תקלות',                    labels: topApps.map(r => (r.application || 'לא ידוע').substring(0, 18)), values: topApps.map(r => r.unique_incidents || 0) },
                { name: 'התראות נוספות באותה תקלה', labels: topApps.map(r => (r.application || 'לא ידוע').substring(0, 18)), values: topApps.map(r => Math.max(0, (r.alerts_covered || 0) - (r.unique_incidents || 0))) },
                { name: 'ללא שיוך',                 labels: topApps.map(r => (r.application || 'לא ידוע').substring(0, 18)), values: topApps.map(r => r.no_incident || 0) },
            ], {
                x: 0.5, y: 1.25, w: '90%', h: '73%',
                barDir: 'bar', barGrouping: 'stacked',
                showLegend: true, legendPos: 'b',
                chartColors: [C.cPurple, C.cPurLt, C.cGrayLt],
            });
        }
    }

    pptx.writeFile({ fileName: `NOC_Analytics_${new Date().toISOString().split('T')[0]}.pptx` });
};
