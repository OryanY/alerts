# Incident BI: Clustering Architecture & KPI Mathematics

When analyzing incident coverage over historical alerts, this system provides two distinct modes for calculating metrics: **Unclustered (Raw)** and **Clustered (Grouped)**. 

It is absolutely critical for future maintainers to understand how the math behaves differently in these two modes, so as not to assume that "Total Alerts" always represents the literal row count in the database.

---

## 1. Unclustered Mode (The Raw Data)
When the "Clustered Mode" toggle is *disabled*, the API queries the database using `UNCLUSTERED_INCIDENT_STATS_BATCH`. 

In this mode, the math is entirely literal to the rows in the database:
*   **Total Alerts:** `COUNT(*)` (If there are 20,000 alerts in the DB, this shows 20,000).
*   **Linked to Incident:** `COUNT(incident_number)` (How many specific individual alert rows have an incident attached).
*   **No Incident:** Total Alerts minus Linked Alerts.
*   **Incidents Opened:** `COUNT(DISTINCT incident_number)` (Total unique incident tickets across the dataset).

---

## 2. Clustered Mode (The 15-Minute Storm Rule)
When the "Clustered Mode" toggle is *enabled*, the API switches to `CLUSTERED_INCIDENT_STATS_BATCH`. This fundamentally changes the baseline unit of measurement from an "Alert" to a "Cluster".

### How The Grouping Works
The database orders alerts chronologically **within each `(panel_title, application)` pair** (see the `PARTITION BY panel_title, application` in the clustered queries). If two consecutive alerts from the *same panel and application* fire within the `@cluster_threshold` (default: 15 minutes) of each other, they are grouped into a single **Cluster**. A Cluster continues to grow until there is a ≥ 15-minute gap in alerts *for that panel/application pair*. Alerts from different panels or applications never share a cluster.

### How The KPIs Change
Because the unit of measurement is now a Cluster (a "cardboard box" holding many alerts), the KPI cards on the dashboard mathematically shift their definitions. 

**1 Cluster evaluates mathematically to 1 Alert.**

*   **Total Alerts:** Now shows the **Total Number of Clusters** generated in that time period. (e.g., 20,000 raw alerts might group into only 229 Clusters. The KPI will show "229").
*   **Linked to Incident:** Now shows the **Number of Clusters** that have *at least one* incident ticket inside of them. (e.g., Even if a cluster holds 50 alerts and 5 different incidents, it still counts simply as `1` Covered Cluster).
*   **No Incident:** The number of Clusters that have exactly zero incident tickets inside of them.

### Important Edge Cases

**What happens if a single Cluster contains multiple different incident tickets?**
*   **Total Alerts:** `+1` (It is still only one continuous event storm).
*   **Linked to Incident:** `+1` (The cluster successfully evaluates to having tickets inside).
*   **Incidents Opened:** `+2` (or however many unique tickets exist inside). This KPI does *not* count clusters—it looks inside the clusters to accurately determine the exact number of fresh tickets generated.

**Be aware:** If multiple incidents fall into the same cluster, the **Avg Alerts per Incident** calculation can legally evaluate to less than `1.0`. (e.g. `1 Covered Cluster / 2 Incidents = 0.5`). This is mathematically correct behavior given the shifting definitions.
