import { getRequestConfig } from 'next-intl/server';

// Un solo idioma por ahora. Para añadir inglés: messages/en.json con las mismas claves
// y resolver aquí el idioma (cookie o cabecera Accept-Language).
const DEFAULT_LOCALE = 'es';

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
