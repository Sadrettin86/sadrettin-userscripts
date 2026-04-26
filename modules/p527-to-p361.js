/**
 * P527 → P361 Auto-Adder
 *
 * Çalıştığı yer: Wikidata → item sayfaları (Q\d+)
 *
 * Yaptığı iş:
 *  Açık olan item P527 (şun(lar)dan oluşur / has parts) içeriyorsa,
 *  bu listedeki her hedef öğenin sayfasına geri-yönlü P361 (parçası / part of)
 *  ifadesi olarak mevcut item'i ekler. P527 grubunun yanında
 *  [P527→P361 | yansıt] rozeti çıkar.
 *
 * Bağımlılık: core.js (SUS.addBadge, SUS.sleep)
 */

$(document).ready(function () {
    var SUS = window.SUS;
    if (!SUS) {
        console.error('p527-to-p361.js: core.js (window.SUS) yüklenmemiş.');
        return;
    }

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
                found = $this; return false;
            }
            var href = $this.find('.wikibase-statementgroupview-property-label a').attr('href') || '';
            if (href.includes('P527') || href.endsWith('P527')) {
                found = $this; return false;
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
                var match = ($(this).attr('href') || '').match(/\/Q(\d+)$/);
                if (match) qids.push('Q' + match[1]);
            });
        }
        return qids;
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
                    var existingValues = data.claims.P361.map(function (c) {
                        return c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value
                            ? c.mainsnak.datavalue.value.id : null;
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
                    resolve(result.success
                        ? { success: true, existing: false }
                        : { success: false, error: result.error || 'Bilinmeyen hata' });
                }).fail(function (error) {
                    resolve({ success: false, error: error });
                });
            }).fail(function (error) {
                resolve({ success: false, error: error });
            });
        });
    }

    function setStatus($badge, text) { $badge.find('.sb-value').text(text); }

    async function processP527Values($group, $badge) {
        $badge.prop('disabled', true).addClass('is-processing');
        setStatus($badge, 'işleniyor…');

        try {
            var currentQid = mw.config.get('wgPageName');
            var qids = collectQids($group);

            if (qids.length === 0) throw new Error('P527\'de QID bulunamadı');

            var success = 0, errors = 0, existing = 0;

            for (var i = 0; i < qids.length; i++) {
                setStatus($badge, (i + 1) + '/' + qids.length);
                try {
                    var result = await addP361Claim(qids[i], currentQid);
                    if (result.success) {
                        if (result.existing) existing++;
                        else success++;
                    } else {
                        errors++;
                    }
                } catch (e) {
                    errors++;
                }
                if (i < qids.length - 1) await SUS.sleep(1500);
            }

            $badge.removeClass('is-processing').addClass(errors === 0 ? 'is-success' : 'is-error');
            setStatus($badge, success + '+' + existing + (errors ? '/' + errors + 'hata' : ''));
        } catch (error) {
            $badge.removeClass('is-processing').addClass('is-error');
            setStatus($badge, 'hata');
            console.error(error);
        }

        setTimeout(function () {
            $badge.prop('disabled', false)
                  .removeClass('is-processing is-success is-error');
            setStatus($badge, 'yansıt');
        }, 4000);
    }

    function addP527Button() {
        var $group = findP527Group();
        if (!isReallyP527($group)) return;
        if ($group.find('.sb-p527').length > 0) return;

        var $wrap = $('<div class="p527-button-wrap">');
        SUS.addBadge($wrap, {
            label: 'P527→P361', value: 'yansıt', variant: 'p527',
            title: 'Bu öğeyi P527 listesindeki tüm hedeflere P361 olarak ekle',
            onClick: function () {
                processP527Values($group, $(this));
            }
        });

        var $propertyContainer = $group.find('.wikibase-statementgroupview-property');
        if ($propertyContainer.length > 0) {
            $propertyContainer.append($wrap);
            return;
        }
        var $listView = $group.find('.wikibase-statementlistview');
        if ($listView.length > 0) {
            $listView.before($wrap);
            return;
        }
        $group.prepend($wrap);
    }

    mw.hook('wikibase.entityPage.entityLoaded').add(function () {
        setTimeout(addP527Button, 500);
    });

    window.debugP527 = addP527Button;
});
