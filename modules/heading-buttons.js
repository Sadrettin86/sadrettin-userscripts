/**
 * Heading Buttons (Wikidata / Wikipedia)
 *
 * Çalıştığı yer: Wikidata item sayfaları + Wikidata bağlantısı olan Wikipedia
 *                makaleleri (wgWikibaseItemId üzerinden tespit).
 *
 * Sayfa başlığına shields.io tarzı iki-tonlu rozetler ekler. Her rozet
 * "label | value" yapısındadır:
 *
 *   [KE | aç]      — Kültür Envanteri sayfası (P11729)
 *   [KE | isim]    — Türkçe etiketle KE araması
 *   [KE | koord]   — KE haritasında koordinatla arama
 *   [Harita | İBB] — sadece İstanbul'da bulunan öğeler için
 *   [Harita | OSM] [Harita | Maps] [Harita | Yandex] [Harita | Earth]
 *   [Tool | WSM]   — WikiShootMe
 *   [OSM | node]   [OSM | way]   [OSM | rel]
 *   [Tool | WLM]   — Viki Anıtları Seviyor
 *   [Web | Google] — Türkçe etiketle Google araması
 *   [Wikidata | Q12345] [Q-ID | kopyala] — sadece Wikipedia'da
 *
 * Bağımlılık: core.js (SUS.getEntityId, SUS.getHeadingElement,
 *                      SUS.addBadge, SUS.isLocatedInIstanbulRecursive)
 */

(function () {

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
        var SUS = window.SUS;
        if (!SUS) {
            console.error('heading-buttons.js: core.js (window.SUS) yüklenmemiş.');
            return;
        }

        var entityId = SUS.getEntityId();
        if (!entityId) return;

        var $heading = SUS.getHeadingElement();
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

            // KE sayfası (P11729)
            if (claims.P11729 && claims.P11729.length > 0) {
                var keId = claims.P11729[0].mainsnak.datavalue.value;
                SUS.addBadge($heading, {
                    label: 'KE', value: 'aç', variant: 'ke',
                    href: 'https://kulturenvanteri.com/yer/?p=' + keId,
                    title: 'Kültür Envanteri sayfasına git'
                });
            }

            // KE — isimle ara
            if (trLabel) {
                SUS.addBadge($heading, {
                    label: 'KE', value: 'isim', variant: 'ke',
                    href: 'https://kulturenvanteri.com/tr/arastir/d/?_ara=' + encodeURIComponent(trLabel),
                    title: 'Kültür Envanteri\'nde bu isimle ara'
                });
            }

            // KE — koordinatla ara
            if (lat && lon) {
                SUS.addBadge($heading, {
                    label: 'KE', value: 'koord', variant: 'ke',
                    href: 'https://kulturenvanteri.com/harita/#17.93/' + lat + '/' + lon,
                    title: 'Koordinatla Kültür Envanteri haritasında ara'
                });
            }

            // İBB haritası — sadece İstanbul'da
            if (lat && lon && claims.P131 && claims.P131[0] &&
                claims.P131[0].mainsnak && claims.P131[0].mainsnak.datavalue &&
                claims.P131[0].mainsnak.datavalue.value &&
                claims.P131[0].mainsnak.datavalue.value.id) {
                var firstP131Qid = claims.P131[0].mainsnak.datavalue.value.id;
                SUS.isLocatedInIstanbulRecursive(firstP131Qid).then(function (result) {
                    if (result) {
                        SUS.addBadge($heading, {
                            label: 'Harita', value: 'İBB', variant: 'ibb',
                            href: 'https://kulturenvanteri.ibb.gov.tr/portal/apps/webappviewer/index.html?id=62758a0e55e6462e9dbff7d5737e5ed2&marker=' + lon + ',' + lat + ',&level=18',
                            title: 'İBB Harita\'da görüntüle'
                        });
                    }
                });
            }

            // Harita rozetleri (koordinat varsa)
            if (lat && lon) {
                SUS.addBadge($heading, {
                    label: 'Harita', value: 'OSM', variant: 'osm-map',
                    href: 'https://www.openstreetmap.org/query?lat=' + lat + '&lon=' + lon + '#map=19/' + lat + '/' + lon,
                    title: 'OpenStreetMap\'te görüntüle'
                });

                SUS.addBadge($heading, {
                    label: 'Harita', value: 'Maps', variant: 'gmaps',
                    href: 'https://www.google.com/maps/place/' + lat + ',' + lon,
                    title: 'Google Maps\'te görüntüle'
                });

                SUS.addBadge($heading, {
                    label: 'Harita', value: 'Yandex', variant: 'yandex',
                    href: 'https://yandex.com/maps/11508/istanbul/streetview/?ll=' + lon + '%2C' + lat + '&z=16',
                    title: 'Yandex Sokak Görünümünde görüntüle'
                });

                var latDMS = toDMS(lat, true);
                var lonDMS = toDMS(lon, false);
                SUS.addBadge($heading, {
                    label: 'Harita', value: 'Earth', variant: 'earth',
                    href: 'https://earth.google.com/web/search/' + encodeURIComponent(latDMS + ' ' + lonDMS) +
                          '/@' + lat + ',' + lon + ',6.80583112a,618.81896101d,35y,0h,0t,0r',
                    title: 'Google Earth\'te görüntüle'
                });

                SUS.addBadge($heading, {
                    label: 'Tool', value: 'WSM', variant: 'wsm',
                    href: 'https://wikishootme.toolforge.org/#lat=' + lat + '&lng=' + lon + '&zoom=18&layers=commons,flickr,geo_json,wikidata_image,wikidata_no_image,wikipedia',
                    title: 'WikiShootMe\'de görüntüle'
                });
            }

            // OSM node / way / relation
            if (osmPointId) {
                SUS.addBadge($heading, {
                    label: 'OSM', value: 'node', variant: 'osm',
                    href: 'https://www.openstreetmap.org/node/' + osmPointId,
                    title: 'OSM Node'
                });
            }
            if (osmWayId) {
                SUS.addBadge($heading, {
                    label: 'OSM', value: 'way', variant: 'osm',
                    href: 'https://www.openstreetmap.org/way/' + osmWayId,
                    title: 'OSM Way'
                });
            }
            if (osmRelationId) {
                SUS.addBadge($heading, {
                    label: 'OSM', value: 'rel', variant: 'osm',
                    href: 'https://www.openstreetmap.org/relation/' + osmRelationId,
                    title: 'OSM Relation'
                });
            }

            // VAS (Viki Anıtları Seviyor)
            SUS.addBadge($heading, {
                label: 'Tool', value: 'VAS', variant: 'wlm',
                href: 'https://vikianitlariseviyor.tr/monuments/' + entityId,
                title: 'Viki Anıtları Seviyor'
            });

            // Google Search
            if (trLabel) {
                SUS.addBadge($heading, {
                    label: 'Web', value: 'Google', variant: 'gsearch',
                    href: 'https://www.google.com/search?q=' + encodeURIComponent(trLabel),
                    title: 'Google\'da Ara'
                });
            }
        });

        // Wikidata Q kopyalama (Wikipedia tarafında görünür)
        if ($('#t-wikibase').length === 1) {
            var splitHref = $('#t-wikibase a').attr('href').split('/');
            var qnum = splitHref[splitHref.length - 1];

            SUS.addBadge($heading, {
                label: 'Wikidata', value: qnum, variant: 'wikidata',
                href: 'https://www.wikidata.org/wiki/' + qnum,
                title: 'Wikidata öğesini aç'
            });

            var $copyBadge = SUS.addBadge($heading, {
                label: 'Q-ID', value: 'kopyala', variant: 'copy',
                title: 'Q-ID\'yi panoya kopyala',
                onClick: function () {
                    var self = this;
                    navigator.clipboard.writeText(qnum).then(function () {
                        $(self).addClass('is-copied').find('.sb-value').text('kopyalandı');
                    }).catch(function (err) {
                        console.error('Kopyalama hatası:', err);
                    });
                }
            });
        }
    });

})();
