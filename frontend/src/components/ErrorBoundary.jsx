import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.group('🔴 React Error Boundary');
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '2rem', 
          backgroundColor: '#1a1a1a', 
          color: '#ff4d4d', 
          fontFamily: 'monospace',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <h1>Something went wrong.</h1>
          <p>The application crashed. Check the console for details.</p>
          {this.state.error && (
            <pre style={{ 
              textAlign: 'left', 
              backgroundColor: '#000', 
              padding: '1rem', 
              borderRadius: '5px',
              maxWidth: '80%',
              overflow: 'auto',
              color: '#00ff00'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              backgroundColor: '#ff4d4d',
              color: 'white',
              border: 'none',
              borderRadius: '5px'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
