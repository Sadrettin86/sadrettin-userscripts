/**
 * Wikidata Commons Category Auto-Adder & Sitelink Manager
 * Commons kategorilerini otomatik olarak P373 property'sine ekler
 * P373'teki kategoriyi "Diğer siteler" bölümüne ekler
 * Commons kategori sayfalarında Wikidata Infobox ekler
 *
 * NOT: Bu dosya orijinal monolitik versiyondur. Modüler versiyon için
 * ../modules/ klasörüne bakın. Sadece referans/yedek amaçlı saklanmaktadır.
 */

$(document).ready(function() {

    // Commons Infobox Helper (sadece Commons kategori sayfalarında)
var CommonsInfoboxHelper = {
    init: function() {
        // Sadece Commons'da ve Category namespace'inde çalış
        if (mw.config.get('wgSiteName') !== 'Wikimedia Commons' || mw.config.get('wgNamespaceNumber') !== 14) {
            return;
        }

        var $heading = $('#firstHeading');
        if (!$heading.length) return;

        // Wikidata bağlantısı var mı kontrol et
        var hasWikidataLink = $('#t-wikibase').length > 0;

        // Sayfada {{Wikidata Infobox}} var mı kontrol et
        this.checkPageContent(function(hasInfobox) {
            if (hasWikidataLink) {
                // Wikidata bağlantısı varsa ve infobox yoksa infobox butonu ekle
                if (!hasInfobox && !$('#commons-infobox-button').length) {
                    CommonsInfoboxHelper.addInfoboxButton($heading);
                }
            } else {
                // Wikidata bağlantısı yoksa duplicity butonu ekle
                if (!$('#commons-duplicity-button').length) {
                    CommonsInfoboxHelper.addDuplicityButton($heading);
                }
            }
        });
    },

    checkPageContent: function(callback) {
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

            // {{Wikidata Infobox}} şablonu var mı kontrol et
            var hasInfobox = /\{\{\s*Wikidata Infobox/i.test(content);
            callback(hasInfobox);
        }).catch(function (err) {
            console.error('Sayfa içeriği kontrol edilirken hata:', err);
            callback(false); // Hata durumunda false döndür
        });
    },

        addInfoboxButton: function($heading) {
            var $button = $('<a>')
                .attr('id', 'commons-infobox-button')
                .addClass('commons-helper-button infobox-button')
                .text('infobox ekle')
                .attr('title', 'Sayfanın başına {{Wikidata Infobox}} ekle')
                .click(function(e) {
                    e.preventDefault();
                    CommonsInfoboxHelper.addInfobox($(this));
                });

            $heading.append($button);
        },

        addDuplicityButton: function($heading) {
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

        addInfobox: function($button) {
            var pageName = mw.config.get('wgPageName');
            var api = new mw.Api();

            // Buton durumunu değiştir
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
                    console.log('Zaten {{Wikidata Infobox}} var.');
                    $button.text('zaten var');
                    setTimeout(function() {
                        $button.text('infobox ekle');
                    }, 2000);
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
                if (!res) return; // zaten vardı
                location.reload(); // yenile
            }).catch(function (err) {
                console.error('Infobox ekleme hatası:', err);
                $button.text('hata!');
                setTimeout(function() {
                    $button.text('infobox ekle');
                }, 2000);
            });
        }
    };

    // Commons Infobox Helper'ı başlat
    CommonsInfoboxHelper.init();

    // Sadece Wikidata namespace'inde ve item sayfalarında çalış (P373/Commons helper için)
    if (mw.config.get('wgNamespaceNumber') !== 0 || !mw.config.get('wgTitle').match(/^Q\d+$/)) {
        return;
    }

    var WikidataCommonsHelper = {

        // P373 property'sinin değerini al
        getP373Value: function() {
            var p373Element = $('.wikibase-statementgroupview[data-property-id="P373"] .wikibase-snakview-value');
            if (p373Element.length > 0) {
                return p373Element.first().text().trim();
            }
            return null;
        },

        // P373 property'sinin var olup olmadığını kontrol et
        hasCommonsCategory: function() {
            return $('.wikibase-statementgroupview[data-property-id="P373"]').length > 0;
        },

        // Commons sitelink'inin var olup olmadığını kontrol et
        hasCommonsSitelink: function() {
            return $('.wikibase-sitelinklistview a[href*="commons.wikimedia.org"]').length > 0;
        },

        // Commons kategorisini "Diğer siteler" bölümünden al
        getCommonsCategory: function() {
            var commonsLink = $('.wikibase-sitelinklistview a[href*="commons.wikimedia.org/wiki/Category:"]');
            if (commonsLink.length === 0) return null;

            var href = commonsLink.attr('href');
            var match = href.match(/\/wiki\/Category:(.+)$/);
            if (match) {
                return decodeURIComponent(match[1]).replace(/_/g, ' ');
            }
            return null;
        },

        // Başlık yanına butonları ekle
        addHeadingButtons: function($heading) {
            var hasP373 = this.hasCommonsCategory();
            var p373Value = this.getP373Value();
            var hasCommonsSitelink = this.hasCommonsSitelink();
            var commonsCategory = this.getCommonsCategory();

            // P373 yoksa ama Commons kategorisi varsa -> P373 ekle butonu
            if (!hasP373 && commonsCategory) {
                this.addP373Button($heading, commonsCategory);
            }

            // P373 varsa ama Commons sitelink yoksa -> iw ekle butonu
            if (hasP373 && p373Value && !hasCommonsSitelink) {
                this.addSitelinkButton($heading, p373Value);
            }
        },

        // P373'e kategori ekleme butonu
        addP373Button: function($heading, categoryName) {
            var $button = $('<a>')
                .addClass('commons-helper-button p373-button')
                .text('P373 ekle')
                .attr('title', 'Commons kategorisini P373\'e ekle: ' + categoryName)
                .click(function(e) {
                    e.preventDefault();
                    WikidataCommonsHelper.promptAddCategory(categoryName);
                });

            $heading.append($button);
        },

        // Commons sitelink ekleme butonu
        addSitelinkButton: function($heading, categoryName) {
            var $button = $('<a>')
                .addClass('commons-helper-button iw-button')
                .text('iw ekle')
                .attr('title', 'P373\'teki kategoriyi Commons sitelink olarak ekle: Category:' + categoryName)
                .click(function(e) {
                    e.preventDefault();
                    WikidataCommonsHelper.promptAddSitelink(categoryName);
                });

            $heading.append($button);
        },

        // Kullanıcıya kategori ekleme seçeneği sun
        promptAddCategory: function(categoryName) {
            this.addCategoryToP373(categoryName);
        },

        // Kullanıcıya sitelink ekleme seçeneği sun
        promptAddSitelink: function(categoryName) {
            var fullCategoryName = categoryName.startsWith('Category:') ? categoryName : 'Category:' + categoryName;
            var message = 'P373\'teki "' + categoryName + '" kategorisi Commons sitelink olarak "' + fullCategoryName + '" şeklinde eklensin mi?';

            if (confirm(message)) {
                this.addCommonsToSitelinks(categoryName);
            }
        },

        // P373'e kategori ekle
        addCategoryToP373: function(categoryName) {
            var entityId = mw.config.get('wgTitle');

            var params = {
                action: 'wbcreateclaim',
                entity: entityId,
                property: 'P373',
                snaktype: 'value',
                value: JSON.stringify(categoryName),
                format: 'json'
            };

            mw.notify('Commons kategorisi P373\'e ekleniyor...', { type: 'info' });

            new mw.Api().postWithToken('csrf', params).done(function(data) {
                if (data.success) {
                    mw.notify('Commons kategorisi P373\'e başarıyla eklendi!', { type: 'success' });
                    setTimeout(function() {
                        location.reload();
                    }, 1500);
                } else {
                    mw.notify('Hata oluştu: ' + JSON.stringify(data), { type: 'error' });
                }
            }).fail(function(code, data) {
                WikidataCommonsHelper.handleApiError('P373 ekleme', code, data);
            });
        },

        // Commons'ı sitelinks'e ekle
        addCommonsToSitelinks: function(categoryName) {
            var entityId = mw.config.get('wgTitle');
            var fullCategoryName = categoryName.startsWith('Category:') ? categoryName : 'Category:' + categoryName;

            var params = {
                action: 'wbsetsitelink',
                id: entityId,
                linksite: 'commonswiki',
                linktitle: fullCategoryName,
                format: 'json'
            };

            mw.notify('Commons sitelink ekleniyor...', { type: 'info' });

            new mw.Api().postWithToken('csrf', params).done(function(data) {
                if (data.success) {
                    mw.notify('Commons sitelink başarıyla eklendi!', { type: 'success' });
                    setTimeout(function() {
                        location.reload();
                    }, 1500);
                } else {
                    mw.notify('Hata oluştu: ' + JSON.stringify(data), { type: 'error' });
                }
            }).fail(function(code, data) {
                WikidataCommonsHelper.handleApiError('Commons sitelink ekleme', code, data);
            });
        },

        // API hata yönetimi
        handleApiError: function(operation, code, data) {
            var errorMsg = operation + ' API hatası: ' + code;
            if (data && data.error && data.error.info) {
                errorMsg += ' - ' + data.error.info;
            }
            mw.notify(errorMsg, { type: 'error' });
            console.error('Wikidata API error (' + operation + '):', code, data);
        },

        // Ana başlangıç fonksiyonu
        init: function() {
            var entityId = getEntityId();
            if (!entityId) return;

            var $heading = getHeadingElement();
            if (!$heading.length) return;

            // Başlık yanına butonları ekle
            this.addHeadingButtons($heading);

            // Debug bilgileri
            var hasP373 = this.hasCommonsCategory();
            var p373Value = this.getP373Value();
            var hasCommonsSitelink = this.hasCommonsSitelink();
            var commonsCategory = this.getCommonsCategory();

            console.log('WikidataCommonsHelper Debug:', {
                hasP373: hasP373,
                p373Value: p373Value,
                hasCommonsSitelink: hasCommonsSitelink,
                commonsCategory: commonsCategory
            });
        }
    };

    // Hook: Sayfa tam yüklendiğinde çalıştır
    mw.hook('wikibase.entityPage.entityLoaded').add(function() {
        setTimeout(function() {
            WikidataCommonsHelper.init();
        }, 500);
    });

    // Fallback: Normal sayfa yüklenme eventi
    $(window).on('load', function() {
        setTimeout(function() {
            WikidataCommonsHelper.init();
        }, 1000);
    });

    // Global erişim için
    window.WikidataCommonsHelper = WikidataCommonsHelper;

});

// ========================================================================
// MEVCUT KOD BURADAN BAŞLIYOR
// ========================================================================

async function isLocatedInIstanbulRecursive(qid, visited = new Set()) {
    if (!qid || visited.has(qid)) return false;
    visited.add(qid);
    if (qid === 'Q534799') return true;

    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`;
    try {
        const data = await $.getJSON(url);
        const claims = data.entities?.[qid]?.claims?.P131;
        if (!claims) return false;

        for (const claim of claims) {
            const nextQid = claim.mainsnak?.datavalue?.value?.id;
            if (await isLocatedInIstanbulRecursive(nextQid, visited)) return true;
        }
    } catch (err) {
        console.error("İBB zinciri kontrol hatası:", err);
    }
    return false;
}


/**
 * 1) Ortak fonksiyon: Bulunduğumuz sayfanın Q ID'sini tespit eder.
 */
function getEntityId() {
    var fromWiki = mw.config.get('wgWikibaseItemId'); // Wikipedia
    if (fromWiki) {
        return fromWiki;
    }
    var fromWD = mw.config.get('wgTitle'); // Wikidata
    if (/^Q\d+$/.test(fromWD)) {
        return fromWD;
    }
    return null;
}

/**
 * 2) Heading elementini tespit edelim.
 */
function getHeadingElement() {
    var $heading = $('#firstHeading');
    if (!$heading.length) {
        $heading = $('h1.wikibase-titlepage-heading');
    }
    return $heading;
}

/**
 * 3) Buton ekleme kolaylığı için ufak fonksiyon.
 */
function addButton($container, tag, cssClass, text, extraAttrs) {
    var $el = $('<' + tag + '>')
        .addClass(cssClass)
        .text(text);

    if (extraAttrs) {
        Object.keys(extraAttrs).forEach(function (key) {
            $el.attr(key, extraAttrs[key]);
        });
    }
    $container.append($el);
    return $el;
}

/**
 * 4) İstanbul'da mı kontrolü
 */
function isLocatedInIstanbul(p131claims) {
    if (!p131claims) return false;

    var queue = p131claims.map(function (c) {
        return c.mainsnak.datavalue.value.id;
    });

    var istanbulQid = "Q534799";

    while (queue.length) {
        var current = queue.shift();
        if (current === istanbulQid) {
            return true;
        }
    }
    return false;
}

/**
 * 5) Asıl işlemleri başlatalım:
 */
$(function () {
    var entityId = getEntityId();
    if (!entityId) return;

    var $heading = getHeadingElement();
    if (!$heading.length) return;

    var apiUrl = 'https://www.wikidata.org/w/api.php?' +
        'action=wbgetentities&ids=' + entityId +
        '&props=claims|labels&languages=tr&format=json&origin=*';

    $.getJSON(apiUrl, function (data) {
        if (!data.entities || !data.entities[entityId]) return;

        var entity = data.entities[entityId];
        var claims = entity.claims || {};
        var trLabel = entity.labels && entity.labels.tr ? entity.labels.tr.value : null;

        var coords = claims.P625 ? claims.P625[0].mainsnak.datavalue.value : null;
        var lat = coords ? coords.latitude : null;
        var lon = coords ? coords.longitude : null;

        var osmPointId = claims.P11693 ? claims.P11693[0].mainsnak.datavalue.value : null;
        var osmWayId = claims.P10689 ? claims.P10689[0].mainsnak.datavalue.value : null;
        var osmRelationId = claims.P402 ? claims.P402[0].mainsnak.datavalue.value : null;

        var hasKE = (claims.P11729 && claims.P11729.length > 0);
        var p131 = claims.P131;

        // 1) KE butonu
        if (hasKE) {
            var kulturEnvanteriId = claims.P11729[0].mainsnak.datavalue.value;
            var keUrl = 'https://kulturenvanteri.com/yer/?p=' + kulturEnvanteriId;
            addButton($heading, 'a', 'ke-button', 'KE', {
                href: keUrl,
                target: '_blank',
                title: 'Kültür Envanteri sayfasına git'
            });
        }

        // 2) İsimle KE arama
        if (trLabel) {
            var keSearchUrl = 'https://kulturenvanteri.com/tr/arastir/d/?_ara=' + encodeURIComponent(trLabel);
            addButton($heading, 'a', 'ke-button', 'İsim ara', {
                href: keSearchUrl,
                target: '_blank',
                title: 'Kültür Envanteri\'nde bu isimle ara'
            });
        }

        // 3) Koordinatla KE harita
        if (lat && lon) {
            var coordSearchUrl = 'https://kulturenvanteri.com/harita/#17.93/' + lat + '/' + lon;
            addButton($heading, 'a', 'ke-button', 'Koord. ara', {
                href: coordSearchUrl,
                target: '_blank',
                title: 'Koordinatla Kültür Envanteri haritasında ara'
            });
        }

        // 4) İBB haritası (yeni URL)
        if (lat && lon && claims.P131?.[0]?.mainsnak?.datavalue?.value?.id) {
            var firstP131Qid = claims.P131[0].mainsnak.datavalue.value.id;

            isLocatedInIstanbulRecursive(firstP131Qid).then(function (result) {
                if (result) {
                    var ibbUrl = `https://kulturenvanteri.ibb.gov.tr/portal/apps/webappviewer/index.html?id=62758a0e55e6462e9dbff7d5737e5ed2&marker=${lon},${lat},&level=18`;
                    addButton($heading, 'a', 'ibb-button', 'ibb', {
                        href: ibbUrl,
                        target: '_blank',
                        title: 'İBB Harita\'da görüntüle'
                    });
                }
            });
        }

        // 5) OSM linkleri (ikonlu)
        if (lat && lon) {
            var $osmLink = $('<a>')
                .attr({
                    href: 'https://www.openstreetmap.org/query?lat=' + lat + '&lon=' + lon + '#map=19/' + lat + '/' + lon,
                    target: '_blank',
                    title: 'OpenStreetMap\'te görüntüle'
                })
                .addClass('osm-logo-link');
            var $osmImage = $('<img>')
                .attr({
                    src: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Openstreetmap_logo.svg',
                    alt: 'OpenStreetMap'
                })
                .addClass('osm-logo-img');
            $osmLink.append($osmImage);
            $heading.append($osmLink);
        }

        // 6) Google Maps linki (ikonlu)
        if (lat && lon) {
            var $gmapsLink = $('<a>')
                .attr({
                    href: 'https://www.google.com/maps/place/' + lat + ',' + lon,
                    target: '_blank',
                    title: 'Google Maps\'te görüntüle'
                })
                .addClass('gmaps-logo-link');
            var $gmapsImage = $('<img>')
                .attr({
                    src: 'https://upload.wikimedia.org/wikipedia/commons/3/39/Google_Maps_icon_%282015-2020%29.svg',
                    alt: 'Google Maps'
                })
                .addClass('gmaps-logo-img');
            $gmapsLink.append($gmapsImage);
            $heading.append($gmapsLink);
        }

        // 6.6) Yandex Street View linki (ikonlu)
        if (lat && lon) {
            var yandexUrl = `https://yandex.com/maps/11508/istanbul/streetview/?ll=${lon}%2C${lat}&z=16`;

            var $yandexLink = $('<a>')
                .attr({
                    href: yandexUrl,
                    target: '_blank',
                    title: 'Yandex Sokak Görünümünde görüntüle'
                })
                .addClass('yandex-logo-link');

            var $yandexImage = $('<img>')
                .attr({
                    src: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Yandex_Maps_icon.svg',
                    alt: 'Yandex Maps'
                })
                .addClass('yandex-logo-img');

            $yandexLink.append($yandexImage);
            $heading.append($yandexLink);
        }

        // 6.7) WikiShootMe linki (açık mavi düğme)
        if (lat && lon) {
            var wsmUrl = `https://wikishootme.toolforge.org/#lat=${lat}&lng=${lon}&zoom=18&layers=commons,flickr,geo_json,wikidata_image,wikidata_no_image,wikipedia`;
            addButton($heading, 'a', 'wsm-button', 'WSM', {
                href: wsmUrl,
                target: '_blank',
                title: 'WikiShootMe\'de görüntüle'
            });
        }

        // 7) Google Earth linki (ikonlu) - Özel DMS formatlı
        if (lat && lon) {
            function toDMS(deg, isLat) {
                const absolute = Math.abs(deg);
                const degrees = Math.floor(absolute);
                const minutesFloat = (absolute - degrees) * 60;
                const minutes = Math.floor(minutesFloat);
                const seconds = ((minutesFloat - minutes) * 60).toFixed(1);

                const direction = deg >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
                return `${degrees}°${minutes}'${seconds}"${direction}`;
            }

            var latDMS = toDMS(lat, true);
            var lonDMS = toDMS(lon, false);

            var earthUrl = `https://earth.google.com/web/search/${encodeURIComponent(latDMS + ' ' + lonDMS)}/@${lat},${lon},6.80583112a,618.81896101d,35y,0h,0t,0r/data=CmsaNRIvGWq8dJMYhERAIRid4ifE8jxAKhs0McKwMDEnNTUuMiJOIDI4wrA1Nic1My45IkUYAiABIiYKJAlxGxW2W4REQBFJw1t9_INEQBkKtuu0YfM8QCG7zvj5ofE8QCoGCAESABgBQgIIAToDCgEwQgIIAEoNCP___________wEQAA`;

            var $googleEarthLink = $('<a>')
                .attr({
                    href: earthUrl,
                    target: '_blank',
                    title: 'Google Earth\'te görüntüle'
                })
                .addClass('google-earth-logo-link');

            var $googleEarthImage = $('<img>')
                .attr({
                    src: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Google_Earth_icon.svg',
                    alt: 'Google Earth'
                })
                .addClass('google-earth-logo-img');

            $googleEarthLink.append($googleEarthImage);
            $heading.append($googleEarthLink);
        }


        // 9) OSM node/way/relation
        if (osmPointId) {
            addButton($heading, 'a', 'osm-button', 'node', {
                href: 'https://www.openstreetmap.org/node/' + osmPointId,
                target: '_blank',
                title: 'OSM Node'
            });
        }
        if (osmWayId) {
            addButton($heading, 'a', 'osm-button', 'way', {
                href: 'https://www.openstreetmap.org/way/' + osmWayId,
                target: '_blank',
                title: 'OSM Way'
            });
        }
        if (osmRelationId) {
            addButton($heading, 'a', 'osm-button', 'relation', {
                href: 'https://www.openstreetmap.org/relation/' + osmRelationId,
                target: '_blank',
                title: 'OSM Relation'
            });
        }

        // 10) WLM butonu
        var qidNumberOnly = entityId.replace(/^Q/, '');
        var wlmUrl = 'https://maps.wikilovesmonuments.org/object/' + qidNumberOnly;
        addButton($heading, 'a', 'commons-button', 'WLM', {
            href: wlmUrl,
            target: '_blank',
            title: 'Viki Anıtları Seviyor'
        });

        // 11) Google Search
        if (trLabel) {
            var googleSearchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(trLabel);
            var $googleSearchLink = $('<a>')
                .attr({
                    href: googleSearchUrl,
                    target: '_blank',
                    title: 'Google\'da Ara'
                })
                .addClass('gsearch-logo-link');
            var $googleSearchImage = $('<img>')
                .attr({
                    src: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
                    alt: 'Google Search'
                })
                .addClass('gsearch-logo-img');
            $googleSearchLink.append($googleSearchImage);
            $heading.append($googleSearchLink);
        }
    });

    // 12) Wikidata'da Q kopyalama
    if ($("#t-wikibase").length === 1) {
        var splitHref = $("#t-wikibase a").attr("href").split("/");
        var qnum = splitHref[splitHref.length - 1];

        var wikidataButton =
            `<span class="button-container">
                <a href="https://www.wikidata.org/wiki/${qnum}" target="_blank" class="wikidata-button">${qnum}</a>
                <button class="copy-button" data-copy="${qnum}">Kopyala</button>
            </span>`;

        $heading.append(wikidataButton);

        $(document).on("click", ".copy-button", function () {
            var textToCopy = $(this).data("copy");
            navigator.clipboard.writeText(textToCopy).then(() => {
                $(this).css({
                    "background-color": "#e0e0e0",
                    "border-color": "#d6d6d6",
                    "color": "#202122"
                }).text("Kopyalandı");
            }).catch(function (err) {
                console.error("Kopyalama hatası:", err);
            });
        });
    }
});

// CSS stilleri (aynen seninkilerin üstüne ibb ekledim)
$("<style>")
.prop("type", "text/css")
.html(`
.button-container, .wikidata-button, .copy-button, .ke-button, .osm-button, .commons-button, .ibb-button, .commons-helper-button {
    display: inline-block;
    vertical-align: middle;
    font-family: Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    padding: 4px 8px;
    margin-left: 8px;
    border-radius: 4px;
    text-decoration: none;
    cursor: pointer;
}

.wikidata-button {
    background-color: #f8f9fa;
    font-size: 14px;
    color: black;
    margin-left: -15px;
}

.ke-button {
    background-color: #897e63;
    color: white !important;
}

.osm-button {
    background-color: #7cbd43;
    color: white !important;
}

.ibb-button {
    background-color: #0a75ad;
    color: white !important;
}

.p373-button {
    background-color: #036;
    color: white !important;
}

.iw-button {
    background-color: #690;
    color: white !important;
}

.infobox-button {
    background-color: #5cb85c;
    color: white !important;
}

.duplicity-button {
    background-color: #f39c12;
    color: white !important;
}

.osm-logo-link, .gmaps-logo-link, .google-earth-logo-link, .yandex-logo-link, .gsearch-logo-link {
    display: inline-block;
    margin-left: 8px;
    vertical-align: middle;
}

.osm-logo-img, .gmaps-logo-img, .google-earth-logo-img, .yandex-logo-img, .gsearch-logo-img {
    width: 18px;
    height: 18px;
    vertical-align: middle;
}

.commons-button {
    background-color: #075192;
    color: white !important;
}

.copy-button {
    background-color: transparent;
    border: 1px solid #d6d6d6;
    color: #202122;
}

.wsm-button {
    background-color: #66ccff;
    color: white !important;
    display: inline-block;
    vertical-align: middle;
    font-family: Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    padding: 4px 8px;
    margin-left: 8px;
    border-radius: 4px;
    text-decoration: none;
    cursor: pointer;
}


.button-container a:hover,
.button-container button:hover {
    text-decoration: none;
}
`)
.appendTo("head");


// P527 (şun(lar)dan oluşur) özelliğindeki QID'lere otomatik olarak P361 (parçası) ekler
// User:Sadrettin/common.js için - Güncellenmiş versiyon

$(document).ready(function() {
    console.log('P527 Auto-Add script başlatıldı');

    // Sadece Wikidata item sayfalarında çalış
    if (mw.config.get('wgNamespaceNumber') === 0 && mw.config.get('wgPageName').startsWith('Q')) {

        function addP527Button() {
            console.log('P527 buton ekleme fonksiyonu çalışıyor');

            var $p527Group = null;

            // Öncelikle data-property-id ile P527'yi ara
            $p527Group = $('.wikibase-statementgroupview[data-property-id="P527"]').first();

            if ($p527Group.length > 0) {
                console.log('P527 grubu bulundu (data-property-id ile)');
            } else {
                // Eğer data-property-id bulunamazsa, tüm statement gruplarını kontrol et
                console.log('data-property-id ile P527 bulunamadı, manuel kontrol yapılıyor');

                $('.wikibase-statementgroupview').each(function() {
                    var $this = $(this);

                    // P527'ye özel kontroller - çok spesifik olmalı
                    var hasP527Property = false;

                    // 1. Property header'ında P527 linki var mı?
                    var $propertyHeader = $this.find('.wikibase-statementgroupview-property .wikibase-statementgroupview-property-label a');
                    if ($propertyHeader.length > 0) {
                        var propertyHref = $propertyHeader.attr('href') || '';
                        if (propertyHref.includes('P527') || propertyHref.endsWith('P527')) {
                            hasP527Property = true;
                        }
                    }

                    // 2. Property ID'si direkt P527 mi?
                    var dataPropertyId = $this.attr('data-property-id');
                    if (dataPropertyId === 'P527') {
                        hasP527Property = true;
                    }

                    // 3. Property label'da "şun(lar)dan oluşur" veya "has part(s)" var mı?
                    var $propertyLabel = $this.find('.wikibase-statementgroupview-property-label');
                    if ($propertyLabel.length > 0) {
                        var labelText = $propertyLabel.text().trim().toLowerCase();
                        // Sadece tam eşleşme - diğer property'lerde yanlışlıkla bu kelimeler geçmesin
                        if (labelText === 'şun(lar)dan oluşur' || labelText === 'has part' || labelText === 'has parts') {
                            hasP527Property = true;
                        }
                    }

                    if (hasP527Property) {
                        $p527Group = $this;
                        console.log('P527 grubu bulundu (manuel kontrol ile)');
                        return false; // break
                    }
                });
            }

            if (!$p527Group || $p527Group.length === 0) {
                console.log('P527 özelliği bulunamadı');
                return;
            }

            // Çift kontrol - bu gerçekten P527 mi?
            var isReallyP527 = false;

            // data-property-id kontrolü
            if ($p527Group.attr('data-property-id') === 'P527') {
                isReallyP527 = true;
            }

            // Property link kontrolü
            var $propertyLink = $p527Group.find('.wikibase-statementgroupview-property-label a');
            if ($propertyLink.length > 0) {
                var href = $propertyLink.attr('href') || '';
                if (href.includes('P527') || href.endsWith('P527')) {
                    isReallyP527 = true;
                }
            }

            if (!isReallyP527) {
                console.log('Bu grup P527 değil, buton eklenmeyecek');
                return;
            }

            console.log('P527 grubu doğrulandı, buton kontrol ediliyor');

            // Eğer buton zaten eklenmişse atla
            if ($p527Group.find('.p527-auto-button').length > 0) {
                console.log('Buton zaten mevcut');
                return;
            }

            console.log('Buton oluşturuluyor');

            // Buton oluştur
            var $button = $('<button>')
                .addClass('p527-auto-button')
                .text('Bu Qid\'yi ögelere ekle')
                .css({
                    'margin': '10px 5px',
                    'padding': '8px 16px',
                    'background-color': '#0645ad',
                    'color': 'white',
                    'border': '1px solid #0645ad',
                    'border-radius': '3px',
                    'cursor': 'pointer',
                    'font-size': '13px',
                    'font-weight': 'normal',
                    'display': 'inline-block'
                })
                .hover(
                    function() { $(this).css('background-color', '#0a5a9c'); },
                    function() { $(this).css('background-color', '#0645ad'); }
                );

            // Click event
            $button.click(function() {
                console.log('Buton tıklandı');
                processP527Values($p527Group, $button);
            });

            // Butonu farklı yerlere eklemeyi dene
            var buttonAdded = false;

            // 1. Property label'ın yanına
            var $propertyContainer = $p527Group.find('.wikibase-statementgroupview-property');
            if ($propertyContainer.length > 0) {
                $propertyContainer.append($('<div>').css('margin-top', '5px').append($button));
                buttonAdded = true;
                console.log('Buton property container\'a eklendi');
            }

            // 2. Eğer yukarısı çalışmadıysa, statement grup başlığının altına
            if (!buttonAdded) {
                var $listView = $p527Group.find('.wikibase-statementlistview');
                if ($listView.length > 0) {
                    $listView.before($('<div>').css({'margin': '10px 0', 'text-align': 'left'}).append($button));
                    buttonAdded = true;
                    console.log('Buton listview\'in üstüne eklendi');
                }
            }

            // 3. Son çare olarak grubun başına ekle
            if (!buttonAdded) {
                $p527Group.prepend($('<div>').css({'margin': '10px 0', 'text-align': 'left', 'background': '#f8f9fa', 'padding': '5px'}).append($button));
                console.log('Buton grubun başına eklendi');
            }

            console.log('Buton ekleme işlemi tamamlandı');
        }

        async function processP527Values($group, $button) {
            console.log('P527 değerleri işleniyor');

            // Butonu devre dışı bırak
            $button.prop('disabled', true)
                   .text('İşleniyor...')
                   .css('background-color', '#ccc');

            try {
                // Mevcut QID'yi al
                var currentQid = mw.config.get('wgPageName');
                console.log('Mevcut QID:', currentQid);

                // P527 değerlerindeki QID'leri topla - farklı yöntemlerle
                var qids = [];

                // Yöntem 1: .wikibase-entityid-value
                $group.find('.wikibase-entityid-value').each(function() {
                    var qid = $(this).text().trim();
                    if (qid.startsWith('Q')) {
                        qids.push(qid);
                    }
                });

                // Yöntem 2: a[title] içinde QID olan linkler
                if (qids.length === 0) {
                    $group.find('a[title]').each(function() {
                        var title = $(this).attr('title');
                        if (title && title.startsWith('Q') && /^Q\d+$/.test(title)) {
                            qids.push(title);
                        }
                    });
                }

                // Yöntem 3: href'te QID olan linkler
                if (qids.length === 0) {
                    $group.find('a[href]').each(function() {
                        var href = $(this).attr('href');
                        var match = href.match(/\/Q(\d+)$/);
                        if (match) {
                            qids.push('Q' + match[1]);
                        }
                    });
                }

                console.log('Bulunan QID\'ler:', qids);

                if (qids.length === 0) {
                    throw new Error('P527\'de QID bulunamadı');
                }

                var successCount = 0;
                var errorCount = 0;
                var existingCount = 0;

                // Her QID için işlem yap
                for (var i = 0; i < qids.length; i++) {
                    var targetQid = qids[i];
                    $button.text(`İşleniyor... (${i+1}/${qids.length})`);

                    try {
                        var result = await addP361Claim(targetQid, currentQid);
                        if (result.success) {
                            if (result.existing) {
                                existingCount++;
                                console.log('✓ ' + targetQid + ' - zaten mevcut');
                            } else {
                                successCount++;
                                console.log('✓ ' + targetQid + ' - eklendi');
                            }
                        } else {
                            errorCount++;
                            console.log('✗ ' + targetQid + ' - hata: ' + result.error);
                        }
                    } catch (error) {
                        errorCount++;
                        console.log('✗ ' + targetQid + ' - hata: ' + error.message);
                    }

                    // Rate limiting
                    if (i < qids.length - 1) {
                        await sleep(1500);
                    }
                }

                // Sonuç göster
                var resultText = `Tamamlandı: ${successCount} eklendi`;
                if (existingCount > 0) resultText += `, ${existingCount} zaten vardı`;
                if (errorCount > 0) resultText += `, ${errorCount} hata`;

                $button.text(resultText)
                       .css('background-color', successCount > 0 ? '#00af89' : '#d33');

            } catch (error) {
                console.error('Genel hata:', error);
                $button.text('Hata oluştu: ' + error.message)
                       .css('background-color', '#d33');
            }

            // 4 saniye sonra butonu sıfırla
            setTimeout(function() {
                $button.prop('disabled', false)
                       .text('Bu Qid\'yi ögelere ekle')
                       .css('background-color', '#0645ad');
            }, 4000);
        }

        function addP361Claim(targetQid, currentQid) {
            return new Promise(function(resolve, reject) {
                // Önce mevcut P361 değerlerini kontrol et
                new mw.Api().get({
                    action: 'wbgetclaims',
                    entity: targetQid,
                    property: 'P361',
                    format: 'json'
                }).done(function(data) {
                    // Mevcut P361 değerlerini kontrol et
                    if (data.claims && data.claims.P361) {
                        var existingValues = data.claims.P361.map(function(claim) {
                            if (claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.value) {
                                return claim.mainsnak.datavalue.value.id;
                            }
                            return null;
                        }).filter(Boolean);

                        if (existingValues.indexOf(currentQid) !== -1) {
                            resolve({ success: true, existing: true });
                            return;
                        }
                    }

                    // P361 claim'i ekle
                    new mw.Api().postWithToken('csrf', {
                        action: 'wbcreateclaim',
                        entity: targetQid,
                        property: 'P361',
                        snaktype: 'value',
                        value: JSON.stringify({
                            'entity-type': 'item',
                            'id': currentQid
                        }),
                        format: 'json'
                    }).done(function(result) {
                        if (result.success) {
                            resolve({ success: true, existing: false });
                        } else {
                            resolve({ success: false, error: result.error || 'Bilinmeyen hata' });
                        }
                    }).fail(function(error) {
                        resolve({ success: false, error: error });
                    });

                }).fail(function(error) {
                    resolve({ success: false, error: error });
                });
            });
        }

        function sleep(ms) {
            return new Promise(function(resolve) {
                setTimeout(resolve, ms);
            });
        }

        // Çoklu tetikleme sistemi
        function initWithDelay() {
            setTimeout(function() {
                console.log('P527 buton ekleme tetikleniyor');
                addP527Button();
            }, 2000);
        }

        // İlk yükleme - birden fazla kez dene
        setTimeout(initWithDelay, 1000);
        setTimeout(initWithDelay, 3000);
        setTimeout(initWithDelay, 5000);

        // Wikidata hooks
        if (mw.hook) {
            mw.hook('wikipage.content').add(function() {
                console.log('wikipage.content hook tetiklendi');
                initWithDelay();
            });

            mw.hook('wikibase.entityPage.entityLoaded').add(function() {
                console.log('wikibase.entityPage.entityLoaded hook tetiklendi');
                initWithDelay();
            });
        }

        // DOM değişiklik observer'ı
        var observer = new MutationObserver(function(mutations) {
            var shouldCheck = false;
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        var node = mutation.addedNodes[i];
                        if (node.nodeType === 1) {
                            var className = node.className || '';
                            if (className.includes('wikibase-statementgroupview') ||
                                className.includes('wikibase-statementlistview') ||
                                (node.querySelector && node.querySelector('.wikibase-statementgroupview'))) {
                                shouldCheck = true;
                                break;
                            }
                        }
                    }
                }
            });
            if (shouldCheck) {
                console.log('DOM değişikliği tespit edildi');
                setTimeout(addP527Button, 1000);
            }
        });

        setTimeout(function() {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            console.log('DOM observer başlatıldı');
        }, 1000);

        // Konsolda debug için
        window.debugP527 = addP527Button;
        console.log('Debug için: window.debugP527() komutunu kullanabilirsiniz');
    }
});

/* User:Sadrettin/common.js */
mw.loader.using(['mediawiki.api', 'mediawiki.ForeignApi'], function () {
    if (mw.config.get('wgNamespaceNumber') !== 0) return;

    var qid = mw.config.get('wbEntityId');
    if (!qid) return;

    // İstersen butonun her zaman görünmesi için bu iki satırı kaldırabilirsin
var hasCommonsLink = document.querySelector('#sitelinks a[href^="https://commons.wikimedia.org/wiki/Category:"]');
var hasP373 = document.querySelector('.wikibase-statementgroup[data-property-id="P373"]');

if (hasCommonsLink && hasP373) return;


    var idSpan = document.querySelector('#firstHeading .wikibase-title-id');
    if (!idSpan) return;

    var btn = document.createElement('button');
    btn.textContent = 'Commons kategori oluştur';
    btn.className = 'commons-button';
    btn.style.marginLeft = '0.5em';
    idSpan.appendChild(btn);

    btn.addEventListener('click', function () {
        btn.disabled = true;
        btn.textContent = 'İşleniyor…';

        var api = new mw.Api();
        var commonsApi = new mw.ForeignApi('https://commons.wikimedia.org/w/api.php', { anonymous: false });

        // 1) EN/TR etiketten otomatik ad çek
        api.get({
            action: 'wbgetentities',
            ids: qid,
            props: 'labels',
            languages: 'en|tr'
        })
        .then(function (data) {
            var labels = data.entities[qid].labels || {};
            var autoName = (labels.en && labels.en.value) || (labels.tr && labels.tr.value) || qid;

            // 2) Kullanıcıya düzenleme imkânı ver (önceden doldurulmuş)
            var userInput = window.prompt('Commons kategori adı:', autoName);
            if (userInput === null) { // İptal
                throw { info: 'Kullanıcı iptal etti' };
            }

            // 3) Temizlik: "Category:" öneki yazıldıysa kaldır, kırp
            var categoryName = (userInput || autoName).trim()
                .replace(/^Category\s*:\s*/i, '');

            if (!categoryName) categoryName = autoName;

            // 4) Commons'ta kategori oluştur (varsa hatayı yakalayıp devam edeceğiz)
            return commonsApi.postWithToken('csrf', {
                action: 'edit',
                title: 'Category:' + categoryName,
                text: '{{Wikidata Infobox}}\n',
                summary: 'Created via user script from ' + qid,
                createonly: 1
            }).catch(function (err) {
                // Zaten varsa devam et (articleexists vb.)
                var code = err && (err.error && err.error.code);
                if (code === 'articleexists' || code === 'editconflict' || code === 'pagedeleted') {
                    console.warn('Kategori zaten var veya oluşturulamadı, devam ediliyor:', code);
                    return; // devam
                }
                throw err; // başka hata ise yukarı fırlat
            }).then(function () {
                // 5) Sitelink ekle
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
        })
        .then(function (ctx) {
            // 6) P373 ekle / güncelle
            var categoryName = ctx.categoryName;

            return api.postWithToken('csrf', {
                action: 'wbcreateclaim',
                entity: qid,
                property: 'P373',
                snaktype: 'value',
                value: JSON.stringify(categoryName), // string değer: JSON-string
                summary: 'Set Commons category'
            }).catch(function (err) {
                // Zaten P373 varsa ilk beyanı güncelle
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
        })
        .then(function () {
            btn.textContent = 'Tamamlandı';
            setTimeout(function () { location.reload(); }, 800);
        })
        .catch(function (err) {
            btn.textContent = 'Hata: ' + (err && (err.info || err.error && err.error.info) || err);
            console.error(err);
            btn.disabled = false;
        });
    });
});




















// Commons'ta kategorideki dosyalara P180 değeri ekleyen script
// Kullanım: Kategori sayfasında bu scripti çalıştırın

(function() {
    'use strict';

    // Commons sitesinde kategori sayfasında olup olmadığımızı kontrol et
    if (mw.config.get('wgServerName') !== 'commons.wikimedia.org' ||
        mw.config.get('wgNamespaceNumber') !== 14) {
        return; // Sessizce çık
    }

    // Ana fonksiyon
    async function addP180ToFiles() {
        try {
            // Kategori adını al
            const categoryName = mw.config.get('wgPageName').replace('Category:', '');
            console.log('Kategori:', categoryName);

            // Q-ID'nin label'ini al (önce Türkçe, sonra İngilizce)
    async function getQIDLabel(qid) {
        try {
            const response = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels&languages=tr|en&format=json&origin=*`);
            const data = await response.json();

            if (data.entities && data.entities[qid] && data.entities[qid].labels) {
                const labels = data.entities[qid].labels;

                // Önce Türkçe label'i kontrol et
                if (labels.tr && labels.tr.value) {
                    return labels.tr.value;
                }

                // Türkçe yoksa İngilizce'yi al
                if (labels.en && labels.en.value) {
                    return labels.en.value;
                }
            }

            return null;
        } catch (error) {
            console.error('Label alınırken hata:', error);
            return null;
        }
    }

    // Kategorinin Wikidata Q-ID'sini al
            const qid = await getCategoryQID(categoryName);
            if (!qid) {
                showCustomAlert('Bu kategori için Wikidata Q-ID bulunamadı!', 'warning');
                return;
            }

            console.log('Bulunan Q-ID:', qid);

            // Q-ID'nin label'ini al
            const qidLabel = await getQIDLabel(qid);
            const qidDisplay = qidLabel ?
                `<a href="https://www.wikidata.org/wiki/${qid}" target="_blank" style="color: #0645ad; text-decoration: underline;">${qid}</a> (<strong>${qidLabel}</strong>)` :
                `<a href="https://www.wikidata.org/wiki/${qid}" target="_blank" style="color: #0645ad; text-decoration: underline;">${qid}</a>`;

            // Kategorideki dosyaları al
            const files = await getCategoryFiles(categoryName);
            console.log('Bulunan dosya sayısı:', files.length);

            if (files.length === 0) {
                showCustomAlert('Bu kategoride dosya bulunamadı!', 'warning');
                return;
            }

            // Kullanıcıdan onay al
            const confirmed = await showConfirmDialog(
                `${files.length} dosyaya <a href="https://www.wikidata.org/wiki/Property:P180" target="_blank" style="color: #0645ad; text-decoration: underline;">P180</a>=${qidDisplay} değeri eklenecek. Devam etmek istiyor musunuz?`
            );
            if (!confirmed) return;

            // Her dosya için P180 değerini ekle
            let successCount = 0;
            let skipCount = 0;
            let errorCount = 0;

            // İlerleme göstergesi oluştur
            const progressDiv = createProgressIndicator(files.length);

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`İşleniyor (${i+1}/${files.length}): ${file.title}`);

                // İlerleme göstergesini güncelle
                updateProgress(progressDiv, i + 1, files.length, file.title);

                try {
                    const result = await addP180ToFile(file.title, qid);
                    if (result.success) {
                        successCount++;
                        console.log(`✓ ${file.title} - başarılı`);
                    } else if (result.skipped) {
                        skipCount++;
                        console.log(`- ${file.title} - zaten var, atlandı`);
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`✗ ${file.title} - hata:`, error);
                }

                // Rate limiting için kısa bekleme
                await sleep(500);
            }

            // İlerleme göstergesini kaldır
            progressDiv.remove();

            showCustomAlert(
                `İşlem tamamlandı!\nBaşarılı: ${successCount}\nAtlandı: ${skipCount}\nHata: ${errorCount}\nToplam: ${files.length}`,
                'success'
            );

        } catch (error) {
            console.error('Hata:', error);
            showCustomAlert('Bir hata oluştu: ' + error.message, 'error');
        }
    }

    // Kategorinin Wikidata Q-ID'sini al
    async function getCategoryQID(categoryName) {
        const api = new mw.Api();

        try {
            // Önce kategori sayfasının kendisinde wikibase_item var mı kontrol et
            const pageProps = await api.get({
                action: 'query',
                format: 'json',
                prop: 'pageprops',
                titles: `Category:${categoryName}`,
                ppprop: 'wikibase_item'
            });

            const pages = pageProps.query.pages;
            const page = pages[Object.keys(pages)[0]];

            if (page.pageprops && page.pageprops.wikibase_item) {
                return page.pageprops.wikibase_item;
            }

            // Eğer direkt bağlantı yoksa, kategori adından arama yap
            const search = await api.get({
                action: 'wbsearchentities',
                format: 'json',
                search: categoryName,
                language: 'tr',
                type: 'item',
                limit: 5
            });

            if (search.search && search.search.length > 0) {
                // İlk sonucu al (daha gelişmiş filtreleme eklenebilir)
                return search.search[0].id;
            }

            return null;
        } catch (error) {
            console.error('Q-ID alınırken hata:', error);
            return null;
        }
    }

    // Kategorideki dosyaları al
    async function getCategoryFiles(categoryName) {
        const api = new mw.Api();
        let allFiles = [];
        let cmcontinue = '';

        do {
            const params = {
                action: 'query',
                format: 'json',
                list: 'categorymembers',
                cmtitle: `Category:${categoryName}`,
                cmnamespace: 6, // File namespace
                cmlimit: 50
            };

            if (cmcontinue) {
                params.cmcontinue = cmcontinue;
            }

            const response = await api.get(params);
            allFiles = allFiles.concat(response.query.categorymembers);
            cmcontinue = response.continue ? response.continue.cmcontinue : null;

        } while (cmcontinue);

        return allFiles;
    }

    // Dosyaya P180 değerini ekle
    async function addP180ToFile(fileName, qid) {
        const api = new mw.Api();

        try {
            // Önce dosyanın mevcut structured data'sını al
            const entityData = await api.get({
                action: 'wbgetentities',
                format: 'json',
                titles: fileName,
                sites: 'commonswiki'
            });

            const entities = entityData.entities;
            const entityId = Object.keys(entities)[0];

            if (entityId === '-1') {
                throw new Error('Dosya bulunamadı');
            }

            const entity = entities[entityId];

            // P180 zaten var mı kontrol et
            if (entity.statements && entity.statements.P180) {
                for (const statement of entity.statements.P180) {
                    if (statement.mainsnak.datavalue &&
                        statement.mainsnak.datavalue.value.id === qid) {
                        return { success: false, skipped: true };
                    }
                }
            }

            // P180 claim'ini ekle
            const claim = {
                type: 'statement',
                mainsnak: {
                    snaktype: 'value',
                    property: 'P180',
                    datavalue: {
                        type: 'wikibase-entityid',
                        value: {
                            'entity-type': 'item',
                            id: qid
                        }
                    }
                }
            };

            await api.postWithToken('csrf', {
                action: 'wbcreateclaim',
                format: 'json',
                entity: entityId,
                property: 'P180',
                snaktype: 'value',
                value: JSON.stringify({
                    'entity-type': 'item',
                    id: qid
                })
            });

            return { success: true };

        } catch (error) {
            console.error('P180 eklenirken hata:', error);
            throw error;
        }
    }

    // Yardımcı fonksiyon: Bekleme
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // İlerleme göstergesi oluştur
    function createProgressIndicator(totalFiles) {
        const progressDiv = $('<div>')
            .attr('id', 'p180-progress')
            .css({
                'position': 'fixed',
                'top': '50%',
                'left': '50%',
                'transform': 'translate(-50%, -50%)',
                'background': 'white',
                'border': '2px solid #0645ad',
                'padding': '20px',
                'border-radius': '10px',
                'box-shadow': '0 4px 6px rgba(0,0,0,0.1)',
                'z-index': '10000',
                'min-width': '400px',
                'text-align': 'center',
                'font-family': 'sans-serif'
            });

        const titleDiv = $('<div>')
            .text('P180 Değerleri Ekleniyor...')
            .css({
                'font-size': '16px',
                'font-weight': 'bold',
                'margin-bottom': '15px',
                'color': '#0645ad'
            });

        const progressBarContainer = $('<div>')
            .css({
                'width': '100%',
                'height': '20px',
                'background-color': '#f0f0f0',
                'border-radius': '10px',
                'margin-bottom': '10px',
                'overflow': 'hidden'
            });

        const progressBar = $('<div>')
            .attr('id', 'p180-progress-bar')
            .css({
                'height': '100%',
                'background-color': '#0645ad',
                'width': '0%',
                'transition': 'width 0.3s ease'
            });

        const statusDiv = $('<div>')
            .attr('id', 'p180-status')
            .css({
                'font-size': '14px',
                'color': '#666'
            })
            .text(`0 / ${totalFiles} dosya işlendi`);

        const currentFileDiv = $('<div>')
            .attr('id', 'p180-current-file')
            .css({
                'font-size': '12px',
                'color': '#999',
                'margin-top': '10px',
                'max-width': '360px',
                'overflow': 'hidden',
                'text-overflow': 'ellipsis',
                'white-space': 'nowrap'
            });

        progressBarContainer.append(progressBar);
        progressDiv.append(titleDiv, progressBarContainer, statusDiv, currentFileDiv);
        $('body').append(progressDiv);

        return progressDiv;
    }

    // İlerleme güncelle
    function updateProgress(progressDiv, current, total, currentFile) {
        const percentage = Math.round((current / total) * 100);

        progressDiv.find('#p180-progress-bar').css('width', percentage + '%');
        progressDiv.find('#p180-status').text(`${current} / ${total} dosya işlendi (${percentage}%)`);
        progressDiv.find('#p180-current-file').text(`Şu an işlenen: ${currentFile.replace('File:', '')}`);
    }

    // Özel alert dialog
    function showCustomAlert(message, type = 'info') {
        return new Promise((resolve) => {
            const alertDiv = $('<div>')
                .css({
                    'position': 'fixed',
                    'top': '50%',
                    'left': '50%',
                    'transform': 'translate(-50%, -50%)',
                    'background': 'white',
                    'border': `2px solid ${getTypeColor(type)}`,
                    'padding': '25px',
                    'border-radius': '10px',
                    'box-shadow': '0 4px 6px rgba(0,0,0,0.1)',
                    'z-index': '10001',
                    'min-width': '400px',
                    'max-width': '600px',
                    'text-align': 'center',
                    'font-family': 'sans-serif'
                });

            const titleDiv = $('<div>')
                .text(getTypeTitle(type))
                .css({
                    'font-size': '18px',
                    'font-weight': 'bold',
                    'margin-bottom': '15px',
                    'color': getTypeColor(type)
                });

            const messageDiv = $('<div>')
                .css({
                    'font-size': '14px',
                    'color': '#333',
                    'margin-bottom': '20px',
                    'line-height': '1.4'
                })
                .html(message);

            const okButton = $('<button>')
                .text('Tamam')
                .css({
                    'background-color': getTypeColor(type),
                    'color': 'white',
                    'border': 'none',
                    'padding': '10px 20px',
                    'border-radius': '5px',
                    'cursor': 'pointer',
                    'font-size': '14px'
                })
                .hover(
                    function() { $(this).css('opacity', '0.8'); },
                    function() { $(this).css('opacity', '1'); }
                )
                .click(function() {
                    alertDiv.remove();
                    resolve(true);
                });

            alertDiv.append(titleDiv, messageDiv, okButton);
            $('body').append(alertDiv);

            okButton.focus();
        });
    }

    // Özel confirm dialog
    function showConfirmDialog(message) {
        return new Promise((resolve) => {
            const confirmDiv = $('<div>')
                .css({
                    'position': 'fixed',
                    'top': '50%',
                    'left': '50%',
                    'transform': 'translate(-50%, -50%)',
                    'background': 'white',
                    'border': '2px solid #0645ad',
                    'padding': '25px',
                    'border-radius': '10px',
                    'box-shadow': '0 4px 6px rgba(0,0,0,0.1)',
                    'z-index': '10001',
                    'min-width': '400px',
                    'max-width': '600px',
                    'text-align': 'center',
                    'font-family': 'sans-serif'
                });

            const titleDiv = $('<div>')
                .text('Onay')
                .css({
                    'font-size': '18px',
                    'font-weight': 'bold',
                    'margin-bottom': '15px',
                    'color': '#0645ad'
                });

            const messageDiv = $('<div>')
                .css({
                    'font-size': '14px',
                    'color': '#333',
                    'margin-bottom': '20px',
                    'white-space': 'pre-line',
                    'line-height': '1.4'
                })
                .html(message);

            const buttonContainer = $('<div>')
                .css({
                    'display': 'flex',
                    'gap': '10px',
                    'justify-content': 'center'
                });

            const yesButton = $('<button>')
                .text('Evet')
                .css({
                    'background-color': '#0645ad',
                    'color': 'white',
                    'border': 'none',
                    'padding': '10px 20px',
                    'border-radius': '5px',
                    'cursor': 'pointer',
                    'font-size': '14px'
                })
                .hover(
                    function() { $(this).css('opacity', '0.8'); },
                    function() { $(this).css('opacity', '1'); }
                )
                .click(function() {
                    confirmDiv.remove();
                    resolve(true);
                });

            const noButton = $('<button>')
                .text('Hayır')
                .css({
                    'background-color': '#666',
                    'color': 'white',
                    'border': 'none',
                    'padding': '10px 20px',
                    'border-radius': '5px',
                    'cursor': 'pointer',
                    'font-size': '14px'
                })
                .hover(
                    function() { $(this).css('opacity', '0.8'); },
                    function() { $(this).css('opacity', '1'); }
                )
                .click(function() {
                    confirmDiv.remove();
                    resolve(false);
                });

            buttonContainer.append(yesButton, noButton);
            confirmDiv.append(titleDiv, messageDiv, buttonContainer);
            $('body').append(confirmDiv);

            yesButton.focus();
        });
    }

    // Mesaj türüne göre renk
    function getTypeColor(type) {
        switch(type) {
            case 'success': return '#28a745';
            case 'warning': return '#ffc107';
            case 'error': return '#dc3545';
            default: return '#0645ad';
        }
    }

    // Mesaj türüne göre başlık
    function getTypeTitle(type) {
        switch(type) {
            case 'success': return 'Başarılı';
            case 'warning': return 'Uyarı';
            case 'error': return 'Hata';
            default: return 'Bilgi';
        }
    }

    // UI'ye buton ekle
    function addButton() {
        if ($('#p180-add-button').length > 0) return; // Zaten varsa ekleme

        const button = $('<button>')
            .attr('id', 'p180-add-button')
            .text('P180 Ekle')
            .css({
                'background-color': '#0645ad',
                'color': 'white',
                'border': 'none',
                'padding': '3px 8px',
                'margin': '0',
                'cursor': 'pointer',
                'border-radius': '3px',
                'font-size': '12px'
            })
            .click(addP180ToFiles);

        // Butonu sayfaya ekle (kategori sayfası toolbox'ına)
        if ($('#t-whatlinkshere').length > 0) {
            $('<li>').css('margin', '0').append(button).insertAfter('#t-whatlinkshere');
        } else {
            // Alternatif konum
            $('.mw-normal-catlinks').after(button);
        }
    }

    // Sayfa yüklendiğinde butonu ekle
    $(document).ready(function() {
        if (mw.config.get('wgServerName') === 'commons.wikimedia.org' &&
            mw.config.get('wgNamespaceNumber') === 14) {
            addButton();
        }
    });

})();



mw.loader.load('https://meta.wikimedia.org/w/index.php?title=User:Sadrettin/WLMTurkeyp373checkerandcreator.js&action=raw&ctype=text/javascript');

mw.loader.load('https://commons.wikimedia.org/w/index.php?title=User:Sadrettin/WikidataImageAdder.js&action=raw&ctype=text/javascript');
