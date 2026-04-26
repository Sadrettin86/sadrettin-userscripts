/**
 * Commons Category Creator
 *
 * Çalıştığı yer: Wikidata → item sayfaları (Q\d+)
 *
 * Yaptığı iş:
 *  Item'da Commons sitelink VE P373 ikisi birden YOKSA, başlığa
 *  [Commons | +kategori] rozetini ekler. Tıklanınca:
 *    1) Item'ın EN/TR etiketini önerir, kullanıcı düzenleyebilir.
 *    2) Commons'ta o adda kategori oluşturur ({{Wikidata Infobox}} ile).
 *    3) Item'a Commons sitelink ekler.
 *    4) P373 (Commons category) ifadesini ekler/günceller.
 *
 * Bağımlılık: core.js (SUS.addBadge)
 */

mw.loader.using(['mediawiki.api', 'mediawiki.ForeignApi'], function () {
    var SUS = window.SUS;
    if (!SUS) {
        console.error('commons-category-creator.js: core.js (window.SUS) yüklenmemiş.');
        return;
    }

    if (mw.config.get('wgNamespaceNumber') !== 0) return;

    var qid = mw.config.get('wbEntityId');
    if (!qid) return;

    var hasCommonsLink = document.querySelector('#sitelinks a[href^="https://commons.wikimedia.org/wiki/Category:"]');
    var hasP373 = document.querySelector('.wikibase-statementgroup[data-property-id="P373"]');
    if (hasCommonsLink && hasP373) return;

    var $heading = SUS.getHeadingElement();
    if (!$heading.length) return;

    var $badge = SUS.addBadge($heading, {
        label: 'Commons', value: '+kategori', variant: 'cat-create',
        title: 'Commons kategorisi oluştur, sitelink ekle ve P373 set et',
        onClick: function () { run($(this)); }
    });

    function setStatus($b, text) { $b.find('.sb-value').text(text); }

    function run($b) {
        $b.prop('disabled', true);
        setStatus($b, 'işleniyor…');

        var api = new mw.Api();
        var commonsApi = new mw.ForeignApi('https://commons.wikimedia.org/w/api.php', { anonymous: false });

        api.get({
            action: 'wbgetentities',
            ids: qid,
            props: 'labels',
            languages: 'en|tr'
        }).then(function (data) {
            var labels = data.entities[qid].labels || {};
            var autoName = (labels.en && labels.en.value) || (labels.tr && labels.tr.value) || qid;

            var userInput = window.prompt('Commons kategori adı:', autoName);
            if (userInput === null) {
                throw { info: 'Kullanıcı iptal etti' };
            }

            var categoryName = (userInput || autoName).trim().replace(/^Category\s*:\s*/i, '');
            if (!categoryName) categoryName = autoName;

            return commonsApi.postWithToken('csrf', {
                action: 'edit',
                title: 'Category:' + categoryName,
                text: '{{Wikidata Infobox}}\n',
                summary: 'Created via user script from ' + qid,
                createonly: 1
            }).catch(function (err) {
                var code = err && err.error && err.error.code;
                if (code === 'articleexists' || code === 'editconflict' || code === 'pagedeleted') {
                    console.warn('Kategori zaten var veya oluşturulamadı, devam ediliyor:', code);
                    return;
                }
                throw err;
            }).then(function () {
                return api.postWithToken('csrf', {
                    action: 'wbsetsitelink',
                    id: qid,
                    linksite: 'commonswiki',
                    linktitle: 'Category:' + categoryName,
                    summary: 'Add Commons category sitelink'
                }).then(function () { return { categoryName: categoryName }; });
            });
        }).then(function (ctx) {
            var categoryName = ctx.categoryName;

            return api.postWithToken('csrf', {
                action: 'wbcreateclaim',
                entity: qid,
                property: 'P373',
                snaktype: 'value',
                value: JSON.stringify(categoryName),
                summary: 'Set Commons category'
            }).catch(function (err) {
                console.warn('wbcreateclaim başarısız, wbsetclaimvalue deneniyor:', err);
                return api.get({
                    action: 'wbgetclaims',
                    entity: qid,
                    property: 'P373'
                }).then(function (cdata) {
                    var claims = (cdata.claims && cdata.claims.P373) || [];
                    if (!claims.length) throw err;
                    var claimId = claims[0].id;
                    return api.postWithToken('csrf', {
                        action: 'wbsetclaimvalue',
                        claim: claimId,
                        snaktype: 'value',
                        value: JSON.stringify(categoryName),
                        summary: 'Update Commons category'
                    });
                });
            });
        }).then(function () {
            setStatus($b, 'tamam');
            $b.addClass('is-success');
            setTimeout(function () { location.reload(); }, 800);
        }).catch(function (err) {
            setStatus($b, 'hata');
            $b.addClass('is-error');
            console.error(err);
            $b.prop('disabled', false);
        });
    }
});
