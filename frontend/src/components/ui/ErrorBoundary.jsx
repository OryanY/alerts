import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    width: '100vw',
                    backgroundColor: '#f8fafc',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    color: '#1e293b',
                    textAlign: 'center',
                    padding: 20
                }}>
                    <div style={{
                        background: '#fff',
                        padding: 40,
                        borderRadius: 16,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        maxWidth: 500,
                        width: '100%'
                    }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            background: '#fee2e2',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 24,
                            margin: '0 auto'
                        }}>
                            <AlertTriangle size={32} color="#ef4444" />
                        </div>

                        <h1 style={{ margin: '0 0 12px 0', fontSize: 24, fontWeight: 700 }}>Something went wrong</h1>
                        <p style={{ margin: '0 0 24px 0', color: '#64748b', lineHeight: 1.5 }}>
                            The application encountered an unexpected error. We've logged the issue and notified our team.
                        </p>

                        {this.state.error && (
                            <div style={{
                                background: '#f1f5f9',
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 24,
                                textAlign: 'left',
                                overflow: 'auto',
                                maxHeight: 200,
                                fontSize: 12,
                                fontFamily: 'monospace',
                                color: '#ef4444'
                            }}>
                                {this.state.error.toString()}
                            </div>
                        )}

                        <button
                            onClick={this.handleReset}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                background: '#0ea5e9',
                                color: 'white',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: 8,
                                fontSize: 16,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#0284c7'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#0ea5e9'}
                        >
                            <RefreshCw size={18} />
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
