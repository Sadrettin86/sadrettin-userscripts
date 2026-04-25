/**
 * P527 → P361 Auto-Adder
 *
 * Çalıştığı yer: Wikidata → item sayfaları (Q\d+)
 *
 * Yaptığı iş:
 *  Açık olan item P527 (şun(lar)dan oluşur / has parts) içeriyorsa,
 *  bu listedeki her hedef öğenin sayfasına geri-yönlü P361 (parçası / part of)
 *  ifadesi olarak mevcut item'i ekler. P527 grubunun yanında bir buton çıkar.
 */

$(document).ready(function () {

    if (mw.config.get('wgNamespaceNumber') !== 0 ||
        !mw.config.get('wgPageName').startsWith('Q')) {
        return;
    }

    function findP527Group() {
        var $group = $('.wikibase-statementgroupview[data-property-id="P527"]').first();
        if ($group.length > 0) return $group;

        var found = null;
        $('.wikibase-statementgroupview').each(function () {
            var $this = $(this);
            if ($this.attr('data-property-id') === 'P527') {
                found = $this;
                return false;
            }
            var $propLink = $this.find('.wikibase-statementgroupview-property .wikibase-statementgroupview-property-label a');
            var href = $propLink.attr('href') || '';
            if (href.includes('P527') || href.endsWith('P527')) {
                found = $this;
                return false;
            }
            var labelText = $this.find('.wikibase-statementgroupview-property-label').text().trim().toLowerCase();
            if (labelText === 'şun(lar)dan oluşur' || labelText === 'has part' || labelText === 'has parts') {
                found = $this;
                return false;
            }
        });
        return found;
    }

    function isReallyP527($group) {
        if (!$group || $group.length === 0) return false;
        if ($group.attr('data-property-id') === 'P527') return true;
        var href = $group.find('.wikibase-statementgroupview-property-label a').attr('href') || '';
        return href.includes('P527') || href.endsWith('P527');
    }

    function collectQids($group) {
        var qids = [];
        $group.find('.wikibase-entityid-value').each(function () {
            var qid = $(this).text().trim();
            if (qid.startsWith('Q')) qids.push(qid);
        });
        if (qids.length === 0) {
            $group.find('a[title]').each(function () {
                var title = $(this).attr('title');
                if (title && /^Q\d+$/.test(title)) qids.push(title);
            });
        }
        if (qids.length === 0) {
            $group.find('a[href]').each(function () {
                var href = $(this).attr('href');
                var match = href.match(/\/Q(\d+)$/);
                if (match) qids.push('Q' + match[1]);
            });
        }
        return qids;
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function addP361Claim(targetQid, currentQid) {
        return new Promise(function (resolve) {
            new mw.Api().get({
                action: 'wbgetclaims',
                entity: targetQid,
                property: 'P361',
                format: 'json'
            }).done(function (data) {
                if (data.claims && data.claims.P361) {
                    var existingValues = data.claims.P361.map(function (claim) {
                        return claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.value
                            ? claim.mainsnak.datavalue.value.id : null;
                    }).filter(Boolean);

                    if (existingValues.indexOf(currentQid) !== -1) {
                        resolve({ success: true, existing: true });
                        return;
                    }
                }

                new mw.Api().postWithToken('csrf', {
                    action: 'wbcreateclaim',
                    entity: targetQid,
                    property: 'P361',
                    snaktype: 'value',
                    value: JSON.stringify({ 'entity-type': 'item', 'id': currentQid }),
                    format: 'json'
                }).done(function (result) {
                    if (result.success) {
                        resolve({ success: true, existing: false });
                    } else {
                        resolve({ success: false, error: result.error || 'Bilinmeyen hata' });
                    }
                }).fail(function (error) {
                    resolve({ success: false, error: error });
                });
            }).fail(function (error) {
                resolve({ success: false, error: error });
            });
        });
    }

    async function processP527Values($group, $button) {
        $button.prop('disabled', true).text('İşleniyor...').css('background-color', '#ccc');

        try {
            var currentQid = mw.config.get('wgPageName');
            var qids = collectQids($group);

            if (qids.length === 0) {
                throw new Error('P527\'de QID bulunamadı');
            }

            var successCount = 0, errorCount = 0, existingCount = 0;

            for (var i = 0; i < qids.length; i++) {
                var targetQid = qids[i];
                $button.text('İşleniyor... (' + (i + 1) + '/' + qids.length + ')');

                try {
                    var result = await addP361Claim(targetQid, currentQid);
                    if (result.success) {
                        if (result.existing) existingCount++;
                        else successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                }

                if (i < qids.length - 1) await sleep(1500);
            }

            var resultText = 'Tamamlandı: ' + successCount + ' eklendi';
            if (existingCount > 0) resultText += ', ' + existingCount + ' zaten vardı';
            if (errorCount > 0) resultText += ', ' + errorCount + ' hata';

            $button.text(resultText).css('background-color', successCount > 0 ? '#00af89' : '#d33');
        } catch (error) {
            $button.text('Hata oluştu: ' + error.message).css('background-color', '#d33');
        }

        setTimeout(function () {
            $button.prop('disabled', false)
                   .text('Bu Qid\'yi ögelere ekle')
                   .css('background-color', '#0645ad');
        }, 4000);
    }

    function addP527Button() {
        var $p527Group = findP527Group();
        if (!isReallyP527($p527Group)) return;
        if ($p527Group.find('.p527-auto-button').length > 0) return;

        var $button = $('<button>')
            .addClass('p527-auto-button')
            .text('Bu Qid\'yi ögelere ekle')
            .click(function () {
                processP527Values($p527Group, $button);
            });

        var $propertyContainer = $p527Group.find('.wikibase-statementgroupview-property');
        if ($propertyContainer.length > 0) {
            $propertyContainer.append($('<div>').addClass('p527-button-wrap').append($button));
            return;
        }
        var $listView = $p527Group.find('.wikibase-statementlistview');
        if ($listView.length > 0) {
            $listView.before($('<div>').addClass('p527-button-wrap').append($button));
            return;
        }
        $p527Group.prepend($('<div>').addClass('p527-button-wrap p527-fallback').append($button));
    }

    mw.hook('wikibase.entityPage.entityLoaded').add(function () {
        setTimeout(addP527Button, 500);
    });

    window.debugP527 = addP527Button;
});
