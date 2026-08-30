import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, a render error anywhere in the tree unmounts the whole app —
// and since main.cjs calls Menu.setApplicationMenu(null) and this is a
// production build with no devtools open by default, that's a blank white
// window with no menu bar and no way to tell what happened or recover
// short of force-quitting the process.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Solframe] Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '32px',
            textAlign: 'center',
            background: '#030712',
            color: '#ffffff',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
          }}
        >
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '480px', margin: 0 }}>
            Solframe Studio hit an unexpected error and can't continue rendering this screen.
            Your generated images and chat history are untouched — reloading should recover them.
          </p>
          <pre
            style={{
              fontSize: '11px',
              color: '#f87171',
              maxWidth: '640px',
              maxHeight: '160px',
              overflow: 'auto',
              textAlign: 'left',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '12px'
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: '#eab308',
              color: '#000',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Reload Solframe Studio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
