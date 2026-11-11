import { Component, type ReactNode } from 'react';
import { Button } from './ui/button';
// Keep a render failure local: one block or editor must not unmount the canvas.
export class RenderBoundary extends Component<{ children?: ReactNode; resetKey?: string; fallback?: ReactNode }, { error: string; resetKey?: string }> {
  state = { error: '', resetKey: this.props.resetKey };
  static getDerivedStateFromError(error: unknown) { return { error: error instanceof Error ? error.message : String(error) }; }
  static getDerivedStateFromProps(props: { resetKey?: string }, state: { resetKey?: string }) {
    return props.resetKey !== state.resetKey ? { error: '', resetKey: props.resetKey } : null;
  }
  render() {
    if (!this.state.error) return this.props.children;
    return this.props.fallback ?? <div className="render-failure nodrag nopan" role="alert"><strong>Could not display this view</strong><p>{this.state.error}</p><Button size="sm" variant="outline" onClick={() => this.setState({ error: '' })}>Retry</Button></div>;
  }
}
