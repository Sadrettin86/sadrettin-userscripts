/**
 * Commons Category Creator
 *
 * Çalıştığı yer: Wikidata → item sayfaları (Q\d+)
 *
 * Yaptığı iş:
 *  Item'da Commons sitelink VE P373 ikisi birden YOKSA, başlığa
 *  "Commons kategori oluştur" butonu ekler. Tıklanınca:
 *    1) Item'ın EN/TR etiketini önerir, kullanıcı düzenleyebilir.
 *    2) Commons'ta o adda kategori oluşturur ({{Wikidata Infobox}} ile).
 *    3) Item'a Commons sitelink ekler.
 *    4) P373 (Commons category) ifadesini ekler/günceller.
 */

mw.loader.using(['mediawiki.api', 'mediawiki.ForeignApi'], function () {
    if (mw.config.get('wgNamespaceNumber') !== 0) return;

    var qid = mw.config.get('wbEntityId');
    if (!qid) return;

    var hasCommonsLink = document.querySelector('#sitelinks a[href^="https://commons.wikimedia.org/wiki/Category:"]');
    var hasP373 = document.querySelector('.wikibase-statementgroup[data-property-id="P373"]');
    if (hasCommonsLink && hasP373) return;

    var idSpan = document.querySelector('#firstHeading .wikibase-title-id');
    if (!idSpan) return;

    var btn = document.createElement('button');
    btn.textContent = 'Commons kategori oluştur';
    btn.className = 'commons-button commons-create-category-button';
    idSpan.appendChild(btn);

    btn.addEventListener('click', function () {
        btn.disabled = true;
        btn.textContent = 'İşleniyor…';

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
                }).then(function () {
                    return { categoryName: categoryName };
                });
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
            btn.textContent = 'Tamamlandı';
            setTimeout(function () { location.reload(); }, 800);
        }).catch(function (err) {
            btn.textContent = 'Hata: ' + ((err && (err.info || (err.error && err.error.info))) || err);
            console.error(err);
            btn.disabled = false;
        });
    });
});
