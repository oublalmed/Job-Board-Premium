import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { RtlDemoCard } from '@/components/RtlDemoCard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Temporary Front 0 proof screen — replaced by real routing/pages in the
// layout commit. Confirms: the design tokens resolve to real colors, i18n
// resources load and translate, and the RTL flip actually mirrors the
// layout (RtlDemoCard) rather than just swapping text.
export function App() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh flex-col items-center gap-8 bg-background p-8">
      <div className="flex w-full max-w-sm justify-end">
        <LanguageSwitcher />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('app.name')}</CardTitle>
          <CardDescription>{t('demo.designSystem.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email-demo">
              {t('demo.designSystem.emailLabel')}
            </Label>
            <Input
              id="email-demo"
              type="email"
              placeholder={t('demo.designSystem.emailPlaceholder')}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>{t('demo.designSystem.buttonDefault')}</Button>
            <Button variant="secondary">
              {t('demo.designSystem.buttonSecondary')}
            </Button>
            <Button variant="outline">
              {t('demo.designSystem.buttonOutline')}
            </Button>
            <Button variant="destructive">
              {t('demo.designSystem.buttonDestructive')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="w-full max-w-sm">
        <RtlDemoCard />
      </div>
    </div>
  );
}
