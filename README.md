# Big Smoke Pods — Marketplace

Marketplace de pods em **Next.js 16** (App Router) — front e back no mesmo projeto, mobile first.

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

## Funcionalidades

- Catálogo com busca por nome/marca/sabor e filtro por marca
- Página de produto com escolha de sabor e quantidade; "adicionar rápido" pelo card
- Carrinho (bottom sheet no mobile / drawer no desktop), salvo no navegador
- Conta do cliente com **e-mail e senha** (cadastro pede nome, e-mail, telefone, Instagram e senha)
- Área do cliente: dados do usuário + pedidos com status e linha do tempo
- Checkout com **mock** de pagamento:
  - **PIX**: QR Code + copia e cola, expira em 15 min, botão "Simular pagamento"
  - **Cartão de crédito**: até 3x sem juros, cartão animado
    - `4242 4242 4242 4242` → aprovado
    - `4000 0000 0000 0002` → recusado
- Botão flutuante de WhatsApp, links para o Instagram, verificação de idade (+18)

## Painel admin — `/admin`

O admin é criado automaticamente no primeiro login, com o e-mail e a senha de `ADMIN_EMAIL` / `ADMIN_PASSWORD`
no `.env.local` (veja `.env.example`). Para trocar a senha depois do primeiro login, apague o admin do banco.

- **Dashboard**: faturamento, pedidos de hoje, pedidos para enviar, PIX pendentes, ticket médio, gráfico dos últimos 7 dias, mais vendidos
- **Pedidos**: busca, filtro por status, detalhe com dados do cliente (WhatsApp/Instagram) e troca de status
- **Produtos**: cadastrar, editar, ocultar/mostrar na loja, excluir, upload de imagem (JPG/PNG/WEBP até 4 MB)
- **Clientes**: lista com contato, nº de pedidos e total gasto

## Entrega — `/admin/entrega`

- O admin cadastra o endereço da loja (CEP preenche a rua) e localiza no mapa; as coordenadas podem ser ajustadas.
- Tabela no modelo Uber Flash: tarifa base + R$/km + R$/min, valor mínimo, taxa adicional da loja, frete grátis acima de X e raio máximo. Botões preenchem os valores públicos de referência da Uber Flash Moto/Carro (confira os atuais no app da Uber).
- No checkout o cliente informa o CEP + número; o frete é calculado pela rota real (OSRM) da loja até o endereço e recalculado no servidor ao criar o pedido.
- Serviços gratuitos usados: ViaCEP, Nominatim (OpenStreetMap) e OSRM. Para produção com volume, troque por Google Maps/Mapbox ou integre o Uber Direct (cotação oficial, exige contrato).

## Deploy na Vercel

A Vercel não permite gravar arquivos, então em produção o app usa Postgres:

1. No projeto da Vercel: **Storage → Create Database → Neon (Postgres)** e conecte ao projeto (cria `DATABASE_URL`).
2. Em **Settings → Environment Variables**, defina `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
3. Faça um novo deploy. As tabelas são criadas sozinhas no primeiro acesso e os produtos iniciais são cadastrados.

Tudo (clientes, pedidos, produtos, configurações de entrega e imagens enviadas no admin) fica no Postgres.
Sem `DATABASE_URL`, o app usa `data/db.json` (desenvolvimento local).

## Estrutura

| Caminho | O que é |
| --- | --- |
| `src/lib/products.ts` | Catálogo inicial (gravado no banco na 1ª execução; depois edite pelo /admin) |
| `src/lib/catalog.ts` | CRUD de produtos |
| `src/lib/auth.ts` / `admin-auth.ts` | Sessões do cliente e do admin (cookies httpOnly, senhas com scrypt) |
| `src/lib/site.ts` | WhatsApp e Instagram da loja |
| `src/lib/db.ts` / `uploads.ts` | Banco: Postgres com `DATABASE_URL`, senão arquivo `data/db.json` |
| `src/lib/orders.ts` | Regras de pedido e mocks de pagamento |
| `src/app/api/*` | Backend (route handlers) |

API: `GET /api/products?q=&brand=`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`,
`POST /api/auth/register`, `GET|POST /api/orders`, `GET /api/orders/:id`, `POST /api/orders/:id/pay` (simula o PIX).
Admin (exige sessão de admin): `/api/admin/stats`, `/api/admin/orders[/:id]`, `/api/admin/products[/:id]`,
`/api/admin/customers`, `/api/admin/uploads`.

## Mocks e próximos passos para produção

- Pagamentos são simulados. Para produção, integre um PSP (Mercado Pago, Pagar.me, Asaas…) e confirme o PIX via webhook.
- O status dos pedidos é controlado pelo admin; PIX não pago em 15 min é cancelado automaticamente.
- Recuperação de senha por e-mail ainda não existe (precisa de um serviço de envio, ex.: Resend).
- Na Vercel use Postgres (`DATABASE_URL`, veja "Deploy na Vercel"). O banco guarda tudo em um documento jsonb, ótimo
  para uma loja pequena; com muito volume, migre para tabelas (Prisma/Drizzle) e imagens para um storage (S3, Vercel Blob).
