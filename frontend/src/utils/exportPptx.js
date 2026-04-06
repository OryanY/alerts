import PptxGenJS from 'pptxgenjs';

export const exportIncidentStatsToPPTX = (data, dateRange, isClustered) => {
    let pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    // Slide 1: Title
    let slideTitle = pptx.addSlide();
    slideTitle.addText(`Incident Management & Alerts Analytics`, {
        x: '10%', y: '40%', w: '80%', h: 1,
        fontSize: 36, bold: true, align: 'center', color: '363636'
    });
    slideTitle.addText(`${dateRange.start_date || 'Start'} to ${dateRange.end_date || 'End'} | ${isClustered ? 'Clustered Events' : 'Raw Alerts'}`, {
        x: '10%', y: '55%', w: '80%', h: 0.5,
        fontSize: 18, align: 'center', color: '666666'
    });

    // Slide 2: Daily Trend Chart
    if (data?.daily_trend && data.daily_trend.length > 0) {
        let slide2 = pptx.addSlide();
        slide2.addText('Daily Alert vs Incident Trend', { x: 0.5, y: 0.5, fontSize: 24, bold: true });
        
        const chartData = [
            {
                name: "Total Alerts",
                labels: data.daily_trend.map(d => d.date_il.substring(5, 10)),
                values: data.daily_trend.map(d => d.total_alerts)
            },
            {
                name: "Tickets Opened",
                labels: data.daily_trend.map(d => d.date_il.substring(5, 10)),
                values: data.daily_trend.map(d => d.unique_incidents)
            }
        ];
        
        slide2.addChart(pptx.ChartType.line, chartData, {
            x: 0.5, y: 1.2, w: '90%', h: '75%',
            showLegend: true, legendPos: 'b',
            lineDataSymbol: 'none',
            chartColors: ["4A90E2", "E74C3C"]
        });
    }

    // Slide 3: Top Teams
    if (data?.by_team && data.by_team.length > 0) {
        let slide3 = pptx.addSlide();
        slide3.addText('Incidents by Team (Top 10)', { x: 0.5, y: 0.5, fontSize: 24, bold: true });
        
        const topTeams = data.by_team.slice(0, 10);
        const teamData = [
            {
                name: "Tickets Opened",
                labels: topTeams.map(d => (d.panel_title || 'Unknown').substring(0, 15)),
                values: topTeams.map(d => d.unique_incidents)
            }
        ];
        
        slide3.addChart(pptx.ChartType.bar, teamData, {
            x: 0.5, y: 1.2, w: '90%', h: '75%',
            barDir: 'col', showLegend: true, legendPos: 'b',
            chartColors: ["9B59B6"]
        });
    }

    // Slide 4: Top Apps
    if (data?.by_application && data.by_application.length > 0) {
        let slide4 = pptx.addSlide();
        slide4.addText('Incidents by Application (Top 10)', { x: 0.5, y: 0.5, fontSize: 24, bold: true });
        
        const topApps = data.by_application.slice(0, 10);
        const appData = [
            {
                name: "Tickets Opened",
                labels: topApps.map(d => (d.application || 'Unknown').substring(0, 15)),
                values: topApps.map(d => d.unique_incidents)
            }
        ];
        
        slide4.addChart(pptx.ChartType.bar, appData, {
            x: 0.5, y: 1.2, w: '90%', h: '75%',
            barDir: 'col', showLegend: true, legendPos: 'b',
            chartColors: ["2ECC71"]
        });
    }

    pptx.writeFile({ fileName: `Incident_Analytics_${new Date().toISOString().split('T')[0]}.pptx` });
};

export const exportNocStatsToPPTX = (execData, shiftData, panelData, dateRange, isClustered) => {
    let pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    // Slide 1: NOC Title
    let slideTitle = pptx.addSlide();
    slideTitle.addText(`NOC Telemetry & Alert Distributions`, {
        x: '10%', y: '40%', w: '80%', h: 1,
        fontSize: 36, bold: true, align: 'center', color: '363636'
    });
    slideTitle.addText(`${dateRange.start_date || 'Start'} to ${dateRange.end_date || 'End'} | ${isClustered ? 'Clustered Events' : 'Raw Alerts'}`, {
        x: '10%', y: '55%', w: '80%', h: 0.5,
        fontSize: 18, align: 'center', color: '666666'
    });

    // Slide 2: Exec KPIs
    if (execData) {
        let slide2 = pptx.addSlide();
        slide2.addText('Executive Overview KPIs', { x: 0.5, y: 0.5, fontSize: 24, bold: true });
        
        slide2.addText(`Total Alerts: ${execData.total_alerts || 0}`, { x: 1, y: 2, fontSize: 18, color: "4A90E2", bold: true });
        slide2.addText(`True Wakeups (Night): ${execData.true_wakeups || 0}`, { x: 1, y: 3, fontSize: 18, color: "8E44AD", bold: true });
        slide2.addText(`False Positive Rate: ${execData.false_positive_rate_247 || 0}%`, { x: 1, y: 4, fontSize: 18, color: "E74C3C", bold: true });
        slide2.addText(`Signal Ratio: ${execData.signal_ratio || 0}%`, { x: 1, y: 5, fontSize: 18, color: "2ECC71", bold: true });
    }

    // Slide 3: Shift Analysis (Day vs Night vs False Wakeups)
    if (shiftData && shiftData.length > 0) {
        let slide3 = pptx.addSlide();
        slide3.addText('Alert Volume by Shift', { x: 0.5, y: 0.5, fontSize: 24, bold: true });
        
        const chartData = [
            {
                name: "True Alerts",
                labels: shiftData.map(d => d.shift || 'Unknown'),
                values: shiftData.map(d => d.true_alerts)
            },
            {
                name: "False Wakeups",
                labels: shiftData.map(d => d.shift || 'Unknown'),
                values: shiftData.map(d => d.false_wakeups)
            }
        ];
        
        slide3.addChart(pptx.ChartType.bar, chartData, {
            x: 0.5, y: 1.2, w: '90%', h: '75%',
            barGrouping: 'stacked', barDir: 'col', showLegend: true, legendPos: 'b',
            chartColors: ["4A90E2", "E74C3C"]
        });
    }

    // Slide 4: Top Alert Sources
    if (panelData && panelData.length > 0) {
        let slide4 = pptx.addSlide();
        slide4.addText('Top Alert Sources', { x: 0.5, y: 0.5, fontSize: 24, bold: true });
        
        const topPanels = panelData.slice(0, 10);
        const chartData = [
            {
                name: "Alert Count",
                labels: topPanels.map(d => (d.panel_title || 'Unknown').substring(0, 15)),
                values: topPanels.map(d => d.alert_count)
            }
        ];
        
        slide4.addChart(pptx.ChartType.bar, chartData, {
            x: 0.5, y: 1.2, w: '90%', h: '75%',
            barDir: 'col', showLegend: true, legendPos: 'b',
            chartColors: ["F39C12"]
        });
    }

    pptx.writeFile({ fileName: `NOC_Analytics_${new Date().toISOString().split('T')[0]}.pptx` });
};
