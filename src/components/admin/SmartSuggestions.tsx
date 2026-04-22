'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Sparkles } from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useSmartSuggestions } from '@/hooks/useAdmin';

export default function SmartSuggestions() {
  const { t } = useTranslation();
  const { data: suggestions, isLoading } = useSmartSuggestions();

  if (isLoading || !suggestions) {
    return (
      <Card className="border-(--border)">
        <CardContent className="flex items-center justify-center p-8">
          <ShieldLoader size="lg" />
        </CardContent>
      </Card>
    );
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'optimization':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'cost':
        return 'bg-green-500/10 text-green-500 border-green-500/30';
      case 'conflict':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'policy':
        return 'bg-sky-400/10 text-sky-400 border-sky-400/30';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'high':
        return <Badge variant="destructive">{t('aiSuggestions.highImpact', 'High Impact')}</Badge>;
      case 'medium':
        return <Badge variant="secondary">{t('aiSuggestions.mediumImpact', 'Medium Impact')}</Badge>;
      case 'low':
        return <Badge variant="outline">{t('aiSuggestions.lowImpact', 'Low Impact')}</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="border-(--border)">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-sky-400" />
          {t('aiSuggestions.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Lightbulb className="mb-3 h-12 w-12 text-sky-400 opacity-50" />
            <p className="text-sm font-medium text-(--text-primary)">
              {t('aiSuggestions.noSuggestions')}
            </p>
            <p className="text-xs text-(--text-secondary)">{t('aiSuggestions.optimal')}</p>
          </div>
        ) : (
          <div className="max-h-[400px] space-y-3 overflow-y-auto">
            {suggestions.map((suggestion: any) => (
              <div
                key={suggestion.id}
                className={`rounded-lg border p-4 ${getCategoryColor(suggestion.category)}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      <p className="font-semibold text-(--text-primary)">{suggestion.title}</p>
                    </div>
                    <p className="text-sm text-(--text-primary) opacity-90">
                      {suggestion.description}
                    </p>
                  </div>
                  {getImpactBadge(suggestion.impact)}
                </div>

                <div className="mt-2">
                  <Badge variant="outline" className="text-xs capitalize">
                    {suggestion.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
