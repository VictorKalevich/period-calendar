import { Component, type ReactNode } from 'react';

interface Props {
  /** Что показать вместо детей после сбоя (фича 014 — аварийный экран). */
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Граница ошибок (фича 014): исключение при отрисовке потомков показывает `fallback` вместо пустой
 * страницы. Без сбоя рисует только детей. Запись в консоль делает сам React (`onCaughtError` корня).
 * Сбрасывается новым экземпляром — например, `key` по вкладке.
 */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
