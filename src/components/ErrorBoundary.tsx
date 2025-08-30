import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('Admin error boundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <div className="p-6 text-rose-600">Something went wrong.</div>;
    }
    return this.props.children;
  }
}
