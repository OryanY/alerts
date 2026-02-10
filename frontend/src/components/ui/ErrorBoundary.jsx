import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { AlertCircle } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });

        // Log to console for debugging
        console.error('Error Boundary caught an error:', error, errorInfo);

        // You can also log to an error reporting service here
        // e.g., Sentry, LogRocket, etc.
    }

    render() {
        if (this.state.hasError) {
            return <ErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} />;
        }

        return this.props.children;
    }
}

const ErrorFallback = ({ error, errorInfo }) => {
    const { colors } = useTheme();

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: 40,
                background: colors.bg.primary,
            }}
        >
            <div
                style={{
                    maxWidth: 600,
                    padding: 40,
                    background: colors.bg.secondary,
                    borderRadius: 12,
                    border: `1px solid ${colors.border.primary}`,
                    textAlign: 'center',
                }}
            >
                <AlertCircle
                    size={64}
                    style={{
                        color: colors.semantic?.error || '#EF4444',
                        marginBottom: 24,
                    }}
                />

                <h1
                    style={{
                        fontSize: 24,
                        fontWeight: 700,
                        marginBottom: 16,
                        color: colors.text.primary,
                    }}
                >
                    Something went wrong
                </h1>

                <p
                    style={{
                        fontSize: 16,
                        color: colors.text.secondary,
                        marginBottom: 24,
                        lineHeight: 1.6,
                    }}
                >
                    We encountered an unexpected error. Please try refreshing the page.
                    If the problem persists, contact support.
                </p>

                <button
                    onClick={() => window.location.reload()}
                    style={{
                        padding: '12px 24px',
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#FFFFFF',
                        background: colors.brand.primary,
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => (e.target.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.target.style.opacity = '1')}
                >
                    Refresh Page
                </button>

                {process.env.NODE_ENV === 'development' && error && (
                    <details
                        style={{
                            marginTop: 32,
                            padding: 16,
                            background: colors.bg.tertiary,
                            borderRadius: 8,
                            textAlign: 'left',
                            fontSize: 12,
                            fontFamily: 'monospace',
                            color: colors.text.secondary,
                        }}
                    >
                        <summary style={{ cursor: 'pointer', marginBottom: 8, fontWeight: 600 }}>
                            Error Details (Dev Only)
                        </summary>
                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {error.toString()}
                            {errorInfo && errorInfo.componentStack}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
};

export default ErrorBoundary;
