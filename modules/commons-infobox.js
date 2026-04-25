/**
 * Commons Infobox Helper
 *
 * Çalıştığı yer: Wikimedia Commons → Category namespace (14)
 *
 * Yaptığı işler:
 *  - Sayfada Wikidata bağlantısı VAR ve {{Wikidata Infobox}} YOK ise:
 *      başlığa "infobox ekle" butonu koyar.
 *  - Sayfada Wikidata bağlantısı YOK ise:
 *      başlığa Duplicity tool'una giden "duplicity" butonu koyar.
 */

$(document).ready(function () {

    var CommonsInfoboxHelper = {

        init: function () {
            if (mw.config.get('wgSiteName') !== 'Wikimedia Commons' ||
                mw.config.get('wgNamespaceNumber') !== 14) {
                return;
            }

            var $heading = $('#firstHeading');
            if (!$heading.length) return;

            var hasWikidataLink = $('#t-wikibase').length > 0;

            this.checkPageContent(function (hasInfobox) {
                if (hasWikidataLink) {
                    if (!hasInfobox && !$('#commons-infobox-button').length) {
                        CommonsInfoboxHelper.addInfoboxButton($heading);
                    }
                } else {
                    if (!$('#commons-duplicity-button').length) {
                        CommonsInfoboxHelper.addDuplicityButton($heading);
                    }
                }
            });
        },

        checkPageContent: function (callback) {
            var pageName = mw.config.get('wgPageName');
            var api = new mw.Api();

            api.get({
                action: 'query',
                prop: 'revisions',
                rvprop: 'content',
                titles: pageName,
                formatversion: 2
            }).then(function (data) {
                var page = data.query.pages[0];
                var content = (page && page.revisions && page.revisions[0] && page.revisions[0].content) || '';
                var hasInfobox = /\{\{\s*Wikidata Infobox/i.test(content);
                callback(hasInfobox);
            }).catch(function (err) {
                console.error('Sayfa içeriği kontrol edilirken hata:', err);
                callback(false);
            });
        },

        addInfoboxButton: function ($heading) {
            var $button = $('<a>')
                .attr('id', 'commons-infobox-button')
                .addClass('commons-helper-button infobox-button')
                .text('infobox ekle')
                .attr('title', 'Sayfanın başına {{Wikidata Infobox}} ekle')
                .click(function (e) {
                    e.preventDefault();
                    CommonsInfoboxHelper.addInfobox($(this));
                });

            $heading.append($button);
        },

        addDuplicityButton: function ($heading) {
            var pageName = mw.config.get('wgPageName');
            var duplicityUrl = 'https://wikidata-todo.toolforge.org/duplicity/#/article/commonswiki/' + encodeURIComponent(pageName);

            var $button = $('<a>')
                .attr('id', 'commons-duplicity-button')
                .addClass('commons-helper-button duplicity-button')
                .text('duplicity')
                .attr('title', 'Duplicity tool ile Wikidata item bul')
                .attr('href', duplicityUrl)
                .attr('target', '_blank');

            $heading.append($button);
        },

        addInfobox: function ($button) {
            var pageName = mw.config.get('wgPageName');
            var api = new mw.Api();

            $button.text('ekleniyor...');

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
                    $button.text('zaten var');
                    setTimeout(function () { $button.text('infobox ekle'); }, 2000);
                    return;
                }

                var newContent = '{{Wikidata Infobox}}\n' + content;
                return api.postWithToken('csrf', {
                    action: 'edit',
                    title: pageName,
                    text: newContent,
                    summary: '{{Wikidata Infobox}} added (user script)',
                    format: 'json'
                });
            }).then(function (res) {
                if (!res) return;
                location.reload();
            }).catch(function (err) {
                console.error('Infobox ekleme hatası:', err);
                $button.text('hata!');
                setTimeout(function () { $button.text('infobox ekle'); }, 2000);
            });
        }
    };

    CommonsInfoboxHelper.init();
});
