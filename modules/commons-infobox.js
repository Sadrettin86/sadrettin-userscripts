/**
 * Commons Infobox Helper
 *
 * Çalıştığı yer: Wikimedia Commons → Category namespace (14)
 *
 * Yaptığı işler:
 *  - Sayfada Wikidata bağlantısı VAR ve {{Wikidata Infobox}} YOK ise:
 *      başlığa [Commons | +infobox] rozetini ekler.
 *  - Sayfada Wikidata bağlantısı YOK ise:
 *      başlığa [Tool | Duplicity] rozetini ekler.
 *
 * Bağımlılık: core.js (SUS.addBadge)
 */

$(document).ready(function () {
    var SUS = window.SUS;
    if (!SUS) {
        console.error('commons-infobox.js: core.js (window.SUS) yüklenmemiş.');
        return;
    }

    if (mw.config.get('wgSiteName') !== 'Wikimedia Commons' ||
        mw.config.get('wgNamespaceNumber') !== 14) {
        return;
    }

    var $heading = $('#firstHeading');
    if (!$heading.length) return;

    function checkPageContent(callback) {
        var pageName = mw.config.get('wgPageName');
        new mw.Api().get({
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            titles: pageName,
            formatversion: 2
        }).then(function (data) {
            var page = data.query.pages[0];
            var content = (page && page.revisions && page.revisions[0] && page.revisions[0].content) || '';
            callback(/\{\{\s*Wikidata Infobox/i.test(content));
        }).catch(function (err) {
            console.error('Sayfa içeriği kontrol edilirken hata:', err);
            callback(false);
        });
    }

    function addInfobox($badge) {
        var pageName = mw.config.get('wgPageName');
        var api = new mw.Api();
        $badge.find('.sb-value').text('ekleniyor…');

        api.get({
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            titles: pageName,
            formatversion: 2
        }).then(function (data) {
            var page = data.query.pages[0];
            var content = (page && page.revisions && page.revisions[0] && page.revisions[0].content) || '';

            if (/\{\{\s*Wikidata Infobox/i.test(content)) {
                $badge.find('.sb-value').text('zaten var');
                setTimeout(function () { $badge.find('.sb-value').text('+infobox'); }, 2000);
                return;
            }

            return api.postWithToken('csrf', {
                action: 'edit',
                title: pageName,
                text: '{{Wikidata Infobox}}\n' + content,
                summary: '{{Wikidata Infobox}} added (user script)',
                format: 'json'
            });
        }).then(function (res) {
            if (!res) return;
            location.reload();
        }).catch(function (err) {
            console.error('Infobox ekleme hatası:', err);
            $badge.find('.sb-value').text('hata!');
            setTimeout(function () { $badge.find('.sb-value').text('+infobox'); }, 2000);
        });
    }

    var hasWikidataLink = $('#t-wikibase').length > 0;

    checkPageContent(function (hasInfobox) {
        if (hasWikidataLink) {
            if (!hasInfobox && !$heading.find('.sb-infobox').length) {
                SUS.addBadge($heading, {
                    label: 'Commons', value: '+infobox', variant: 'infobox',
                    title: 'Sayfanın başına {{Wikidata Infobox}} ekle',
                    onClick: function () { addInfobox($(this)); }
                });
            }
        } else {
            if (!$heading.find('.sb-duplicity').length) {
                var pageName = mw.config.get('wgPageName');
                SUS.addBadge($heading, {
                    label: 'Tool', value: 'Duplicity', variant: 'duplicity',
                    href: 'https://wikidata-todo.toolforge.org/duplicity/#/article/commonswiki/' + encodeURIComponent(pageName),
                    title: 'Duplicity tool ile Wikidata item bul'
                });
            }
        }
    });
});
