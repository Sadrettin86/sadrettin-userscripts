/**
 * Heading Buttons (Wikidata / Wikipedia)
 *
 * Çalıştığı yer: Wikidata item sayfaları + Wikidata bağlantısı olan Wikipedia
 *                makaleleri (wgWikibaseItemId üzerinden tespit).
 *
 * Sayfanın başlığına şu butonları ekler:
 *   - KE (Kültür Envanteri) — P11729 varsa
 *   - İsim ara — Türkçe etiketle KE araması
 *   - Koord. ara — KE haritasında koordinatla arama
 *   - ibb — sadece İstanbul'da bulunan öğeler için (P131 zinciri Q534799'a bağlanırsa)
 *   - OpenStreetMap, Google Maps, Yandex, WikiShootMe (WSM), Google Earth — koordinat varsa
 *   - OSM node / way / relation — P11693 / P10689 / P402 varsa
 *   - WLM — Viki Anıtları Seviyor harita linki
 *   - Google Search — Türkçe etiketle Google araması
 *   - Wikidata Q kopyalama butonu (Wikipedia'da görünür)
 */

(function () {

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

    function addLogoButton($heading, href, iconUrl, alt, title, linkClass, imgClass) {
        var $link = $('<a>')
            .attr({ href: href, target: '_blank', title: title })
            .addClass(linkClass);
        var $img = $('<img>')
            .attr({ src: iconUrl, alt: alt })
            .addClass(imgClass);
        $link.append($img);
        $heading.append($link);
        return $link;
    }

    async function isLocatedInIstanbulRecursive(qid, visited) {
        visited = visited || new Set();
        if (!qid || visited.has(qid)) return false;
        visited.add(qid);
        if (qid === 'Q534799') return true;

        var url = 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' +
            qid + '&props=claims&format=json&origin=*';
        try {
            var data = await $.getJSON(url);
            var claims = data.entities && data.entities[qid] && data.entities[qid].claims && data.entities[qid].claims.P131;
            if (!claims) return false;

            for (var i = 0; i < claims.length; i++) {
                var nextQid = claims[i].mainsnak && claims[i].mainsnak.datavalue && claims[i].mainsnak.datavalue.value && claims[i].mainsnak.datavalue.value.id;
                if (await isLocatedInIstanbulRecursive(nextQid, visited)) return true;
            }
        } catch (err) {
            console.error('İBB zinciri kontrol hatası:', err);
        }
        return false;
    }

    function toDMS(deg, isLat) {
        var absolute = Math.abs(deg);
        var degrees = Math.floor(absolute);
        var minutesFloat = (absolute - degrees) * 60;
        var minutes = Math.floor(minutesFloat);
        var seconds = ((minutesFloat - minutes) * 60).toFixed(1);
        var direction = deg >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
        return degrees + '°' + minutes + '\'' + seconds + '"' + direction;
    }

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

            // KE butonu
            if (hasKE) {
                var kulturEnvanteriId = claims.P11729[0].mainsnak.datavalue.value;
                addButton($heading, 'a', 'ke-button', 'KE', {
                    href: 'https://kulturenvanteri.com/yer/?p=' + kulturEnvanteriId,
                    target: '_blank',
                    title: 'Kültür Envanteri sayfasına git'
                });
            }

            // İsimle KE arama
            if (trLabel) {
                addButton($heading, 'a', 'ke-button', 'İsim ara', {
                    href: 'https://kulturenvanteri.com/tr/arastir/d/?_ara=' + encodeURIComponent(trLabel),
                    target: '_blank',
                    title: 'Kültür Envanteri\'nde bu isimle ara'
                });
            }

            // Koordinatla KE harita
            if (lat && lon) {
                addButton($heading, 'a', 'ke-button', 'Koord. ara', {
                    href: 'https://kulturenvanteri.com/harita/#17.93/' + lat + '/' + lon,
                    target: '_blank',
                    title: 'Koordinatla Kültür Envanteri haritasında ara'
                });
            }

            // İBB haritası - sadece İstanbul'da
            if (lat && lon && claims.P131 && claims.P131[0] && claims.P131[0].mainsnak &&
                claims.P131[0].mainsnak.datavalue && claims.P131[0].mainsnak.datavalue.value &&
                claims.P131[0].mainsnak.datavalue.value.id) {
                var firstP131Qid = claims.P131[0].mainsnak.datavalue.value.id;
                isLocatedInIstanbulRecursive(firstP131Qid).then(function (result) {
                    if (result) {
                        addButton($heading, 'a', 'ibb-button', 'ibb', {
                            href: 'https://kulturenvanteri.ibb.gov.tr/portal/apps/webappviewer/index.html?id=62758a0e55e6462e9dbff7d5737e5ed2&marker=' + lon + ',' + lat + ',&level=18',
                            target: '_blank',
                            title: 'İBB Harita\'da görüntüle'
                        });
                    }
                });
            }

            // OSM logo
            if (lat && lon) {
                addLogoButton(
                    $heading,
                    'https://www.openstreetmap.org/query?lat=' + lat + '&lon=' + lon + '#map=19/' + lat + '/' + lon,
                    'https://upload.wikimedia.org/wikipedia/commons/b/b0/Openstreetmap_logo.svg',
                    'OpenStreetMap',
                    'OpenStreetMap\'te görüntüle',
                    'osm-logo-link',
                    'osm-logo-img'
                );
            }

            // Google Maps logo
            if (lat && lon) {
                addLogoButton(
                    $heading,
                    'https://www.google.com/maps/place/' + lat + ',' + lon,
                    'https://upload.wikimedia.org/wikipedia/commons/3/39/Google_Maps_icon_%282015-2020%29.svg',
                    'Google Maps',
                    'Google Maps\'te görüntüle',
                    'gmaps-logo-link',
                    'gmaps-logo-img'
                );
            }

            // Yandex Street View
            if (lat && lon) {
                addLogoButton(
                    $heading,
                    'https://yandex.com/maps/11508/istanbul/streetview/?ll=' + lon + '%2C' + lat + '&z=16',
                    'https://upload.wikimedia.org/wikipedia/commons/7/72/Yandex_Maps_icon.svg',
                    'Yandex Maps',
                    'Yandex Sokak Görünümünde görüntüle',
                    'yandex-logo-link',
                    'yandex-logo-img'
                );
            }

            // WikiShootMe
            if (lat && lon) {
                addButton($heading, 'a', 'wsm-button', 'WSM', {
                    href: 'https://wikishootme.toolforge.org/#lat=' + lat + '&lng=' + lon + '&zoom=18&layers=commons,flickr,geo_json,wikidata_image,wikidata_no_image,wikipedia',
                    target: '_blank',
                    title: 'WikiShootMe\'de görüntüle'
                });
            }

            // Google Earth (DMS formatlı)
            if (lat && lon) {
                var latDMS = toDMS(lat, true);
                var lonDMS = toDMS(lon, false);
                var earthUrl = 'https://earth.google.com/web/search/' +
                    encodeURIComponent(latDMS + ' ' + lonDMS) +
                    '/@' + lat + ',' + lon + ',6.80583112a,618.81896101d,35y,0h,0t,0r';

                addLogoButton(
                    $heading,
                    earthUrl,
                    'https://upload.wikimedia.org/wikipedia/commons/e/e4/Google_Earth_icon.svg',
                    'Google Earth',
                    'Google Earth\'te görüntüle',
                    'google-earth-logo-link',
                    'google-earth-logo-img'
                );
            }

            // OSM node / way / relation
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

            // WLM butonu
            var qidNumberOnly = entityId.replace(/^Q/, '');
            addButton($heading, 'a', 'commons-button', 'WLM', {
                href: 'https://maps.wikilovesmonuments.org/object/' + qidNumberOnly,
                target: '_blank',
                title: 'Viki Anıtları Seviyor'
            });

            // Google Search
            if (trLabel) {
                addLogoButton(
                    $heading,
                    'https://www.google.com/search?q=' + encodeURIComponent(trLabel),
                    'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
                    'Google Search',
                    'Google\'da Ara',
                    'gsearch-logo-link',
                    'gsearch-logo-img'
                );
            }
        });

        // Wikidata Q kopyalama (Wikipedia tarafında görünür)
        if ($('#t-wikibase').length === 1) {
            var splitHref = $('#t-wikibase a').attr('href').split('/');
            var qnum = splitHref[splitHref.length - 1];

            var wikidataButton =
                '<span class="button-container">' +
                    '<a href="https://www.wikidata.org/wiki/' + qnum + '" target="_blank" class="wikidata-button">' + qnum + '</a>' +
                    '<button class="copy-button" data-copy="' + qnum + '">Kopyala</button>' +
                '</span>';

            $heading.append(wikidataButton);

            $(document).on('click', '.copy-button', function () {
                var textToCopy = $(this).data('copy');
                var $btn = $(this);
                navigator.clipboard.writeText(textToCopy).then(function () {
                    $btn.css({
                        'background-color': '#e0e0e0',
                        'border-color': '#d6d6d6',
                        'color': '#202122'
                    }).text('Kopyalandı');
                }).catch(function (err) {
                    console.error('Kopyalama hatası:', err);
                });
            });
        }
    });

})();
