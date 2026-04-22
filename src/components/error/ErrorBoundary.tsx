'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, Bug, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props & WithTranslation, State> {
  override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(this.props.t('errorBoundary.caughtError', 'ErrorBoundary caught an error:'), error, errorInfo);

    if (typeof window !== 'undefined') {
      // @ts-ignore
      if (window.Sentry) {
        // @ts-ignore
        window.Sentry.captureException(error, {
          extra: {
            componentStack: errorInfo.componentStack,
          },
        });
      }
    }

    this.props.onError?.(error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public override render() {
    const { t } = this.props;

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-md w-full border-destructive/50 shadow-lg">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">{t('errorBoundary.title')}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('errorBoundary.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="p-4 rounded-lg bg-muted/50 text-xs font-mono text-muted-foreground overflow-auto max-h-48">
                  <div className="flex items-start gap-2 mb-2">
                    <Bug className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="font-semibold">{t('errorBoundary.errorDetails')}</span>
                  </div>
                  <p>{this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer hover:text-foreground">
                        {t('errorBoundary.componentStack')}
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={this.handleReload} className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('errorBoundary.reloadPage')}
                </Button>
                <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                  <Home className="w-4 h-4 mr-2" />
                  {t('errorBoundary.goHome')}
                </Button>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                <p>{t('errorBoundary.contactSupport')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryClass);

interface ErrorBoundaryFallbackProps {
  error?: Error;
  resetError?: () => void;
}

export function ErrorBoundaryFallback({ error, resetError }: ErrorBoundaryFallbackProps) {
  const { t } = require('react-i18next').useTranslation();

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-destructive/50 shadow-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">{t('errorBoundary.somethingWentWrong')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {error?.message || t('smartError.defaultError.message')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={resetError} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('errorBoundary.tryAgain')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default ErrorBoundary;
