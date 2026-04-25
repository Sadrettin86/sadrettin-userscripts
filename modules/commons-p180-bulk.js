/**
 * Commons P180 Bulk Adder
 *
 * Çalıştığı yer: Wikimedia Commons → Category namespace (14)
 *
 * Yaptığı iş:
 *  Açık olan kategori sayfasındaki tüm dosyalara, kategorinin Wikidata Q-ID'sini
 *  P180 (depicts) olarak ekler. Toolbox'a "P180 Ekle" butonu çıkar.
 *  - Önce kategorinin pageprops.wikibase_item'ini dener;
 *    yoksa wbsearchentities ile kategori adından arar.
 *  - Her dosya için zaten aynı P180 değerinin olup olmadığını kontrol eder, varsa atlar.
 *  - Onay/sonuç dialog'ları ve ilerleme göstergesi içerir.
 */

(function () {
    'use strict';

    if (mw.config.get('wgServerName') !== 'commons.wikimedia.org' ||
        mw.config.get('wgNamespaceNumber') !== 14) {
        return;
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    async function getCategoryQID(categoryName) {
        var api = new mw.Api();
        try {
            var pageProps = await api.get({
                action: 'query',
                format: 'json',
                prop: 'pageprops',
                titles: 'Category:' + categoryName,
                ppprop: 'wikibase_item'
            });
            var pages = pageProps.query.pages;
            var page = pages[Object.keys(pages)[0]];
            if (page.pageprops && page.pageprops.wikibase_item) {
                return page.pageprops.wikibase_item;
            }
            var search = await api.get({
                action: 'wbsearchentities',
                format: 'json',
                search: categoryName,
                language: 'tr',
                type: 'item',
                limit: 5
            });
            if (search.search && search.search.length > 0) {
                return search.search[0].id;
            }
            return null;
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
                action: 'query',
                format: 'json',
                list: 'categorymembers',
                cmtitle: 'Category:' + categoryName,
                cmnamespace: 6,
                cmlimit: 50
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
            action: 'wbgetentities',
            format: 'json',
            titles: fileName,
            sites: 'commonswiki'
        });
        var entities = entityData.entities;
        var entityId = Object.keys(entities)[0];
        if (entityId === '-1') throw new Error('Dosya bulunamadı');

        var entity = entities[entityId];
        if (entity.statements && entity.statements.P180) {
            for (var i = 0; i < entity.statements.P180.length; i++) {
                var statement = entity.statements.P180[i];
                if (statement.mainsnak.datavalue &&
                    statement.mainsnak.datavalue.value.id === qid) {
                    return { success: false, skipped: true };
                }
            }
        }

        await api.postWithToken('csrf', {
            action: 'wbcreateclaim',
            format: 'json',
            entity: entityId,
            property: 'P180',
            snaktype: 'value',
            value: JSON.stringify({ 'entity-type': 'item', id: qid })
        });
        return { success: true };
    }

    function getTypeColor(type) {
        switch (type) {
            case 'success': return '#28a745';
            case 'warning': return '#ffc107';
            case 'error': return '#dc3545';
            default: return '#0645ad';
        }
    }

    function getTypeTitle(type) {
        switch (type) {
            case 'success': return 'Başarılı';
            case 'warning': return 'Uyarı';
            case 'error': return 'Hata';
            default: return 'Bilgi';
        }
    }

    function showDialog(opts) {
        return new Promise(function (resolve) {
            var $box = $('<div>').addClass('p180-dialog').css('border-color', getTypeColor(opts.type || 'info'));
            var $title = $('<div>').addClass('p180-dialog-title')
                .css('color', getTypeColor(opts.type || 'info'))
                .text(opts.title || getTypeTitle(opts.type || 'info'));
            var $msg = $('<div>').addClass('p180-dialog-message').html(opts.message);
            var $btnRow = $('<div>').addClass('p180-dialog-buttons');

            (opts.buttons || [{ label: 'Tamam', value: true, primary: true }]).forEach(function (b) {
                var $btn = $('<button>').addClass('p180-dialog-btn')
                    .css('background-color', b.primary ? getTypeColor(opts.type || 'info') : '#666')
                    .text(b.label)
                    .click(function () {
                        $box.remove();
                        resolve(b.value);
                    });
                $btnRow.append($btn);
            });

            $box.append($title, $msg, $btnRow);
            $('body').append($box);
        });
    }

    function showAlert(message, type) {
        return showDialog({ message: message, type: type || 'info' });
    }

    function showConfirm(message) {
        return showDialog({
            title: 'Onay',
            message: message,
            type: 'info',
            buttons: [
                { label: 'Evet', value: true, primary: true },
                { label: 'Hayır', value: false }
            ]
        });
    }

    function createProgressIndicator(totalFiles) {
        var $box = $('<div>').addClass('p180-progress');
        var $title = $('<div>').addClass('p180-progress-title').text('P180 Değerleri Ekleniyor...');
        var $barContainer = $('<div>').addClass('p180-progress-bar-container');
        var $bar = $('<div>').addClass('p180-progress-bar');
        $barContainer.append($bar);
        var $status = $('<div>').addClass('p180-progress-status').text('0 / ' + totalFiles + ' dosya işlendi');
        var $current = $('<div>').addClass('p180-progress-current');
        $box.append($title, $barContainer, $status, $current);
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

            var successCount = 0, skipCount = 0, errorCount = 0;
            var $progress = createProgressIndicator(files.length);

            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                updateProgress($progress, i + 1, files.length, file.title);
                try {
                    var result = await addP180ToFile(file.title, qid);
                    if (result.success) successCount++;
                    else if (result.skipped) skipCount++;
                } catch (error) {
                    errorCount++;
                    console.error(file.title + ' - hata:', error);
                }
                await sleep(500);
            }

            $progress.remove();
            showAlert(
                'İşlem tamamlandı!\nBaşarılı: ' + successCount +
                '\nAtlandı: ' + skipCount +
                '\nHata: ' + errorCount +
                '\nToplam: ' + files.length,
                'success'
            );
        } catch (error) {
            console.error('Hata:', error);
            showAlert('Bir hata oluştu: ' + error.message, 'error');
        }
    }

    function addUIButton() {
        if ($('#p180-add-button').length > 0) return;

        var $button = $('<button>')
            .attr('id', 'p180-add-button')
            .text('P180 Ekle')
            .click(addP180ToFiles);

        if ($('#t-whatlinkshere').length > 0) {
            $('<li>').css('margin', '0').append($button).insertAfter('#t-whatlinkshere');
        } else {
            $('.mw-normal-catlinks').after($button);
        }
    }

    $(document).ready(addUIButton);
})();
