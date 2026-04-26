/**
 * Sadrettin userscripts — ortak çekirdek (helpers + UI primitives)
 *
 * window.SUS namespace'i altında ortak yardımcıları sunar.
 * Diğer tüm modüllerden ÖNCE yüklenmelidir.
 *
 * API:
 *   SUS.getEntityId()                       → "Q123" / null
 *   SUS.getHeadingElement()                 → jQuery <h1>
 *   SUS.sleep(ms)                           → Promise
 *   SUS.addBadge($container, opts)          → shields.io-tarzı iki-tonlu rozet
 *   SUS.isLocatedInIstanbulRecursive(qid)   → Promise<bool>
 */

(function () {
    var SUS = window.SUS = window.SUS || {};

    SUS.getEntityId = function () {
        var fromWiki = mw.config.get('wgWikibaseItemId');
        if (fromWiki) return fromWiki;
        var fromWD = mw.config.get('wgTitle');
        if (/^Q\d+$/.test(fromWD)) return fromWD;
        return null;
    };

    SUS.getHeadingElement = function () {
        var $heading = $('#firstHeading');
        if (!$heading.length) {
            $heading = $('h1.wikibase-titlepage-heading');
        }
        return $heading;
    };

    SUS.sleep = function (ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    };

    /**
     * Shields.io tarzı iki-tonlu rozet üretir.
     *
     * opts = {
     *   label:     String  — sol etiket (gri arka plan)
     *   value:     String  — sağ değer (renkli arka plan; varyantla belirlenir)
     *   variant:   String  — CSS varyant adı, ".sb-<variant>" sınıfını uygular
     *   href?:     String  — link hedefi; verilmezse <button> üretilir
     *   title?:    String  — tooltip
     *   target?:   String  — link target (default '_blank')
     *   onClick?:  Function — tıklama handler'ı
     * }
     *
     * Dönüş: jQuery elemanı. Dinamik durum güncellemek için
     *   $badge.find('.sb-value').text('...')  ya da
     *   $badge.toggleClass('is-processing is-success is-error')  kullanın.
     */
    function buildBadgeElement(opts) {
        var hasHref = !!opts.href;
        var $badge = $(hasHref ? '<a>' : '<button type="button">')
            .addClass('sb-badge sb-' + opts.variant);

        if (hasHref) {
            $badge.attr('href', opts.href);
            var target = opts.target || '_blank';
            $badge.attr('target', target);
            if (target === '_blank') {
                $badge.attr('rel', 'noopener noreferrer');
            }
        }
        if (opts.title) $badge.attr('title', opts.title);

        $badge.append($('<span class="sb-label">').text(opts.label));
        $badge.append($('<span class="sb-value">').text(opts.value));

        if (opts.onClick) {
            $badge.on('click', function (e) {
                if (!hasHref) e.preventDefault();
                opts.onClick.call(this, e);
            });
        }
        return $badge;
    }

    function escapeAttr(s) { return String(s).replace(/(["\\])/g, '\\$1'); }

    /**
     * Aynı label ile birden fazla rozet eklenince otomatik olarak dropdown
     * grubuna dönüştürür. İlk çağrı normal rozet, ikinci çağrı dropdown'a
     * upgrade eder ve her ikisini menüye taşır.
     *
     * Çağıran tarafa döndürülen jQuery elemanı her zaman rozetin kendisidir
     * (menüye taşındıysa bile aynı DOM node), böylece sonradan
     * `.find('.sb-value').text(...)` ya da state class güncelleme çalışır.
     */
    function resolveBadgeContainer($container) {
        // Başlık (h1) verilirse, başlığın hemen altında bir bar oluştur/bul
        if ($container.is('h1')) {
            var $bar = $container.nextAll('.sus-badge-bar').first();
            if (!$bar.length) {
                $bar = $('<div class="sus-badge-bar">');
                $container.after($bar);
            }
            return $bar;
        }
        return $container;
    }

    SUS.addBadge = function ($container, opts) {
        $container = resolveBadgeContainer($container);
        var $badge = buildBadgeElement(opts);
        var label = opts.label;
        var $existing = $container.children('[data-sb-label="' + escapeAttr(label) + '"]').first();

        if ($existing.length === 0) {
            $badge.attr('data-sb-label', label);
            $container.append($badge);
            return $badge;
        }

        var $wrap;
        if ($existing.hasClass('sb-dropdown-wrap')) {
            $wrap = $existing;
            $wrap.find('.sb-menu').append($badge);
        } else {
            // existing single rozeti dropdown'a yükselt
            var existingVariant = '';
            ($existing.attr('class') || '').split(/\s+/).forEach(function (c) {
                if (c.indexOf('sb-') === 0 && c !== 'sb-badge') existingVariant = c;
            });

            var $trigger = $('<button type="button" class="sb-badge sb-dropdown-trigger">')
                .addClass(existingVariant)
                .attr('title', label + ' menüsü')
                .append($('<span class="sb-label">').text(label))
                .append($('<span class="sb-value sb-caret">').text('▾'));

            var $menu = $('<div class="sb-menu">');
            $wrap = $('<span class="sb-dropdown-wrap">')
                .attr('data-sb-label', label)
                .append($trigger).append($menu);

            $existing.removeAttr('data-sb-label');
            $existing.replaceWith($wrap);
            $menu.append($existing).append($badge);

            $trigger.on('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                $('.sb-dropdown-wrap.is-open').not($wrap).removeClass('is-open');
                $wrap.toggleClass('is-open');
            });
        }
        return $badge;
    };

    // Dış tıklamada açık menüleri kapat (bir kere bağla)
    if (!SUS._dropdownBound) {
        SUS._dropdownBound = true;
        $(document).on('click.sus-dropdown', function () {
            $('.sb-dropdown-wrap.is-open').removeClass('is-open');
        });
    }

    SUS.isLocatedInIstanbulRecursive = async function (qid, visited) {
        visited = visited || new Set();
        if (!qid || visited.has(qid)) return false;
        visited.add(qid);
        if (qid === 'Q534799') return true;

        var url = 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' +
            qid + '&props=claims&format=json&origin=*';
        try {
            var data = await $.getJSON(url);
            var claims = data.entities && data.entities[qid] &&
                data.entities[qid].claims && data.entities[qid].claims.P131;
            if (!claims) return false;
            for (var i = 0; i < claims.length; i++) {
                var snak = claims[i].mainsnak;
                var nextQid = snak && snak.datavalue && snak.datavalue.value && snak.datavalue.value.id;
                if (await SUS.isLocatedInIstanbulRecursive(nextQid, visited)) return true;
            }
        } catch (err) {
            console.error('İBB zinciri kontrol hatası:', err);
        }
        return false;
    };
})();
