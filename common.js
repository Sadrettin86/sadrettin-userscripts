/**
 * sadrettin-userscripts — kullanıcı common.js girişi
 *
 * Bu dosya tüm modülleri Wikipedia/meta üzerinden yükler. Modüller
 * meta.wikimedia.org User: sayfalarına yüklenmiştir; oradan tek bir
 * `mw.loader.load()` çağrısıyla her wiki'de erişilebilir hale gelir.
 *
 * NOT: Modüller core.js'in yüklenmiş olmasını bekler. mw.loader.load()
 * paralel yüklediği için core.js'i $.getScript ile sıralı yüklüyoruz.
 *
 * Deploy etmek için:  ./scripts/deploy.sh  (DEPLOY.md dosyasına bakın)
 */

(function () {
    var BASE = 'https://meta.wikimedia.org/w/index.php?title=User:Sadrettin/';
    var SUFFIX = '&action=raw&ctype=text/javascript';

    var modules = [
        'heading-buttons.js',
        'p373-helper.js',
        'p527-to-p361.js',
        'commons-category-creator.js',
        'commons-infobox.js',
        'commons-p180-bulk.js'
    ];

    // Önce core.js, sonra modülleri yükle (sıralı)
    $.getScript(BASE + 'core.js' + SUFFIX).done(function () {
        modules.forEach(function (name) {
            mw.loader.load(BASE + name + SUFFIX);
        });
    }).fail(function () {
        console.error('sadrettin-userscripts: core.js yüklenemedi.');
    });

    // Eski/harici scriptler
    mw.loader.load('https://meta.wikimedia.org/w/index.php?title=User:Sadrettin/WLMTurkeyp373checkerandcreator.js&action=raw&ctype=text/javascript');
    mw.loader.load('https://commons.wikimedia.org/w/index.php?title=User:Sadrettin/WikidataImageAdder.js&action=raw&ctype=text/javascript');
})();
