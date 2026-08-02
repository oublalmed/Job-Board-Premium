import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SUPPORTED_LOCALES } from '@/i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={t('language.label')}
    >
      {SUPPORTED_LOCALES.map((locale) => {
        const isActive = i18n.resolvedLanguage === locale;
        return (
          <Button
            key={locale}
            type="button"
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            aria-pressed={isActive}
            onClick={() => void i18n.changeLanguage(locale)}
          >
            {t(`language.${locale}`)}
          </Button>
        );
      })}
    </div>
  );
}
