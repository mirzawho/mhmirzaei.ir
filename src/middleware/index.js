import fa from '../i18n/fa.json'
import en from '../i18n/en.json'

export function onRequest(context, next) {
    const locale = context.currentLocale;

    context.locals.json = {};

    if (locale == 'fa') context.locals.json = fa;
    if (locale == 'en') context.locals.json = en;

    return next();
};