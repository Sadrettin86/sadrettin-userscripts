/**
 * P373 Helper (Wikidata)
 *
 * Çalıştığı yer: Wikidata → item sayfaları (Q\d+)
 *
 * Yaptığı işler:
 *  - Commons sitelink VAR ama P373 (Commons category) YOK ise:
 *      [Wikidata | +P373] rozetini çıkarır.
 *  - P373 VAR ama Commons sitelink YOK ise:
 *      [Sitelink | +iw] rozetini çıkarır.
 *
 * Bağımlılık: core.js
 */

$(document).ready(function () {
    var SUS = window.SUS;
    if (!SUS) {
        console.error('p373-helper.js: core.js (window.SUS) yüklenmemiş.');
        return;
    }

    if (mw.config.get('wgNamespaceNumber') !== 0 ||
        !mw.config.get('wgTitle').match(/^Q\d+$/)) {
        return;
    }

    var Helper = {

        getP373Value: function () {
            var $el = $('.wikibase-statementgroupview[data-property-id="P373"] .wikibase-snakview-value');
            return $el.length > 0 ? $el.first().text().trim() : null;
        },

        hasCommonsCategory: function () {
            return $('.wikibase-statementgroupview[data-property-id="P373"]').length > 0;
        },

        hasCommonsSitelink: function () {
            return $('.wikibase-sitelinklistview a[href*="commons.wikimedia.org"]').length > 0;
        },

        getCommonsCategory: function () {
            var $link = $('.wikibase-sitelinklistview a[href*="commons.wikimedia.org/wiki/Category:"]');
            if ($link.length === 0) return null;
            var match = $link.attr('href').match(/\/wiki\/Category:(.+)$/);
            return match ? decodeURIComponent(match[1]).replace(/_/g, ' ') : null;
        },

        addCategoryToP373: function (categoryName) {
            var entityId = mw.config.get('wgTitle');
            mw.notify('Commons kategorisi P373\'e ekleniyor...', { type: 'info' });

            new mw.Api().postWithToken('csrf', {
                action: 'wbcreateclaim',
                entity: entityId,
                property: 'P373',
                snaktype: 'value',
                value: JSON.stringify(categoryName),
                format: 'json'
            }).done(function (data) {
                if (data.success) {
                    mw.notify('Commons kategorisi P373\'e başarıyla eklendi!', { type: 'success' });
                    setTimeout(function () { location.reload(); }, 1500);
                } else {
                    mw.notify('Hata oluştu: ' + JSON.stringify(data), { type: 'error' });
                }
            }).fail(function (code, data) {
                Helper.handleApiError('P373 ekleme', code, data);
            });
        },

        addCommonsToSitelinks: function (categoryName) {
            var entityId = mw.config.get('wgTitle');
            var fullCategoryName = categoryName.startsWith('Category:') ? categoryName : 'Category:' + categoryName;
            mw.notify('Commons sitelink ekleniyor...', { type: 'info' });

            new mw.Api().postWithToken('csrf', {
                action: 'wbsetsitelink',
                id: entityId,
                linksite: 'commonswiki',
                linktitle: fullCategoryName,
                format: 'json'
            }).done(function (data) {
                if (data.success) {
                    mw.notify('Commons sitelink başarıyla eklendi!', { type: 'success' });
                    setTimeout(function () { location.reload(); }, 1500);
                } else {
                    mw.notify('Hata oluştu: ' + JSON.stringify(data), { type: 'error' });
                }
            }).fail(function (code, data) {
                Helper.handleApiError('Commons sitelink ekleme', code, data);
            });
        },

        handleApiError: function (operation, code, data) {
            var errorMsg = operation + ' API hatası: ' + code;
            if (data && data.error && data.error.info) {
                errorMsg += ' - ' + data.error.info;
            }
            mw.notify(errorMsg, { type: 'error' });
            console.error('Wikidata API error (' + operation + '):', code, data);
        },

        init: function () {
            var entityId = SUS.getEntityId();
            if (!entityId) return;

            var $heading = SUS.getHeadingElement();
            if (!$heading.length) return;

            var hasP373 = this.hasCommonsCategory();
            var p373Value = this.getP373Value();
            var hasSitelink = this.hasCommonsSitelink();
            var commonsCategory = this.getCommonsCategory();

            if (!hasP373 && commonsCategory) {
                SUS.addBadge($heading, {
                    label: 'Wikidata', value: '+P373', variant: 'p373',
                    title: 'Commons kategorisini P373\'e ekle: ' + commonsCategory,
                    onClick: function () {
                        Helper.addCategoryToP373(commonsCategory);
                    }
                });
            }

            if (hasP373 && p373Value && !hasSitelink) {
                SUS.addBadge($heading, {
                    label: 'Sitelink', value: '+iw', variant: 'iw',
                    title: 'P373\'teki kategoriyi Commons sitelink olarak ekle: Category:' + p373Value,
                    onClick: function () {
                        var fullName = p373Value.startsWith('Category:') ? p373Value : 'Category:' + p373Value;
                        var msg = 'P373\'teki "' + p373Value + '" kategorisi Commons sitelink olarak "' + fullName + '" şeklinde eklensin mi?';
                        if (confirm(msg)) {
                            Helper.addCommonsToSitelinks(p373Value);
                        }
                    }
                });
            }
        }
    };

    mw.hook('wikibase.entityPage.entityLoaded').add(function () {
        setTimeout(function () { Helper.init(); }, 500);
    });

    window.WikidataCommonsHelper = Helper;
});
