# Ponte

Plataforma de colaboração em ciência cidadã para pessoas com altas habilidades.

## Estrutura
- `public/`: site (página inicial, cadastro, login e painel).
- `api/registrar.js`: função serverless que grava o perfil, o consentimento do responsável e envia o e-mail de boas-vindas.
- `supabase/schema.sql`: tabelas e regras de segurança (RLS).

## Passo a passo

1. **Supabase**: crie um projeto em supabase.com. Em *SQL Editor*, rode `supabase/schema.sql`.
   Em *Authentication > Providers > Email*, deixe e-mail e senha ativos.
   Para o MVP, desative *Confirm email* (o cadastro já grava o perfil pelo servidor). Antes do lançamento, reative e ajuste o fluxo.
2. **Chaves**: em *Project Settings > API*, copie a URL e a chave `anon` (vão em `public/config.js`) e a `service_role` (vai só nas variáveis da Vercel).
3. **GitHub**: crie um repositório e envie esta pasta:
   ```bash
   git init && git add . && git commit -m "primeira versão"
   git branch -M main && git remote add origin https://github.com/SEU-USUARIO/ponte.git
   git push -u origin main
   ```
4. **Vercel**: em *Add New > Project*, importe o repositório. Framework: *Other*. Em *Environment Variables*, preencha as variáveis de `.env.example`. Deploy.
5. **E-mail**: crie uma conta no Resend, verifique um domínio e preencha `RESEND_API_KEY` e `EMAIL_FROM`.
6. **Teste**: cadastre uma pessoa de teste, confira a linha em `perfis` no Supabase e o e-mail recebido.

## Segurança e LGPD
- Senhas: armazenadas pelo Supabase Auth (hash). Nunca no código.
- CPF do responsável: guardado só como HMAC com `CPF_PEPPER`. Não é possível recuperar o número a partir do hash.
- `service_role` nunca vai para o navegador.
- Antes de lançar: termos de uso, política de privacidade, canal para exclusão de dados e revisão jurídica da autorização parental.
