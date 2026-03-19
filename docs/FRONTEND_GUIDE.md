# 🎨 Frontend Development Standards

The client application is built on **React** (via Vite).
We prioritize component reuse, hook-based logic, and a centralized theme system to ensure long-term maintainability.

## The Design System

We employ a "CSS-in-JS" approach using a centralized **ThemeContext**. This allows us to support dynamic theming (Light/Dark modes) without managing scattered CSS files or class names.

### Using the Theme
Do not hardcode hex values (e.g., `#fff`). Always consume variables from the theme context. This ensures that if we rebrand or adjust accessibility contrast, the changes propagate globally.

```javascript
/* Correct Pattern */
const { colors } = useTheme();
<div style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
```

## Component Architecture

We categorise components into three distinct types:

1.  **UI Primitives** (`src/components/ui/`)
    *   **Role**: Dumb, presentational components.
    *   **Examples**: `MetricCard`, `LazyInput`, `DateRangePicker`.
    *   **Rule**: These components should usually receive data via props and have no internal API-fetching logic.

2.  **Domain Widgets** (`src/components/dashboard/`)
    *   **Role**: Connected components that display specific business data.
    *   **Examples**: `ShiftAnalysisTable`, `HourlyHeatmap`.
    *   **Rule**: These widgets consume `useApiData` or other hooks to drive their state.

3.  **Pages** (`src/pages/`)
    *   **Role**: Layout composition.
    *   **Examples**: `NOCDashboard`, `IncidentRules`.
    *   **Rule**: Pages coordinate the layout of widgets but should avoid containing heavy implementation details.

## State Management & Hooks

We prefer **Local State** and **Context** over global state libraries (like Redux) for this scale of application.

*   **`useApiData(url, options)`**:
    The standard hook for data fetching. It handles loading states, error catching, and credential inclusion (Windows Auth). **Always** use this for GET requests.

## Performance Considerations

*   **Debouncing**: Use `LazyInput` for search fields. It prevents API spam by waiting for the user to finish typing (`useDebounce` logic internal).
*   **Memoization**: Use `useMemo` for expensive calculations (like filtering large lists of rules) to prevent re-computation on every render.
