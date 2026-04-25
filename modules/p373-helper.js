/**
 * P373 Helper (Wikidata)
 *
 * Çalıştığı yer: Wikidata → item sayfaları (Q\d+)
 *
 * Yaptığı işler:
 *  - Commons sitelink VAR ama P373 (Commons category) YOK ise:
 *      "P373 ekle" butonu çıkar.
 *  - P373 VAR ama Commons sitelink YOK ise:
 *      "iw ekle" butonu çıkar (P373 değerini sitelink olarak ekler).
 */

$(document).ready(function () {

    if (mw.config.get('wgNamespaceNumber') !== 0 ||
        !mw.config.get('wgTitle').match(/^Q\d+$/)) {
        return;
    }

    function getEntityId() {
        var fromWiki = mw.config.get('wgWikibaseItemId');
        if (fromWiki) return fromWiki;
        var fromWD = mw.config.get('wgTitle');
        if (/^Q\d+$/.test(fromWD)) return fromWD;
        return null;
    }

    function getHeadingElement() {
        var $heading = $('#firstHeading');
        if (!$heading.length) {
            $heading = $('h1.wikibase-titlepage-heading');
        }
        return $heading;
    }

    var WikidataCommonsHelper = {

        getP373Value: function () {
            var p373Element = $('.wikibase-statementgroupview[data-property-id="P373"] .wikibase-snakview-value');
            if (p373Element.length > 0) {
                return p373Element.first().text().trim();
            }
            return null;
        },

        hasCommonsCategory: function () {
            return $('.wikibase-statementgroupview[data-property-id="P373"]').length > 0;
        },

        hasCommonsSitelink: function () {
            return $('.wikibase-sitelinklistview a[href*="commons.wikimedia.org"]').length > 0;
        },

        getCommonsCategory: function () {
            var commonsLink = $('.wikibase-sitelinklistview a[href*="commons.wikimedia.org/wiki/Category:"]');
            if (commonsLink.length === 0) return null;

            var href = commonsLink.attr('href');
            var match = href.match(/\/wiki\/Category:(.+)$/);
            if (match) {
                return decodeURIComponent(match[1]).replace(/_/g, ' ');
            }
            return null;
        },

        addHeadingButtons: function ($heading) {
            var hasP373 = this.hasCommonsCategory();
            var p373Value = this.getP373Value();
            var hasCommonsSitelink = this.hasCommonsSitelink();
            var commonsCategory = this.getCommonsCategory();

            if (!hasP373 && commonsCategory) {
                this.addP373Button($heading, commonsCategory);
            }
            if (hasP373 && p373Value && !hasCommonsSitelink) {
                this.addSitelinkButton($heading, p373Value);
            }
        },

        addP373Button: function ($heading, categoryName) {
            var $button = $('<a>')
                .addClass('commons-helper-button p373-button')
                .text('P373 ekle')
                .attr('title', 'Commons kategorisini P373\'e ekle: ' + categoryName)
                .click(function (e) {
                    e.preventDefault();
                    WikidataCommonsHelper.addCategoryToP373(categoryName);
                });
            $heading.append($button);
        },

        addSitelinkButton: function ($heading, categoryName) {
            var $button = $('<a>')
                .addClass('commons-helper-button iw-button')
                .text('iw ekle')
                .attr('title', 'P373\'teki kategoriyi Commons sitelink olarak ekle: Category:' + categoryName)
                .click(function (e) {
                    e.preventDefault();
                    var fullCategoryName = categoryName.startsWith('Category:') ? categoryName : 'Category:' + categoryName;
                    var message = 'P373\'teki "' + categoryName + '" kategorisi Commons sitelink olarak "' + fullCategoryName + '" şeklinde eklensin mi?';
                    if (confirm(message)) {
                        WikidataCommonsHelper.addCommonsToSitelinks(categoryName);
                    }
                });
            $heading.append($button);
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
                WikidataCommonsHelper.handleApiError('P373 ekleme', code, data);
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
                WikidataCommonsHelper.handleApiError('Commons sitelink ekleme', code, data);
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
            var entityId = getEntityId();
            if (!entityId) return;

            var $heading = getHeadingElement();
            if (!$heading.length) return;

            this.addHeadingButtons($heading);
        }
    };

    mw.hook('wikibase.entityPage.entityLoaded').add(function () {
        setTimeout(function () { WikidataCommonsHelper.init(); }, 500);
    });

    $(window).on('load', function () {
        setTimeout(function () { WikidataCommonsHelper.init(); }, 1000);
    });

    window.WikidataCommonsHelper = WikidataCommonsHelper;
});
