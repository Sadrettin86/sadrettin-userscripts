# Deploy

Modüller [`meta.wikimedia.org`](https://meta.wikimedia.org) üzerindeki
`User:Sadrettin/<dosya>.js` sayfalarına yüklenir. Her wiki'den (Vikipedi,
Commons, Wikidata) `mw.loader.load()` ile çağrılabilirler.

## İlk kurulum

### 1. Bot Password oluştur

[Special:BotPasswords](https://meta.wikimedia.org/wiki/Special:BotPasswords)
sayfasına git, yeni bir bot password yarat. Asgari yetkiler:

- ✅ **High-volume editing**
- ✅ **Edit existing pages**
- ✅ **Create, edit, and move pages**

Üretilen `<kullanıcı>@<bot-adı>` ve hex-string parolasını sakla.

### 2. Ortam değişkenlerini ayarla

```bash
export MEDIAWIKI_USER='Sadrettin@deploy-bot'
export MEDIAWIKI_PASSWORD='abcdefghij1234567890abcdefghij12'
```

(Kalıcı olması için `~/.zshrc` veya `~/.bashrc`'ye ekleyebilirsin.)

### 3. `jq` yüklü mü?

```bash
brew install jq   # macOS
```

## Kullanım

Repoda değişiklik yaptıktan sonra:

```bash
./scripts/deploy.sh
```

Script şu sayfaları günceller:

| Repo dosyası | Hedef sayfa |
|---|---|
| `core.js` | `User:Sadrettin/core.js` |
| `modules/heading-buttons.js` | `User:Sadrettin/heading-buttons.js` |
| `modules/p373-helper.js` | `User:Sadrettin/p373-helper.js` |
| `modules/p527-to-p361.js` | `User:Sadrettin/p527-to-p361.js` |
| `modules/commons-category-creator.js` | `User:Sadrettin/commons-category-creator.js` |
| `modules/commons-infobox.js` | `User:Sadrettin/commons-infobox.js` |
| `modules/commons-p180-bulk.js` | `User:Sadrettin/commons-p180-bulk.js` |
| `styles/common.css` | `User:Sadrettin/global.css` |

Edit özeti git SHA içerir, böylece her güncelleme repoya geri izlenebilir.

## Wiki tarafında kurulum (tek seferlik)

### JS — herhangi bir wiki'deki kişisel `common.js`'inde:

```js
mw.loader.load('https://meta.wikimedia.org/w/index.php?title=User:Sadrettin/common.js&action=raw&ctype=text/javascript');
```

> Önce bu repo'daki [`common.js`](common.js) içeriğini
> `meta.wikimedia.org/wiki/User:Sadrettin/common.js` sayfasına bir kez
> yapıştır. (Deploy script'i bunu **yapmaz** — ana giriş dosyası elle
> yönetilir, böylece istemeyerek bozulmaz.)

### CSS — global.css

`User:Sadrettin/global.css` deploy ile otomatik güncellenir. Bunu
[meta global.css](https://meta.wikimedia.org/wiki/Special:MyPage/global.css)
olarak kullanmak için:

`meta.wikimedia.org/wiki/User:Sadrettin/global.css` zaten dosyanın kendisi.
Hiçbir şey yapma — global.css MediaWiki tarafından otomatik tüm wiki'lere
yüklenir.

## Sorun giderme

**`Login failed: Failed`** — bot password yanlış veya yetkileri eksik.

**`Login failed: WrongPass`** — kullanıcı adı `User@BotName` formatında olmalı.

**`Bad token`** — cookie kaybı. Script'i tekrar çalıştır.

**Sayfa düzenleme reddediliyor** — bot password'a "Edit existing pages"
yetkisi verilmemiş.
