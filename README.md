# sadrettin-userscripts

[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Beta-blue)]()

Wikidata, Wikimedia Commons ve Wikipedia üzerinde kullandığım kişisel
userscript'ler. Tek bir monolitik `common.js` yerine her özellik kendi
modülünde — ihtiyaca göre tek tek veya toplu olarak yüklenebilir.

Tüm UI elemanları `shields.io` tarzı **iki-tonlu rozet** olarak
sunulur — `[label | value]`.

## Modüller

| Dosya | Site / Namespace | Ne yapıyor? |
|---|---|---|
| [`core.js`](core.js) | (kütüphane) | Ortak yardımcılar: `getEntityId`, `getHeadingElement`, `addBadge`, `sleep`, `isLocatedInIstanbulRecursive`. Diğer modüller `window.SUS` üzerinden kullanır. |
| [`modules/heading-buttons.js`](modules/heading-buttons.js) | Wikidata item + Wikidata bağlantılı Wikipedia makaleleri | Başlığa harita ve araştırma rozetleri ekler: `[KE\|aç]`, `[KE\|isim]`, `[KE\|koord]`, `[Harita\|İBB / OSM / Maps / Yandex / Earth]`, `[Tool\|WSM / WLM]`, `[OSM\|node / way / rel]`, `[Web\|Google]`, `[Wikidata\|Q12345]`, `[Q-ID\|kopyala]`. İBB rozeti sadece İstanbul'da bulunan öğeler için (P131 zinciri Q534799'a bağlanırsa) çıkar. |
| [`modules/p373-helper.js`](modules/p373-helper.js) | Wikidata item | Commons sitelink varsa ama P373 yoksa `[Wikidata\|+P373]`; P373 varsa ama Commons sitelink yoksa `[Sitelink\|+iw]`. |
| [`modules/p527-to-p361.js`](modules/p527-to-p361.js) | Wikidata item | P527 (şun(lar)dan oluşur) listesindeki her hedef öğeye, geri-yönlü P361 (parçası) ifadesi olarak mevcut item'i ekler. P527 grubunun yanında `[P527→P361\|yansıt]` rozeti. |
| [`modules/commons-category-creator.js`](modules/commons-category-creator.js) | Wikidata item | `[Commons\|+kategori]` rozeti: kategori + sitelink + P373 üçünü tek tıkla. |
| [`modules/commons-infobox.js`](modules/commons-infobox.js) | Commons Category | `{{Wikidata Infobox}}` yoksa `[Commons\|+infobox]`; Wikidata bağlantısı yoksa `[Tool\|Duplicity]`. |
| [`modules/commons-p180-bulk.js`](modules/commons-p180-bulk.js) | Commons Category | Kategorideki tüm dosyalara P180 (depicts) toplu ekler. `[Commons\|+P180 toplu]` rozeti + ilerleme + onay dialog'u. |

## Kurulum

### 1. Stil dosyası

[`styles/common.css`](styles/common.css) içeriğini global olarak yüklemek
için: `meta.wikimedia.org/wiki/User:KullanıcıAdınız/global.css` sayfasına
yapıştır. Tüm wiki'lerde otomatik aktif olur. (Deploy script'i bunu
otomatik yapar.)

### 2. JS giriş dosyası

[`common.js`](common.js) içeriğini bir kez şu sayfaya yapıştır:

> `meta.wikimedia.org/wiki/User:KullanıcıAdınız/common.js`

Sonra herhangi bir wiki'deki kişisel `common.js`'inden:

```js
mw.loader.load('https://meta.wikimedia.org/w/index.php?title=User:KullanıcıAdınız/common.js&action=raw&ctype=text/javascript');
```

Bu dosya `core.js`'i sıralı yükleyip ardından tüm modülleri tetikler.

### 3. Modüller

Modülleri `User:KullanıcıAdınız/<dosya-adı>` sayfalarına yüklemek için
[`scripts/deploy.sh`](scripts/deploy.sh) kullan — bot password ile
otomatik. Detay için [`DEPLOY.md`](DEPLOY.md).

## Geliştirme

```
sadrettin-userscripts/
├── core.js                ← ortak helpers + UI primitives (SUS namespace)
├── common.js              ← User: sayfasına gidecek loader
├── modules/               ← her özellik kendi dosyasında
├── styles/common.css      ← tek CSS dosyası
├── scripts/deploy.sh      ← MediaWiki API ile toplu yükleme
├── legacy/common.js       ← orijinal monolitik versiyon (referans)
├── DEPLOY.md
├── LICENSE
└── README.md
```

### Sıradaki yapılabilecekler

- Heading'deki rozet sayısı artarsa, kategori bazlı dropdown menü
  (`Harita ▾`, `OSM ▾`) hâlinde toplama
- Birim test (Vitest + happy-dom)
- GitHub Action: push'ta otomatik deploy

## Lisans

[MIT](LICENSE)
