# Supabase Auth e-postaları ve Resend kurulumu

Bu dosyadaki HTML dosyaları Supabase Dashboard'daki Auth e-posta şablonlarına kopyalanmak üzere kaynak olarak tutulur. Repoda bulunmaları Supabase ayarlarını otomatik değiştirmez.

## 1. Resend SMTP

Resend'de `fethiyetango.com` alan adı doğrulanmış ve gönderim etkin olmalıdır. Auth e-postaları için ayrı bir API anahtarı oluşturun; mümkünse anahtarı yalnızca bu alan adından gönderim yapacak şekilde kısıtlayın. Anahtarı GitHub'a, kaynak koda veya `NEXT_PUBLIC_*` ortam değişkenine koymayın.

Supabase Dashboard → **Authentication → Emails → SMTP Settings** alanına şu değerleri girin:

| Alan | Değer |
| --- | --- |
| Enable Custom SMTP | Açık |
| SMTP Host | `smtp.resend.com` |
| SMTP Port | `465` |
| SMTP Username | `resend` |
| SMTP Password | Resend API anahtarı |
| Sender email | `no-reply@fethiyetango.com` (veya doğrulanmış alan adınızdaki gerçek gönderici adresi) |
| Sender name | `Fethiye Tango` |

465 portu SSL içindir. 587 kullanılırsa TLS/STARTTLS beklenir. Kaydettikten sonra Supabase'in SMTP testini veya uygulamadan gerçek bir şifre sıfırlama isteğini deneyin.

## 2. Supabase URL ayarları

Dashboard → **Authentication → URL Configuration**:

- Site URL: `https://uye.fethiyetango.com`
- Redirect URL allowlist içinde en az `https://uye.fethiyetango.com/reset-password` bulunsun.
- Yerel geliştirme kullanılıyorsa `http://localhost:3000/reset-password` eklenebilir.

Uygulamanın `app/auth/confirm/route.ts` rotası recovery şablonunda kullanılan `token_hash` değerini doğrular, sonra kullanıcıyı `/reset-password` sayfasına yönlendirir. Bu nedenle recovery şablonundaki bağlantı başka bir URL ile değiştirilirse uygulamanın callback akışını da yeniden test edin.

## 3. Supabase Email Templates

Dashboard → **Authentication → Email Templates** bölümünde her şablonun Subject ve Body alanını aşağıdaki dosyalarla güncelleyin. Subject'ler kısa tutulmuştur:

| Supabase şablonu | Subject | Kaynak dosya |
| --- | --- | --- |
| Confirm signup | `Fethiye Tango e-posta doğrulama` | `emails/supabase/confirmation.html` |
| Invite user | `Fethiye Tango davetiniz` | `emails/supabase/invite.html` |
| Magic link | `Fethiye Tango giriş bağlantınız` | `emails/supabase/magic-link.html` |
| Reset password | `Fethiye Tango şifre sıfırlama` | `emails/supabase/recovery.html` |
| Change email address | `Fethiye Tango e-posta değişikliği` | `emails/supabase/email-change.html` |

Şablonlar Supabase'in Go template değişkenlerini kullanır. Özellikle `{{ .ConfirmationURL }}` ve recovery için `{{ .SiteURL }}` / `{{ .TokenHash }}` ifadelerini olduğu gibi bırakın. Bağlantıdaki token değerlerini statik bir URL ile değiştirmeyin.

## 4. Teslim edilebilirlik ve güvenlik

- Resend üzerinde Open Tracking ve Click Tracking kapalı kalmalı. Link takibi, doğrulama bağlantılarını yeniden yazıp Auth akışını bozabilir.
- SPF, DKIM ve DMARC DNS kayıtlarının Resend tarafında doğru olduğundan emin olun.
- Supabase Auth e-postalarını pazarlama e-postalarından ayrı tutun.
- Testi gerçek bir kullanıcı hesabıyla yapın: davet/confirmation bağlantısı, şifre sıfırlama ve mümkünse e-posta değiştirme. Şifre sıfırlamada bağlantı açıldığında uygulama `/reset-password` sayfasına ulaşmalı ve yeni şifreyi kaydetmelidir.
- Custom SMTP açıldıktan sonra Supabase'in Auth e-posta rate limitlerini kontrol edin. Varsayılan limitler, üretim trafiğiniz için yetersiz kalabilir.
- E-posta güvenlik bildirimi şablonları (ör. parola değişti bildirimi) ayrı bir gruptur; bunlar Email Templates ekranında ayrıca özelleştirilebilir.

## Resmî dokümantasyon

- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend SMTP](https://resend.com/changelog/smtp-service)
