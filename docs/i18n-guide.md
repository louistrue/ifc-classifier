# Internationalization (i18n) Guide

This document explains how to use i18next for internationalization in the IFC Classifier application.

## Structure

- Translation files are stored in `/public/locales/{language}/{namespace}.json`
- Currently supported languages: English (`en`), German (`de`), French (`fr`), and Italian (`it`)
- Main namespace is `common`, but you can add more namespaces as needed
- The i18next configuration is in `/lib/i18n-config.ts`

## Using Translations in Components

### Simple Text Translation

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('appName')}</h1>
      <p>{t('messages.loading')}</p>
    </div>
  );
}
```

### Using the T Component

```tsx
import { T } from '@/components/ui/translate';

function MyComponent() {
  return (
    <div>
      <h1><T keyName="appName" /></h1>
      <p><T keyName="messages.loading" /></p>
    </div>
  );
}
```

### Complex HTML Translations with Trans Component

```tsx
import { Trans } from 'react-i18next';

function MyComponent() {
  return (
    <Trans i18nKey="complexExample">
      This is a <strong>complex</strong> example with <a href="/link">HTML elements</a>.
    </Trans>
  );
}
```

The corresponding translation in `common.json`:
```json
{
  "complexExample": "This is a <1>complex</1> example with <3>HTML elements</3>."
}
```

### Switching Languages

```tsx
import { LanguageSwitcher } from '@/components/ui/translate';

function MyComponent() {
  return (
    <div>
      <LanguageSwitcher />
    </div>
  );
}
```

## Adding New Translations

1. Add the new translation keys to `/public/locales/en/common.json`, `/public/locales/de/common.json`, `/public/locales/fr/common.json`, and `/public/locales/it/common.json`
2. Use nested objects for better organization:

```json
{
  "section": {
    "subsection": {
      "key": "Value"
    }
  }
}
```

3. Access nested translations with dot notation: `t('section.subsection.key')`

## Namespaces

If you need to organize translations into multiple files:

1. Create a new file in `/public/locales/{language}/{namespace}.json`
2. Load the namespace in your component:

```tsx
const { t } = useTranslation('newNamespace');
```

3. Update `lib/i18n-config.ts` to include the new namespace:

```ts
.init({
  // ...
  ns: ['common', 'newNamespace'],
  // ...
})
```

## Migration from the Old System

The old translation system is kept for backward compatibility. If you need to update existing components, replace:

```tsx
import { translations, Language } from '@/lib/i18n';

// Old way
const text = translations[lang].someKey;

// New way
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
const text = t('someKey');
``` 