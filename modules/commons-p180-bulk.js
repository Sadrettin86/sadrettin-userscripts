/**
 * Commons P180 Bulk Adder
 *
 * Çalıştığı yer: Wikimedia Commons → Category namespace (14)
 *
 * Yaptığı iş:
 *  Açık olan kategori sayfasındaki tüm dosyalara, kategorinin Wikidata Q-ID'sini
 *  P180 (depicts) olarak ekler. Toolbox'a [Commons | +P180 toplu] rozeti çıkar.
 *  - Önce kategorinin pageprops.wikibase_item'ini dener;
 *    yoksa wbsearchentities ile kategori adından arar.
 *  - Her dosya için aynı P180 zaten varsa atlar.
 *  - Onay/sonuç dialog'ları ve ilerleme göstergesi içerir.
 *
 * Bağımlılık: core.js (SUS.addBadge, SUS.sleep)
 */

(function () {
    'use strict';

    if (mw.config.get('wgServerName') !== 'commons.wikimedia.org' ||
        mw.config.get('wgNamespaceNumber') !== 14) {
        return;
    }

    async function getCategoryQID(categoryName) {
        var api = new mw.Api();
        try {
            var pageProps = await api.get({
                action: 'query', format: 'json', prop: 'pageprops',
                titles: 'Category:' + categoryName, ppprop: 'wikibase_item'
            });
            var pages = pageProps.query.pages;
            var page = pages[Object.keys(pages)[0]];
            if (page.pageprops && page.pageprops.wikibase_item) {
                return page.pageprops.wikibase_item;
            }
            var search = await api.get({
                action: 'wbsearchentities', format: 'json',
                search: categoryName, language: 'tr', type: 'item', limit: 5
            });
            return search.search && search.search.length > 0 ? search.search[0].id : null;
        } catch (error) {
            console.error('Q-ID alınırken hata:', error);
            return null;
        }
    }

    async function getQIDLabel(qid) {
        try {
            var response = await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' +
                qid + '&props=labels&languages=tr|en&format=json&origin=*');
            var data = await response.json();
            var labels = data.entities && data.entities[qid] && data.entities[qid].labels;
            if (labels) {
                if (labels.tr && labels.tr.value) return labels.tr.value;
                if (labels.en && labels.en.value) return labels.en.value;
            }
            return null;
        } catch (error) {
            console.error('Label alınırken hata:', error);
            return null;
        }
    }

    async function getCategoryFiles(categoryName) {
        var api = new mw.Api();
        var allFiles = [];
        var cmcontinue = '';
        do {
            var params = {
                action: 'query', format: 'json', list: 'categorymembers',
                cmtitle: 'Category:' + categoryName, cmnamespace: 6, cmlimit: 50
            };
            if (cmcontinue) params.cmcontinue = cmcontinue;
            var response = await api.get(params);
            allFiles = allFiles.concat(response.query.categorymembers);
            cmcontinue = response.continue ? response.continue.cmcontinue : null;
        } while (cmcontinue);
        return allFiles;
    }

    async function addP180ToFile(fileName, qid) {
        var api = new mw.Api();
        var entityData = await api.get({
            action: 'wbgetentities', format: 'json',
            titles: fileName, sites: 'commonswiki'
        });
        var entities = entityData.entities;
        var entityId = Object.keys(entities)[0];
        if (entityId === '-1') throw new Error('Dosya bulunamadı');

        var entity = entities[entityId];
        if (entity.statements && entity.statements.P180) {
            for (var i = 0; i < entity.statements.P180.length; i++) {
                var s = entity.statements.P180[i];
                if (s.mainsnak.datavalue && s.mainsnak.datavalue.value.id === qid) {
                    return { success: false, skipped: true };
                }
            }
        }

        await api.postWithToken('csrf', {
            action: 'wbcreateclaim', format: 'json',
            entity: entityId, property: 'P180', snaktype: 'value',
            value: JSON.stringify({ 'entity-type': 'item', id: qid })
        });
        return { success: true };
    }

    function getTypeColor(type) {
        return ({ success: '#28a745', warning: '#ffc107', error: '#dc3545' })[type] || '#0645ad';
    }
    function getTypeTitle(type) {
        return ({ success: 'Başarılı', warning: 'Uyarı', error: 'Hata' })[type] || 'Bilgi';
    }

    function showDialog(opts) {
        return new Promise(function (resolve) {
            var $box = $('<div>').addClass('p180-dialog').css('border-color', getTypeColor(opts.type || 'info'));
            $('<div>').addClass('p180-dialog-title')
                .css('color', getTypeColor(opts.type || 'info'))
                .text(opts.title || getTypeTitle(opts.type || 'info'))
                .appendTo($box);
            $('<div>').addClass('p180-dialog-message').html(opts.message).appendTo($box);

            var $btnRow = $('<div>').addClass('p180-dialog-buttons');
            (opts.buttons || [{ label: 'Tamam', value: true, primary: true }]).forEach(function (b) {
                $('<button>').addClass('p180-dialog-btn')
                    .css('background-color', b.primary ? getTypeColor(opts.type || 'info') : '#666')
                    .text(b.label)
                    .click(function () { $box.remove(); resolve(b.value); })
                    .appendTo($btnRow);
            });
            $box.append($btnRow);
            $('body').append($box);
        });
    }

    function showAlert(message, type) {
        return showDialog({ message: message, type: type || 'info' });
    }
    function showConfirm(message) {
        return showDialog({
            title: 'Onay', message: message, type: 'info',
            buttons: [
                { label: 'Evet', value: true, primary: true },
                { label: 'Hayır', value: false }
            ]
        });
    }

    function createProgressIndicator(total) {
        var $box = $('<div>').addClass('p180-progress');
        $('<div>').addClass('p180-progress-title').text('P180 Değerleri Ekleniyor...').appendTo($box);
        var $barContainer = $('<div>').addClass('p180-progress-bar-container').appendTo($box);
        $('<div>').addClass('p180-progress-bar').appendTo($barContainer);
        $('<div>').addClass('p180-progress-status').text('0 / ' + total + ' dosya işlendi').appendTo($box);
        $('<div>').addClass('p180-progress-current').appendTo($box);
        $('body').append($box);
        return $box;
    }

    function updateProgress($box, current, total, currentFile) {
        var pct = Math.round((current / total) * 100);
        $box.find('.p180-progress-bar').css('width', pct + '%');
        $box.find('.p180-progress-status').text(current + ' / ' + total + ' dosya işlendi (' + pct + '%)');
        $box.find('.p180-progress-current').text('Şu an işlenen: ' + currentFile.replace('File:', ''));
    }

    async function addP180ToFiles() {
        try {
            var categoryName = mw.config.get('wgPageName').replace('Category:', '');
            var qid = await getCategoryQID(categoryName);
            if (!qid) {
                showAlert('Bu kategori için Wikidata Q-ID bulunamadı!', 'warning');
                return;
            }

            var qidLabel = await getQIDLabel(qid);
            var qidLink = '<a href="https://www.wikidata.org/wiki/' + qid + '" target="_blank">' + qid + '</a>';
            var qidDisplay = qidLabel ? qidLink + ' (<strong>' + qidLabel + '</strong>)' : qidLink;

            var files = await getCategoryFiles(categoryName);
            if (files.length === 0) {
                showAlert('Bu kategoride dosya bulunamadı!', 'warning');
                return;
            }

            var confirmed = await showConfirm(
                files.length + ' dosyaya <a href="https://www.wikidata.org/wiki/Property:P180" target="_blank">P180</a>=' +
                qidDisplay + ' değeri eklenecek. Devam etmek istiyor musunuz?'
            );
            if (!confirmed) return;

            var success = 0, skip = 0, err = 0;
            var $progress = createProgressIndicator(files.length);

            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                updateProgress($progress, i + 1, files.length, file.title);
                try {
                    var result = await addP180ToFile(file.title, qid);
                    if (result.success) success++;
                    else if (result.skipped) skip++;
                } catch (error) {
                    err++;
                    console.error(file.title + ' - hata:', error);
                }
                await window.SUS.sleep(500);
            }

            $progress.remove();
            showAlert(
                'İşlem tamamlandı!\nBaşarılı: ' + success +
                '\nAtlandı: ' + skip + '\nHata: ' + err +
                '\nToplam: ' + files.length,
                'success'
            );
        } catch (error) {
            console.error('Hata:', error);
            showAlert('Bir hata oluştu: ' + error.message, 'error');
        }
    }

    $(document).ready(function () {
        var SUS = window.SUS;
        if (!SUS) {
            console.error('commons-p180-bulk.js: core.js (window.SUS) yüklenmemiş.');
            return;
        }

        var $host = $('.mw-normal-catlinks');
        if ($host.length === 0) $host = $('#siteSub').first();
        if ($host.length === 0) return;

        if ($('.sb-p180').length > 0) return;

        var $wrap = $('<div class="p180-toolbox-wrap">');
        SUS.addBadge($wrap, {
            label: 'Commons', value: '+P180 toplu', variant: 'p180',
            title: 'Bu kategorideki tüm dosyalara P180 (depicts) toplu ekle',
            onClick: addP180ToFiles
        });
        $host.after($wrap);
    });
})();
