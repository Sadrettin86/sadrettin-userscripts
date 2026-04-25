/**
 * sadrettin-userscripts — kullanıcı common.js girişi
 *
 * Bu dosya tüm modülleri Wikipedia üzerinden yükler.
 * Modülleri ilgili User: sayfalarına yüklediyseniz, aşağıdaki
 * URL'leri kendi kullanıcı adınıza göre güncelleyin.
 *
 * Her modül kendi içinde namespace/site kontrolü yaptığı için,
 * yanlış sitede çalışmazlar — hepsini her yerden yüklemek güvenlidir.
 */

(function () {
    var modules = [
        // Heading'e harita/araştırma butonları (KE, OSM, Maps, Earth, Yandex, WSM, Google, WLM, Q-kopyala)
        'https://meta.wikimedia.org/w/index.php?title=User:Sadrettin/heading-buttons.js&action=raw&ctype=text/javascript',

        // P373 (Commons category) ekleme + Commons sitelink ("iw") ekleme butonları (Wikidata)
        'https://meta.wikimedia.org/w/index.php?title=User:Sadrettin/p373-helper.js&action=raw&ctype=text/javascript',

        // P527 (has parts) → P361 (part of) toplu yansıtma butonu (Wikidata)
        'https://meta.wikimedia.org/w/index.php?title=User:Sadrettin/p527-to-p361.js&action=raw&ctype=text/javascript',

        // Commons kategorisini Wikidata'dan tek tıkla oluştur (kategori + sitelink + P373)
        'https://meta.wikimedia.org/w/index.php?title=User:Sadrettin/commons-category-creator.js&action=raw&ctype=text/javascript',

        // Commons kategori sayfasında {{Wikidata Infobox}} / Duplicity buton
        'https://commons.wikimedia.org/w/index.php?title=User:Sadrettin/commons-infobox.js&action=raw&ctype=text/javascript',

        // Commons kategorideki tüm dosyalara P180 (depicts) toplu ekleme
        'https://commons.wikimedia.org/w/index.php?title=User:Sadrettin/commons-p180-bulk.js&action=raw&ctype=text/javascript',

        // Eski/harici scriptler
        'https://meta.wikimedia.org/w/index.php?title=User:Sadrettin/WLMTurkeyp373checkerandcreator.js&action=raw&ctype=text/javascript',
        'https://commons.wikimedia.org/w/index.php?title=User:Sadrettin/WikidataImageAdder.js&action=raw&ctype=text/javascript'
    ];

    modules.forEach(function (url) { mw.loader.load(url); });
})();
