# sadrettin-userscripts

Wikidata, Wikimedia Commons ve Wikipedia üzerinde kullandığım kişisel
userscript'ler. Tek bir monolitik `common.js` yerine, her özellik kendi
modülünde — ihtiyaca göre tek tek veya toplu olarak yüklenebilir.

## Modüller

| Dosya | Site / Namespace | Ne yapıyor? |
|---|---|---|
| [`modules/heading-buttons.js`](modules/heading-buttons.js) | Wikidata item + Wikidata bağlantılı Wikipedia makaleleri | Başlığa harita ve araştırma butonları ekler: KE, İsim ara, Koord. ara, OpenStreetMap, Google Maps, Yandex, WikiShootMe, Google Earth, OSM node/way/relation, WLM, Google Search, Q-ID kopyala. İBB butonu sadece İstanbul'da bulunan öğeler için (P131 zinciri Q534799'a bağlanırsa) çıkar. |
| [`modules/p373-helper.js`](modules/p373-helper.js) | Wikidata item | Commons sitelink varsa ama P373 yoksa "P373 ekle" butonu; P373 varsa ama Commons sitelink yoksa "iw ekle" butonu. |
| [`modules/p527-to-p361.js`](modules/p527-to-p361.js) | Wikidata item | P527 (şun(lar)dan oluşur) listesindeki her hedef öğeye, geri-yönlü P361 (parçası) ifadesi olarak mevcut item'i ekler. |
| [`modules/commons-category-creator.js`](modules/commons-category-creator.js) | Wikidata item | "Commons kategori oluştur" butonu: kategori + sitelink + P373 üçünü tek tıkla. |
| [`modules/commons-infobox.js`](modules/commons-infobox.js) | Commons Category | `{{Wikidata Infobox}}` yoksa ekleme butonu; Wikidata bağlantısı yoksa Duplicity tool butonu. |
| [`modules/commons-p180-bulk.js`](modules/commons-p180-bulk.js) | Commons Category | Kategorideki tüm dosyalara P180 (depicts) toplu ekler. İlerleme göstergesi + onay dialog'u içerir. |

## Kurulum

### Stil dosyası

[`styles/common.css`](styles/common.css) içeriğini kişisel CSS'inize kopyalayın
(her wiki için bir kez). En pratiği global olarak yüklemek:

> `meta.wikimedia.org/wiki/User:KullanıcıAdınız/global.css`

### Modülleri yükleme

İki seçenek var:

**1) Tüm modülleri tek seferde** — `common.js` dosyasını kişisel ortak
JS sayfanıza koyun:

> `meta.wikimedia.org/wiki/User:KullanıcıAdınız/global.js`

İçerik olarak [`common.js`](common.js) dosyasını yapıştırın ve URL'lerdeki
`User:Sadrettin` kısmını kendi kullanıcı adınızla değiştirin.

**2) Tek tek modül** — sadece istediklerinizi alın. Her modülü ilgili
wiki üzerinde bir `User:KullanıcıAdınız/<modul-adı>.js` sayfası olarak
oluşturun ve common.js'inizden `mw.loader.load(...)` ile çağırın.

## Geliştirme notları

- **Orijinal monolitik versiyon:** [`legacy/common.js`](legacy/common.js)
  bir önceki tek-dosya halini referans olarak tutar.
- **Refactor planı:** UI dağınıklığını azaltmak için heading butonlarını
  bir dropdown menüye toplamak; tekrarlanan API helper'ları ortak
  `core.js`'e çıkarmak gibi adımlar açık.

## Lisans

[MIT](LICENSE)
