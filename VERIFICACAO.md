# Kurio — Verificação Técnica

Documento de conferência. Reúne **tudo** que foi construído e, em especial, o
**passo a passo do deploy** — o que foi publicado, com quais comandos, com qual
configuração e como verificar cada ponto.

Complementa, sem substituir:

- [`README.md`](./README.md) — como rodar, variáveis, credenciais, cenários.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — decisões e justificativas.

- **Produção:** https://kurio-nft-marketplace-chi.vercel.app
- **Projeto Vercel:** `kurio-nft-marketplace`
- **Fonte:** React + TypeScript, tudo em `/src`; backend simulado no navegador (MSW).

---

## 1. Resumo de estado

| Área                                    | Estado                       | Evidência                                          |
| --------------------------------------- | ---------------------------- | -------------------------------------------------- |
| Build de produção                       | ✅                           | `npm run build` (`tsc -b` + `vite build`)          |
| Tipos                                   | ✅                           | `npx tsc -b` sem erros                             |
| Lint                                    | ✅                           | `npx eslint .` sem avisos                          |
| Formatação                              | ✅                           | `npm run format:check` limpo                       |
| Testes unitários                        | ✅ 2 passam                  | `npm run test` (Vitest)                            |
| Testes E2E                              | ✅ 164 passam · 10 pulados   | `npx playwright test` (desktop + mobile; 87 casos) |
| Lighthouse (a11y / boas práticas / SEO) | 100 / 100 / 100              | mediana de 3 execuções por tela/perfil             |
| Lighthouse (performance)                | 98/98 desktop · 78/76 mobile | mediana de 3 execuções por tela/perfil             |
| Deploy                                  | ✅                           | produção na Vercel, deep link + F5 verificados     |

> As 10 execuções puladas são específicas de viewport: quatro testes de foco de
> diálogos, busca/mercado/Entrar desktop no mobile, um teste de tab bar no desktop
> e controles de carrossel específicos de cada viewport. Ver §16.

> A performance mobile fica abaixo da meta de 90 por causa do backend simulado
> no navegador (MSW), obrigatório e no caminho crítico. Justificativa formal em
> §17.

---

## 2. Ambiente

| Item                   | Valor                                        |
| ---------------------- | -------------------------------------------- |
| Node                   | v23.1.0 (o `package.json` exige `>=20.19.0`) |
| npm                    | 11.12.1                                      |
| SO                     | macOS (darwin)                               |
| Gerenciador de pacotes | npm (`package-lock.json` presente)           |

Os valores de Node e npm são as versões usadas nesta verificação; o projeto
declara Node `>=20.19.0` e fixa dependências em `package-lock.json`.

---

## 3. Stack e versões instaladas

Extraído de `npm ls --depth=0` (versões **instaladas**, não as faixas do
`package.json`).

### Runtime

| Pacote                   | Versão   |
| ------------------------ | -------- |
| react / react-dom        | 19.3.0   |
| @tanstack/react-router   | 1.170.44 |
| @tanstack/react-query    | 5.104.2  |
| axios                    | 1.20.0   |
| socket.io-client         | 4.8.4    |
| msw                      | 2.15.0   |
| @mswjs/socket.io-binding | 0.2.0    |
| zod                      | 4.6.7    |
| react-hook-form          | 7.90.0   |
| @hookform/resolvers      | 5.9.1    |
| decimal.js               | 10.6.0   |
| radix-ui                 | 1.8.1    |
| lucide-react             | 1.56.0   |
| sonner                   | 2.0.8    |
| vaul                     | 1.1.2    |
| class-variance-authority | 0.7.1    |
| cn                       | 0.4.0    |
| @fontsource/roboto-mono  | 5.3.0    |

### Build / qualidade

| Pacote                          | Versão |
| ------------------------------- | ------ |
| vite                            | 8.3.4  |
| @vitejs/plugin-react            | 6.1.2  |
| tailwindcss / @tailwindcss/vite | 4.3.3  |
| typescript                      | 5.9.3  |
| eslint                          | 9.39.5 |
| typescript-eslint               | 8.71.2 |
| eslint-plugin-react-hooks       | 7.1.1  |
| eslint-plugin-react-refresh     | 0.5.7  |
| prettier                        | 3.9.10 |
| @playwright/test                | 1.64.0 |
| vitest                          | 5.0.4  |
| @types/node                     | 26.6.5 |
| @types/react / @types/react-dom | 19.3.0 |

> Tailwind é **v4, CSS-first**: os tokens de design vivem em `src/index.css`
> (`@theme`), sem `tailwind.config.js`.

---

## 4. Estrutura de arquivos

```
.
├── index.html                         # shell, meta, ícone e título
├── vite.config.ts                     # Vite/Tailwind, CSS inline, modulepreload do MSW
├── vercel.json                        # rewrite de SPA
├── playwright.config.ts               # projetos desktop e mobile
├── docs/lighthouse/                   # relatórios JSON/HTML e medianas (ver §17)
├── public/
│   ├── art/                           # art-1..4.webp (obras do catálogo)
│   ├── avatars/                       # avatars predefinidos e fixtures
│   ├── favicon.svg / robots.txt
│   └── mockServiceWorker.js           # worker do MSW
├── scripts/                           # utilitários opcionais, fora do build (ver scripts/README.md)
├── src/
│   ├── main.tsx                         # bootstrap: MSW antes de montar o app
│   ├── index.css                      # tokens Tailwind v4, fonte e componentes globais
│   ├── app/                           # providers, query-client e router tipado
│   ├── routes/                        # telas: home, detail, cart, checkout, order,
│   │                                  # login, register, profile, wallets, favorites, 404
│   ├── components/                    # componentes do produto + ui/ (shadcn)
│   ├── features/
│   │   ├── auth/ cart/ catalog/ orders/
│   │   ├── favorites/                  # API, query e mutation otimista
│   │   ├── profile/ wallets/ realtime/
│   ├── hooks/                         # use-cart, use-media-query
│   ├── mocks/                         # MSW REST/Socket.IO, cenários e estado simulado
│   └── shared/                        # contratos, Axios, auth, pricing, realtime
│       └── lib/address.test.ts         # testes unitários Vitest
└── e2e/
    ├── auth.spec.ts                   # login, cadastro, redirect e sessão
    ├── catalog.spec.ts                # catálogo, preço ao vivo, share, deep link e 404
    ├── catalog-filters.spec.ts        # filtros server-side, history e latency variável
    ├── checkout-errors.spec.ts        # validação, 502, recusa, desconexão e idempotência
    ├── checkout-stale.spec.ts         # preço e disponibilidade desatualizados
    ├── coupon.spec.ts                 # cupons válidos e inválidos
    ├── favorites.spec.ts              # inclusão, remoção, persistência e rollback
    ├── guest-cart.spec.ts             # múltiplos itens, refresh e adoção no login
    ├── header-search.spec.ts          # resultados incrementais da lupa desktop
    ├── hero-carousel.spec.ts          # carrossel de destaques mobile e desktop
    ├── isolation.spec.ts              # isolamento na troca de usuário
    ├── keyboard.spec.ts               # login/cadastro/recibo e foco preso no desktop
    ├── layout.spec.ts                 # overflow, menu/Entrar e footer 100/101
    ├── profile.spec.ts                # edição de perfil, senha e avatar
    ├── purchase.spec.ts               # carrinho, carteiras do checkout, pedido e replay
    ├── realtime.spec.ts               # versão, preço/listing do carrinho e reconnect
    ├── session-expiry.spec.ts         # expiração na navegação e checkout
    ├── skeletons.spec.ts              # loading, offline e retry
    ├── visual.spec.ts                 # baselines de 4 telas × 2 viewports
    ├── wallets.spec.ts                # menu do perfil + CRUD de carteiras
    ├── support/mock.ts                # cenários e controles do MSW
    └── support/session.ts             # login, logout e fluxo do carrinho
```

Regra de dependência: `routes → features/hooks → shared`; `mocks` **consome**
`shared` (para responder no mesmo formato dos contratos), nunca o contrário.

---

## 5. Dados fictícios (fixtures)

Fonte única: `src/mocks/data/fixtures.ts`. Tudo **determinístico** (sem
`Math.random()`), para o E2E prever o que a tela mostra.

### 5.1 Usuários (senha `password`)

| E-mail             | Nome           | id           | Carteira principal | Saldo                      |
| ------------------ | -------------- | ------------ | ------------------ | -------------------------- |
| `alice@jungle.dev` | Alice Nakamura | `user-alice` | carteira principal | 12.408 ETH (+ Ledger 4.02) |
| `bob@jungle.dev`   | Bob Okafor     | `user-bob`   | carteira principal | 6.771 ETH                  |

A senha é guardada como **SHA-256** (`5e884898…` = hash de `password`), não em
texto — ainda assim, é um mock e não é segurança real.

### 5.2 Coleções

| id              | Nome          | Piso | Itens |
| --------------- | ------------- | ---- | ----- |
| `kurio-apes`    | Kurio Apes    | 0.87 | 9     |
| `neon-fauna`    | Neon Fauna    | 0.64 | 9     |
| `aurora-relics` | Aurora Relics | 1.05 | 9     |

### 5.3 NFTs (preço **inicial**; o tempo real altera durante a sessão)

| id                 | Nome              | Coleção       | Preço inicial |
| ------------------ | ----------------- | ------------- | ------------- |
| `emerald-ape-042`  | Emerald Ape #042  | Kurio Apes    | 1.19          |
| `crimson-ape-118`  | Crimson Ape #118  | Kurio Apes    | 2.45          |
| `onyx-ape-007`     | Onyx Ape #007     | Kurio Apes    | 0.87          |
| `neon-fox-231`     | Neon Fox #231     | Neon Fauna    | 0.64          |
| `neon-lynx-088`    | Neon Lynx #088    | Neon Fauna    | 1.72          |
| `sable-owl-054`    | Sable Owl #054    | Neon Fauna    | 3.08          |
| `aurora-relic-001` | Aurora Relic #001 | Aurora Relics | 5.50          |
| `aurora-relic-014` | Aurora Relic #014 | Aurora Relics | 1.05          |
| `ember-relic-202`  | Ember Relic #202  | Aurora Relics | 2.96          |

As 4 obras (`public/art/art-1..4.webp`, 768×768) são **reaproveitadas** entre
27 itens (três edições de cada NFT-base). IDs/preços das edições extras são
determinísticos para exercitar três páginas reais de API.

---

## 6. Rotas e telas

Definidas em `src/app/router.tsx` (rotas em código, cada uma via `React.lazy`).

| Rota              | Tela (arquivo)                                | Protegida? | Apresentação                                                                            |
| ----------------- | --------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `/`               | Início (`routes/home.tsx`)                    | não        | Hero/carrossel, busca, filtros, ordenação, grade, destaques, diário, rodapé             |
| `/nft/$nftId`     | Detalhe (`routes/nft-detail.tsx`)             | não        | Página: arte, ficha, edição, quantidade, favorito, compra e relacionados                |
| `/cart`           | Carrinho (`routes/cart.tsx`)                  | não        | Tabela desktop / cartões mobile + cupom e resumo do servidor                            |
| `/checkout`       | Pagamento (`routes/checkout.tsx`)             | **sim**    | Dados revisáveis, seleção de rede/carteira, cotação e pedido                            |
| `/order/$orderId` | Confirmação (`routes/order-confirmation.tsx`) | **sim**    | Pendente/recusado explícitos; recibo apenas após `settled`; modal desktop/página mobile |
| `/login`          | Entrar (`routes/login.tsx`)                   | não        | **Diálogo (scrim + foco preso) no desktop, página no celular**                          |
| `/register`       | Criar conta (`routes/register.tsx`)           | não        | idem                                                                                    |
| `/profile`        | Perfil (`routes/profile.tsx`)                 | **sim**    | Barra lateral + editar nome, handle, avatar e senha; e-mail/carteira somente leitura    |
| `/wallets`        | Carteiras (`routes/wallets.tsx`)              | **sim**    | CRUD de carteira principal/secundária (adicionar, renomear, promover, remover)          |
| `/favorites`      | Favoritos (`routes/favorites.tsx`)            | **sim**    | Obras favoritas do usuário, com remoção otimista                                        |
| `*`               | 404 (`routes/not-found.tsx`)                  | não        | “saiu do acervo”                                                                        |

**Persistência do mock:** cadastro/contas e hashes, perfil, carteiras e pedidos
persistem por usuário; carrinhos persistem por identidade e favoritos por conta.
O reset do mock limpa essas chaves e restaura os fixtures.

- `?redirect=` é lido por `/login` e `/register` (`validateSearch`).
- A guarda é um **componente** (`<RequireAuth>`), não `beforeLoad` — num F5 o
  `beforeLoad` roda antes da sessão decidir. Ver `ARCHITECTURE.md`.
- `PAGE_SIZE = 9`; 27 NFTs (9 originais + 18 edições determinísticas) geram três
  páginas reais no endpoint.

---

## 7. Contratos REST

Base: `VITE_API_URL` = `https://api.kurio.local` (endereço **fictício**,
interceptado pelo MSW dentro da página). ETH é sempre **string decimal**;
quantidade é **inteiro**. Respostas validadas por zod antes de entrar no cache.
Erros: `{ code, message }`.

### 7.1 Catálogo

| Método | Rota           | Query                                                                    | Resposta                    |
| ------ | -------------- | ------------------------------------------------------------------------ | --------------------------- |
| GET    | `/collections` | —                                                                        | `Collection[]`              |
| GET    | `/nfts`        | `?collectionId=&q=&minPriceEth=&maxPriceEth=&tab=&sort=&page=&pageSize=` | `{ items: Nft[], total }`   |
| GET    | `/nfts/:nftId` | —                                                                        | `Nft` · 404 `nft_not_found` |

### 7.2 Sessão, perfil e carteiras

| Método | Rota                 | Corpo                                                 | Resposta                                                          |
| ------ | -------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| POST   | `/auth/login`        | `{ email, password }`                                 | 201 `{ token, user }` · 401 `invalid_credentials`                 |
| POST   | `/auth/register`     | `{ displayName, email, password, terms }`             | 201 `{ token, user }` · 409 `email_in_use`                        |
| GET    | `/session`           | — (Bearer)                                            | `{ token, user }` · 401 `unauthenticated`                         |
| DELETE | `/session`           | — (Bearer)                                            | 204                                                               |
| GET    | `/users/me`          | — (Bearer)                                            | `User` · 401                                                      |
| PATCH  | `/users/me`          | `{ displayName?, handle?, avatarUrl? }` (parcial)     | `User` · 409 `handle_taken` · 422 corpo vazio                     |
| POST   | `/users/me/password` | `{ currentPassword, newPassword }`                    | 204 · 403 `wrong_password` · 422                                  |
| GET    | `/users/:handle`     | —                                                     | `User` · 404 `user_not_found`                                     |
| GET    | `/wallets`           | — (Bearer)                                            | `Wallet[]` · 401                                                  |
| POST   | `/wallets`           | `{ label, chain, address }`                           | 201 `Wallet[]` (nova na frente; primária só se a lista era vazia) |
| PATCH  | `/wallets/:walletId` | `{ label?, isPrimary? }` (parcial, ao menos um campo) | `Wallet[]` · 404 · 422                                            |
| DELETE | `/wallets/:walletId` | —                                                     | `Wallet[]` (a primária é promovida se removida)                   |

`avatarUrl` aceita string vazia (`''`) — vazio significa "usar as iniciais",
o fallback do perfil. As mutações de carteira devolvem a **lista completa**, que
o cliente escreve direto no cache.

### 7.3 Carrinho

| Método | Rota                 | Corpo                 | Resposta                                                |
| ------ | -------------------- | --------------------- | ------------------------------------------------------- |
| GET    | `/cart`              | —                     | `Cart` com preço/disponibilidade reconciliados          |
| POST   | `/cart/items`        | `{ nftId }`           | 201 `Cart` · 404 `nft_not_found` · 409 `nft_not_listed` |
| PATCH  | `/cart/items/:nftId` | `{ quantity: 1..20 }` | `Cart` · 422 `invalid_quantity`                         |
| DELETE | `/cart/items/:nftId` | —                     | `Cart`                                                  |
| POST   | `/cart/quote`        | —                     | `Cart` (recota e **renova** a reserva)                  |
| POST   | `/cart/coupon`       | `{ code }`            | `Cart` · 422 `invalid_coupon` · 410 `coupon_expired`    |
| DELETE | `/cart/coupon`       | —                     | `Cart`                                                  |
| DELETE | `/cart`              | —                     | 204                                                     |

Cupons aceitos: `KURIO10` (10%), `JUNGLE25` (25%) e `EXPIROU` (expirado — serve
para provar o caminho de erro). O desconto entra **antes** da taxa de serviço.

### 7.4 Pedidos

| Método | Rota               | Corpo                                                                         | Resposta                                                                         |
| ------ | ------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| POST   | `/orders`          | `{ idempotencyKey, paymentMethod, walletAddress, network, collector, note? }` | 201 `Order` · 401 · 409 empty/stale/unavailable/idempotency conflict · 422 · 502 |
| GET    | `/orders`          | — (Bearer)                                                                    | `Order[]`                                                                        |
| GET    | `/orders/:orderId` | — (Bearer)                                                                    | `Order` · 404 `order_not_found`                                                  |

`stale_quote`: a versão de algum item do carrinho ficou atrás da versão atual do
mercado; `nft_not_listed` representa edição esgotada. O cliente escuta
`nft.updated` e bloqueia/reconcilia antes de enviar. Replay idêntico devolve o
mesmo pedido; reuso da chave com conteúdo diferente retorna
`409 idempotency_conflict`.

### 7.5 Favoritos

| Método | Rota                | Corpo       | Resposta                |
| ------ | ------------------- | ----------- | ----------------------- |
| GET    | `/favorites`        | — (Bearer)  | `string[]` (ids de NFT) |
| POST   | `/favorites`        | `{ nftId }` | 201 `string[]` · 404    |
| DELETE | `/favorites/:nftId` | —           | `string[]`              |

Exigem autenticação e são **por usuário**. No cliente, o toggle é otimista com
rollback (ver §ARCHITECTURE, "update otimista").

### 7.6 Controle do mock

| Método | Rota                             | Efeito                                                                      |
| ------ | -------------------------------- | --------------------------------------------------------------------------- |
| GET    | `/__mock__/state`                | `{ scenario, scenarios[], users[] }`                                        |
| POST   | `/__mock__/scenario`             | `{ name }` troca o cenário em tempo de execução                             |
| POST   | `/__mock__/reset`                | mercado, cenários e estado persistido voltam aos fixtures                   |
| POST   | `/__mock__/expire-session`       | `{ token }` revoga o token (simula fim de sessão)                           |
| POST   | `/__mock__/arm-checkout-timeout` | arma **um** atraso de 11 s no próximo `POST /orders` (timeout do cliente)   |
| POST   | `/__mock__/set-price`            | `{ nftId, priceEth }` muda o preço no estado e emite o evento               |
| POST   | `/__mock__/set-listing`          | `{ nftId, listed }` muda disponibilidade e emite `nft.updated`              |
| POST   | `/__mock__/emit-price`           | `{ nftId, priceEth, version }` emite um evento **cru**, sem tocar no estado |
| POST   | `/__mock__/disconnect-sockets`   | fecha transportes ativos para exercitar a reconexão automática              |

Os controles existem para expiração, timeout/idempotência, cotação/preço e
disponibilidade obsoletos, evento duplicado/antigo e reconnect via cliente real.

### 7.7 Formatos principais

```ts
// CartItem — guarda o preço do momento da entrada e a versão que o originou
{ nftId, name, collectionName, imageUrl, priceEth: string, quantity: number, version: number }

// Cart — totais calculados pelo SERVIDOR (o cliente nunca decide quanto cobrar)
{ items: CartItem[], itemCount: number,
  subtotalEth: string, discountEth: string, serviceFeeEth: string, totalEth: string,
  couponCode: string | null,
  reservationId: string | null, expiresAt: string | null, updatedAt: string }

// Order
{ id, code: "0x" + 12 hex, status: 'pending'|'settling'|'settled'|'failed',
  items: CartItem[], subtotalEth, serviceFeeEth, totalEth,
  paymentMethod: 'wallet'|'card', walletAddress, network,
  collector: { displayName, email, ensName? }, note?, createdAt }

// User — avatarUrl vazio cai nas iniciais do nome
{ id, displayName, handle, email, avatarUrl: string, joinedAt }

// Wallet
{ id, label, chain, address, isPrimary: boolean, balanceEth: string }
```

---

## 8. Tempo real (Socket.IO)

Cliente: `socket.io-client`, importado **dinamicamente** dentro de
`createMarketSocket()` — o engine.io captura o construtor `WebSocket` no
momento da avaliação do módulo, então o import tem de vir **depois** de o MSW
começar. Servidor: binding `@mswjs/socket.io-binding` sobre o worker do MSW.
Namespace `/`, sem binário, sem acknowledgements.

### 8.1 Cliente → servidor

| Evento                 | Payload                     | Papel                                                                                          |
| ---------------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `session:authenticate` | `{ token: string \| null }` | Diz de quem é a conexão. `null` desautentica (logout). Sem isso não há isolamento por usuário. |
| `market:subscribe`     | `{ nftIds: string[] }`      | Assina preço/disponibilidade dos IDs.                                                          |
| `market:unsubscribe`   | `{ nftIds: string[] }`      | Cancela assinatura.                                                                            |

### 8.2 Servidor → cliente

| Evento                     | Campos                             | Efeito no cliente                                      |
| -------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `nft.updated`              | `nftId, priceEth, listed, version` | Cache + revalidação do catálogo/carrinho, sob guarda   |
| `cart:reservation-expired` | `reservationId, nftIds`            | Invalida o carrinho                                    |
| `order.updated`            | `orderId, status, version`         | Invalida pedido/lista; recibo faz polling até terminal |

Todos usam o envelope `{ eventId, occurredAt (ISO), version }`. A tela carrinho
e checkout assinam os NFTs do snapshot em uso; a atualização do carrinho é
reconciliada pela resposta REST, que também recalcula valores e retira edições
esgotadas.

Para todos os eventos, a versão é monotônica por entidade e o cliente descarta
versões menores/iguais. No reconnect, o provider reautentica, hooks reenvia
subscriptions vivas e queries ativas são invalidadas. O ping/pong simulado usa
frames `2`/`3` e heartbeat do servidor a cada 15s.

### 8.3 Cadência e variação

- `PRICE_TICK_MS = 5000`: a cada 5s, **todos** os NFTs assinados recebem um tick.
- Variações **determinísticas** (por NFT): `+0.03, -0.02, +0.05, -0.04, +0.02, -0.01`,
  em ciclo, com piso `0.01` e preço fixado em 2 casas.
- O cenário `frozen-prices` mantém o canal aberto mas zera o tick (usado pelo E2E).

---

## 9. Regras de negócio

### 9.1 Preço, taxa e arredondamento (`shared/lib/pricing.ts`)

- Subtotal = Σ `priceEth × quantity` (com `decimal.js`, nunca float binário).
- **Taxa de serviço = 0,06% do subtotal**, arredondada a 3 casas, **piso 0,001**.
  Reproduz o print de referência: `26,83 + 0,016 = 26,846`.
- Total = subtotal + taxa.
- `formatEth`: ponto decimal, sem separador de milhar, zeros à direita
  removidos (`1.19`, `5.5`, `26.846`).
- **O cliente nunca decide quanto cobrar**: exibe o que `/cart/quote` respondeu.

### 9.2 Carrinho

- **Servidor**: o cliente lê `GET /cart`; toda escrita devolve o carrinho recalculado.
- **Identidade**: usuário logado (via token) ou `guest`. Visitante tem carrinho;
  ao entrar, o carrinho do visitante é **adotado**.
- **Reserva**: `reservationId` + `expiresAt` com **TTL de 15 minutos**; expirada,
  os itens voltam ao mercado e o servidor emite `cart:reservation-expired`.
- **Quantidade**: `1..20` (`MAX_ITEM_QUANTITY`); o servidor relê o preço ao recalcular.

### 9.3 Pedido

- `POST /orders` exige sessão; valida o corpo (zod) e a carteira; recusa carrinho
  vazio (409).
- **Idempotência**: repetir com a mesma `idempotencyKey` devolve o **mesmo** pedido
  (protege duplo clique / refresh).
- **Status**: nasce `pending` → `settling` (1,5s) → `settled` (4s), empurrado por
  tempo real (`order.updated`) e polling REST até estado terminal.
- O código do pedido é determinístico: o primeiro é **`0xA91F3B7CE82C`**.
- **Esvazia o carrinho** no servidor após criar o pedido.

---

## 10. Sessão e isolamento por usuário

- **Token** em `localStorage` (`shared/auth/token-storage.ts`); **usuário** no
  cache do Query (chave `['session']`). Sem estado duplicado em contexto.
- Estados: `loading | authenticated | anonymous`.
- **Login não refaz requisição**: a resposta do `POST /auth/login` já é a sessão e
  é semeada no cache (não existe `GET /session` em seguida).
- **Token reidratável** `kurio.<userId>.<nonce>`: como o mock roda na página, o
  mapa token→usuário sumiria no F5. O `getUserIdByToken` **remonta** a sessão a
  partir do próprio token. Só contas dos **fixtures** sobrevivem; contas criadas
  em “Criar conta” vivem enquanto a página viver.
- **401** tratado num único lugar: o interceptor de resposta do Axios
  (`shared/api/http.ts`), **exceto** em `/auth/*` (onde 401 = senha errada).
- **Logout** em ordem: `DELETE /session` → `queryClient.clear()` → socket
  `session:authenticate: null` → remove o token. Assim nenhum dado de uma conta
  fica visível para a próxima.

---

## 11. Cache (TanStack Query)

`shared/api/query-keys.ts`:

```ts
session: ['session']
catalog: { collections: ['catalog','collections'],
           lists:  ['catalog','list'],
           list:   (filters) => ['catalog','list', filters],   // público
           detail: (nftId)   => ['catalog','nft', nftId] }     // público
cart:    (scope) => ['cart', scope]
orders:  (scope) => ['orders', scope]
order:   (scope, orderId) => ['orders', scope, orderId]
wallets: (scope) => ['wallets', scope]
profile: (scope) => ['profile', scope]
```

`scope` = id do usuário **ou** `guest`. Dados públicos têm chave estável; dados
do usuário levam o escopo — é o que impede uma conta de ler o cache da outra.

---

## 12. Reconciliação REST ↔ Socket.IO

1. **Escrita vem do REST.** Toda mutação (carrinho, pedido) é confirmada pela
   resposta HTTP; o socket nunca “decide” estado.
2. **Leitura é enriquecida pelo socket.** `nft.updated` atualiza preço e
   disponibilidade nos caches de lista/detalhe; consulta sensível a preço/listagem
   é revalidada, assim como o snapshot de carrinho ativo.
3. **Guarda de versão.** Versão menor/igual à do cache é descartada.
4. **Assinatura por tela.** `useMarketSubscription(ids)` assina IDs visíveis,
   cancela ao desmontar e reenvia IDs ainda ativos no reconnect. Home assina a
   página server-side, detalhe NFT/relacionados e carrinho/checkout seus itens.
5. **Empurrões do servidor.** `cart:reservation-expired` invalida carrinho;
   `order.updated` invalida pedido e lista. Reconnect reautentica e reconcilia
   recursos ativos via REST; ver os E2E de `realtime.spec.ts` e `purchase.spec.ts`.

---

## 13. Cenários do mock

Além do caminho feliz, para demonstrar caminhos de erro sem editar código:

| Cenário               | Efeito                                                                              |
| --------------------- | ----------------------------------------------------------------------------------- |
| `happy-path`          | Padrão; preços mudam a cada 5s.                                                     |
| `empty-catalog`       | Catálogo vazio (estado vazio).                                                      |
| `checkout-error`      | `POST /orders` → 502; ticks congelados no cenário.                                  |
| `payment-declined`    | Cria pedido terminal `failed`; mantém itens no carrinho.                            |
| `wallet-disconnected` | `POST /orders` → 409 `wallet_disconnected`.                                         |
| `slow-network`        | Latência fixa de 1,2s nas respostas REST.                                           |
| `variable-network`    | Sequência de atrasos determinística (120–1.200ms), permite respostas fora de ordem. |
| `network-offline`     | Requests REST de produto falham como erro de rede; controles do mock seguem ativos. |
| `frozen-prices`       | Canal aberto, **sem** tick de preço (asserções determinísticas).                    |
| `favorites-error`     | `POST /favorites` falha para testar rollback otimista.                              |

- No boot: `VITE_MOCK_SCENARIO`.
- Em tempo de execução: `POST /__mock__/scenario` (fica no `localStorage`, chave
  `kurio:mock-scenario`, e sobrevive ao F5).
- Reset: `POST /__mock__/reset` limpa estado persistido e seleciona `happy-path`.

---

## 14. Variáveis de ambiente

Todas têm **padrão seguro**; nenhuma é obrigatória (o app roda num checkout limpo).

| Variável             | Padrão                    | Papel                                       |
| -------------------- | ------------------------- | ------------------------------------------- |
| `VITE_API_URL`       | `https://api.kurio.local` | Prefixo da API (fictício; o MSW intercepta) |
| `VITE_SOCKET_PATH`   | `/socket.io`              | Caminho do Socket.IO (mesma origem)         |
| `VITE_ENABLE_MOCKS`  | `true`                    | Liga o MSW                                  |
| `VITE_MOCK_SCENARIO` | `happy-path`              | Cenário inicial                             |

Validado por zod em `src/shared/config/env.ts` (o app falha cedo se algo estiver
inválido).

---

## 15. Scripts

| Comando                           | O que faz                             |
| --------------------------------- | ------------------------------------- |
| `npm run dev`                     | Vite em `:5173` (strictPort)          |
| `npm run build`                   | `tsc -b` + `vite build` → `dist/`     |
| `npm run preview`                 | Serve `dist/` em `:4173` (strictPort) |
| `npm run lint`                    | ESLint                                |
| `npm run format` / `format:check` | Prettier                              |
| `npm run test` / `test:watch`     | Vitest                                |
| `npm run e2e` / `e2e:ui`          | Playwright                            |

---

## 16. Testes E2E

Rodam contra o **bundle de produção** (`build` + `preview`) — única forma de
provar deep link, refresh e o rewrite de SPA. Projetos: `desktop` (1440×900) e
`mobile` (Pixel 5). **87 casos × 2 projetos = 174 execuções**; no último
resultado, 164 passaram e 10 foram puladas por viewport (diálogos/menu desktop
no mobile e busca/carrossel exclusivos de um dos perfis).

### 16.1 Mapa de cobertura (fluxo → arquivo)

| #   | Fluxo exigido                                                   | Arquivo(s)                                    |
| --- | --------------------------------------------------------------- | --------------------------------------------- |
| 1   | Catálogo (lista, busca, deep link, refresh, 404)                | `catalog.spec.ts`                             |
| 2   | Preço muda por tempo real, sem recarregar                       | `catalog.spec.ts`, `realtime.spec.ts`         |
| 3   | Favoritar/desfavoritar: otimista, persistência, rollback        | `favorites.spec.ts`, `isolation.spec.ts`      |
| 4   | Carrinho: somar, quantidade (1..20), remover, totais exatos     | `purchase.spec.ts`                            |
| 5   | Cupom: aplicar, inválido, expirado, remover                     | `coupon.spec.ts`                              |
| 6   | Login/cadastro, rota protegida, `?redirect`, logout             | `auth.spec.ts`                                |
| 7   | Compra confirmada vem do servidor (código, total, esvazia)      | `purchase.spec.ts`                            |
| 8   | **Falha 502/recusa/desconexão de carteira + recuperação**       | `checkout-errors.spec.ts`                     |
| 9   | **Timeout/replay e conflito de payload idempotente**            | `checkout-errors.spec.ts`, `purchase.spec.ts` |
| 10  | **Preço e disponibilidade obsoletos bloqueiam checkout**        | `checkout-stale.spec.ts`                      |
| 11  | **Expiração de sessão (navegação e checkout) + retomada**       | `session-expiry.spec.ts`                      |
| 12  | **Eventos antigos/duplicados, reconnect e pedido pendente**     | `realtime.spec.ts`, `purchase.spec.ts`        |
| 13  | **Teclado/foco no login, cadastro e recibo (desktop)**          | `keyboard.spec.ts`                            |
| 14  | **Troca de usuário (alice→bob) isola dados e socket**           | `isolation.spec.ts`, `auth.spec.ts`           |
| 15  | Perfil: nome, handle, avatar, senha e persistência após F5      | `profile.spec.ts`                             |
| 16  | Carteiras CRUD/principal e persistência após F5                 | `wallets.spec.ts`                             |
| 17  | Skeletons, falha de conexão e retry                             | `skeletons.spec.ts`                           |
| 18  | Responsividade sem overflow (390/768/1440)                      | `layout.spec.ts`                              |
| 19  | Regressão visual (início, detalhe, carrinho, pagamento)         | `visual.spec.ts`                              |
| 20  | Casca responsiva: cabeçalho (desktop) e barra inferior (mobile) | `layout.spec.ts`, `visual.spec.ts`            |
| 21  | Favoritos com página dedicada (`/favorites`, update otimista)   | `favorites.spec.ts`, `isolation.spec.ts`      |
| 22  | Faixa de preço com slider acessível, estado na URL e refresh    | `catalog-filters.spec.ts`                     |
| 23  | Carrinho visitante: múltiplos itens, refresh e adoção no login  | `guest-cart.spec.ts`                          |
| 24  | Busca desktop com blur, resultados por digitação e navegação    | `header-search.spec.ts`                       |
| 25  | Hero mobile com três slides, dois NFTs e dots funcionais        | `hero-carousel.spec.ts`                       |
| 26  | Hero avança sozinho em mobile e desktop                         | `hero-carousel.spec.ts`                       |
| 27  | Hero desktop alterna os três destaques pelos indicadores        | `hero-carousel.spec.ts`                       |
| 28  | Toast do carrinho não bloqueia navegação mobile                 | `guest-cart.spec.ts`                          |
| 29  | **Mercado selecionado mantém underline desktop de 4px**         | `layout.spec.ts`                              |
| 30  | **Compartilhamento do detalhe segue os ícones do Figma**        | `catalog.spec.ts`                             |
| 31  | **Footer une diferenciais e newsletter como os frames 100/101** | `layout.spec.ts`                              |
| 32  | Botão Entrar desktop segue medidas e ícone Login do Figma       | `layout.spec.ts`                              |
| 33  | Menu alterna entre Dados do perfil e Carteiras                  | `wallets.spec.ts`                             |
| 34  | Carteiras do checkout seguem frame e atualizam o endereço       | `purchase.spec.ts`                            |
| 35  | Tab bar mobile segue geometria, ícones e navegação do Figma     | `layout.spec.ts`                              |

Os itens em **negrito** foram acrescentados durante esta rodada. O cruzamento
abaixo usa os 12 cenários literais do
[enunciado oficial](https://github.com/junglegaming/frontend-challenge), com
evidência E2E e limites da simulação identificados.

### 16.1.1 Cruzamento com os 12 cenários oficiais

| #   | Cenário exigido                                                      | Evidência                                                      | Estado auditado                                                                                 |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Busca, filtros combinados, ordenação, paginação e histórico          | `catalog-filters.spec.ts`, `header-search.spec.ts`             | Coberto: REST aplica todos os parâmetros; três páginas; back/refresh e respostas fora de ordem. |
| 2   | Acesso direto ao detalhe e NFT inexistente                           | `catalog.spec.ts`                                              | Coberto: deep link, refresh e 404.                                                              |
| 3   | Cadastro, login, expiração, logout e troca de usuário                | `auth.spec.ts`, `session-expiry.spec.ts`, `isolation.spec.ts`  | Coberto: cadastro/hash e sessão persistem; expiração e isolamento testados.                     |
| 4   | Favoritos, incluindo falha e recuperação                             | `favorites.spec.ts`, `isolation.spec.ts`                       | Coberto: persistência por usuário e rollback otimista.                                          |
| 5   | Carrinho, quantidade, remoção, cupom e refresh/login                 | `purchase.spec.ts`, `coupon.spec.ts`, `guest-cart.spec.ts`     | Coberto: visitante, várias obras, refresh, cupom e adoção no login.                             |
| 6   | Compra completa até recibo confirmado                                | `purchase.spec.ts`                                             | Coberto: pedido `pending` é recuperado; recibo só aparece em `settled`.                         |
| 7   | Pagamento recusado, clique repetido e timeout idempotente            | `checkout-errors.spec.ts`, `purchase.spec.ts`                  | Coberto: 502, recusa terminal com carrinho preservado, replay/conflict e timeout.               |
| 8   | Perfil, avatar, senha e carteiras com erros                          | `profile.spec.ts`, `wallets.spec.ts`                           | Coberto: edição, validação, hash e persistência após refresh.                                   |
| 9   | Alteração de preço/disponibilidade via Socket.IO no checkout         | `checkout-stale.spec.ts`, `realtime.spec.ts`                   | Coberto: preço exige recotar; indisponibilidade bloqueia e exige atualizar carrinho.            |
| 10  | Eventos antigos/duplicados, desconexão e retomada de pedido pendente | `realtime.spec.ts`, `purchase.spec.ts`                         | Coberto: eventos versionados, reconnect, reautenticação/reinscrição e retomada sem duplicar.    |
| 11  | Teclado, foco de diálogos e validação de formulários                 | `keyboard.spec.ts`, `checkout-errors.spec.ts` e specs de conta | Coberto: foco login/cadastro/recibo desktop e validações acessíveis.                            |
| 12  | Skeletons com lentidão, feedback de falha e recuperação              | `skeletons.spec.ts`, `checkout-errors.spec.ts`                 | Coberto: lentidão, erro de conexão/retry e erro HTTP de pagamento.                              |

### 16.1.2 Limites restantes da simulação

- Não há extensão, blockchain ou gateway real: conexão/recusa/desconexão e
  transação são cenários do MSW, conforme o escopo do enunciado.
- Login social e recuperação de senha informam que exigiriam um provedor
  externo; não apresentam confirmação de operação que não ocorreu.
- Playwright automatiza viewports 390/393 e 1440; 768 é coberto por teste de
  layout, enquanto baselines visuais versionadas permanecem mobile/desktop.

### 16.2 Arquivos e contagens

| Arquivo                   | Testes | Foco                                                            |
| ------------------------- | -----: | --------------------------------------------------------------- |
| `catalog.spec.ts`         |      7 | lista, raridade, tempo real, detalhe, share, 404, deep link     |
| `catalog-filters.spec.ts` |      4 | filtro combinado, paginação, histórico e resposta fora de ordem |
| `header-search.spec.ts`   |      1 | overlay com busca incremental e seleção de resultado            |
| `hero-carousel.spec.ts`   |      3 | slides mobile/desktop, indicadores e avanço automático          |
| `purchase.spec.ts`        |      7 | carrinho, seletor de carteiras, recibo, replay e retomada       |
| `guest-cart.spec.ts`      |      3 | vários itens, toast, refresh e adoção no login                  |
| `auth.spec.ts`            |      9 | login, cadastro, redirect, sessão, isolamento do carrinho       |
| `profile.spec.ts`         |      6 | nome, handle, senha (sucesso/erro), avatar                      |
| `wallets.spec.ts`         |      6 | menu de conta, adicionar, principal, renomear, remover          |
| `coupon.spec.ts`          |      4 | cupons válidos, inválido, expirado                              |
| `favorites.spec.ts`       |      5 | otimista, persistência no F5, rollback                          |
| `checkout-errors.spec.ts` |      5 | validação, 502, recusada, desconexão e timeout idempotente      |
| `checkout-stale.spec.ts`  |      2 | preço/disponibilidade → bloqueio → recotar                      |
| `session-expiry.spec.ts`  |      2 | expiração na navegação e no checkout                            |
| `realtime.spec.ts`        |      3 | versões, preço/disponibilidade no carrinho e reconnect          |
| `keyboard.spec.ts`        |      4 | focus trap login/cadastro/recibo (desktop)                      |
| `isolation.spec.ts`       |      1 | favoritos + socket seguem a conta                               |
| `skeletons.spec.ts`       |      4 | shimmer, falha de rede e retry                                  |
| `layout.spec.ts`          |      7 | overflow, tab bar, menus/Entrar e footer/newsletter             |
| `visual.spec.ts`          |      4 | regressão visual versionada                                     |

### 16.3 Ajuda de teste

- `e2e/support/mock.ts` — `seedScenario()` (fixa o cenário via `addInitScript`,
  antes do app carregar), `setScenario()` e os controles do mock
  (`expireSession`, `armCheckoutTimeout`, `setPrice`, `setListing`, `emitPrice`,
  `disconnectSockets`, `fetchOrders`, `replayOrder`).
  Os controles chamam a API por `page.evaluate(fetch(...))` porque o MSW vive no
  _realm_ da página — `page.request` não passa por ele.
- `e2e/support/session.ts` — `login()`, `submitLogin()`, `logout()`, `addToCart()`.

> **Estado do mock:** mercado reseta dos fixtures; cadastro/hash, perfil,
> carteiras, pedidos/idempotência, carrinho e favoritos persistem por identidade
> no `localStorage`. Os testes cobrem reload, adoção do carrinho visitante e
> recuperação de pedido. `logout()` espera o token ser removido antes da troca.

### 16.4 Resultado

```text
164 passed, 10 skipped (2.0m)
```

---

## 17. Lighthouse

Protocolo do enunciado: **3 medições por tela e por perfil**, reportando a
**mediana**. Chrome headless sobre o build de produção (`build` + `preview`).
Telas Início (`/`) e Detalhe (`/nft/emerald-ape-042`); perfis mobile (emulação
padrão, 4G simulado + CPU 4×) e desktop (`--preset=desktop`). Relatórios
HTML/JSON em [`docs/lighthouse/`](./docs/lighthouse) e as medianas em
`docs/lighthouse/medians.json`.

| Página  | Perfil  | Perf | A11y | Boas práticas | SEO |  FCP  |  LCP  |  CLS   | TBT |
| ------- | ------- | :--: | :--: | :-----------: | :-: | :---: | :---: | :----: | :-: |
| Início  | Desktop |  98  | 100  |      100      | 100 | 0,71s | 0,97s | 0,0035 | 0ms |
| Início  | Mobile  |  78  | 100  |      100      | 100 | 3,50s | 4,26s | 0,0000 | 0ms |
| Detalhe | Desktop |  98  | 100  |      100      | 100 | 0,72s | 1,07s | 0,0000 | 0ms |
| Detalhe | Mobile  |  76  | 100  |      100      | 100 | 3,34s | 4,60s | 0,0192 | 1ms |

CLS das **três execuções individuais** (antes de calcular a mediana):

| Página  | Perfil  |  Execução 1 |  Execução 2 |  Execução 3 |     Mediana |
| ------- | ------- | ----------: | ----------: | ----------: | ----------: |
| Início  | Desktop | 0,003480410 | 0,003480410 | 0,003480410 | 0,003480410 |
| Início  | Mobile  | 0,000000000 | 0,000000000 | 0,000000000 | 0,000000000 |
| Detalhe | Desktop | 0,000000000 | 0,000000000 | 0,000000000 | 0,000000000 |
| Detalhe | Mobile  | 0,019193036 | 0,019193036 | 0,019193036 | 0,019193036 |

```bash
npm run preview            # em outro terminal
# mobile (padrão) e desktop (--preset=desktop), 3× cada, para Início e Detalhe
npx lighthouse http://localhost:4173/ --preset=desktop \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json,html --output-path=docs/lighthouse/inicio-desktop-1 \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu"
```

Ambiente: Lighthouse 13.5.0, Headless Chrome 155, Node v23.1.0, macOS (darwin arm64).

### 17.1 Justificativa formal — performance mobile abaixo de 90 (opção b)

O brief oferecia duas saídas: (a) otimizar até ≥90 ou (b) **justificar
formalmente**. Foi escolhida **(b)**, porque a causa raiz é **arquitetural e
obrigatória**, não um descuido de implementação.

**A causa:** o enunciado exige que o app rode de um _checkout_ limpo, sem
serviços privados. A REST e o Socket.IO fictícios vivem **no navegador** (MSW +
`@mswjs/socket.io-binding`). Para que nenhuma chamada escape para a rede real,
o MSW precisa estar interceptando **antes** de o app buscar qualquer dado. Isso
põe ~170 kB (gzip) de JavaScript — o núcleo do MSW mais handlers, fixtures e o
binding de socket — no **caminho crítico** entre o bundle principal e o primeiro
dado. Em 4G simulado com CPU 4×, essa corrente serial
(`bundle principal → chunk do MSW → dados`) responde pelo FCP (~3,2s) e pelo LCP
(~4,45–4,59s). O desktop não sofre, porque aí a rede e a CPU não são o gargalo:
98/98.

**O que foi otimizado apesar disso** (parte da opção a, sem quebrar nada):

| Otimização       | Antes                                 | Depois                                 |
| ---------------- | ------------------------------------- | -------------------------------------- |
| Arte do catálogo | 4 PNG de ~2 MB (≈7,6 MB)              | 4 **WebP** 768² (≈131 kB)              |
| Banners de demo  | Dois PNGs com imagem "DEMO MODE"      | Removidos; promos reutilizam arte NFT  |
| CSS crítico      | `<link>` render-blocking (~456 ms)    | **inline no HTML**                     |
| Chunk do MSW     | descoberto só após o bundle principal | **`modulepreload`** do subgrafo do MSW |

Resultado: as quatro artes do catálogo caíram de ~7,6 MB para ~131 kB. Nas
medições atuais a performance mobile ficou em 78 (Início) e 76 (Detalhe); A11y,
Boas Práticas e SEO ficaram em 100 nos dois perfis. O **desktop** ficou em 98/98.
Levar o mobile a ≥90 exigiria
remover o backend simulado do caminho crítico — possível só com um backend
real, que o enunciado proíbe assumir.

### 17.2 O que a auditoria apontou e o que foi corrigido

| Achado                                      | Correção                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `errors-in-console` — 404 de `/favicon.ico` | Criado `public/favicon.svg` + `<link rel="icon">` no `index.html`                                    |
| `robots-txt` ausente                        | Criado `public/robots.txt`                                                                           |
| `unsized-images`                            | `width`/`height` explícitos em **todas** as `<img>`                                                  |
| `label-content-name-mismatch`               | Removido `aria-label` redundante do cartão: o nome acessível passa a vir do próprio conteúdo visível |
| `render-blocking-resources` — CSS           | CSS crítico embutido no HTML via plugin do Vite                                                      |
| imagens pesadas (`total-byte-weight`)       | Arte convertida para WebP e redimensionada                                                           |
| corrente serial do MSW                      | `modulepreload` do chunk do mock e suas dependências                                                 |

### 17.3 Ressalvas conhecidas (assumidas)

- `unused-javascript` — o bundle do MSW é baixado antes de ser executado (é o
  que permite o backend simulado). Inerente ao enunciado.
- `bf-cache` — a conexão de tempo real mantém a página ativa; o back/forward
  cache é bloqueado.

---

## 18. Deploy — passo a passo (tudo o que foi publicado)

### 18.1 O que a Vercel recebe

- O **conteúdo da raiz do projeto**, respeitando o **`.gitignore`**. Ficam de
  fora: `node_modules/`, `dist/`, `reference/` (material do Figma),
  `.env`/`.env.*`, `playwright-report/`, `test-results/`.
- **Não existe `.vercelignore`** — o `.gitignore` é o filtro.
- A Vercel faz **build remoto**: detecta o framework (Vite), roda
  `npm run build` e publica `dist/`.
- **Nenhuma variável de ambiente** é configurada na Vercel: os padrões de
  `src/shared/config/env.ts` bastam (mocks ligados por padrão).

### 18.2 Arquivos de configuração do deploy

`vercel.json` (a única configuração de infraestrutura):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

O `rewrite` é o que faz **deep link e F5** funcionarem numa SPA: qualquer caminho
que não seja um arquivo real é servido com o `index.html`, e o roteador do app
resolve a tela. (Já foi tentado um padrão com _lookahead_ negativo; a Vercel usa
_path-to-regexp_ e **não** suporta lookahead — por isso a forma canônica acima.)

### 18.3 Passo 1 — autenticar no CLI

```bash
cd /caminho/para/kurio_nft_mkt
npx vercel login
```

O login usa o fluxo de **código de dispositivo** (sem senha no CLI): o comando
imprime uma URL `https://vercel.com/oauth/device?user_code=…` e aguarda a
confirmação no navegador. Concluído:

```bash
npx vercel whoami      # confirma que a sessão está autenticada
```

### 18.4 Passo 2 — conferir o build local (mesmo comando da Vercel)

```bash
npm run build          # tsc -b && vite build  ->  dist/
```

### 18.5 Passo 3 — deploy de produção

```bash
npx vercel deploy --prod --yes --name kurio-nft-marketplace
```

- `--prod` promove a produção; `--yes` aceita os padrões (sem prompts);
  o projeto já está vinculado ao diretório local pelo `.vercel/`.
- A CLI **envia o código e a Vercel constrói remotamente**, transmitindo o log
  do `vite build`.
- Resultado:

O alias de produção é <https://kurio-nft-marketplace-chi.vercel.app>.

### 18.6 Passo 4 — verificar o que subiu

Códigos HTTP (todas as rotas profundas devem responder `200`, via rewrite):

```bash
URL=https://kurio-nft-marketplace-chi.vercel.app
for p in "/" "/nft/emerald-ape-042" "/cart" "/checkout" "/order/order_demo" "/favorites" "/profile" "/wallets"; do
  curl -s -o /dev/null -w "%{http_code}  $p\n" "$URL$p"
done
```

```text
200  /
200  /
200  /login
200  /cart
200  /wallets
200  /checkout
200  /nft/emerald-ape-042
```

Smoke funcional no ar (Chromium, sessão isolada), que passou:

| Verificação                           | Resultado                                                  |
| ------------------------------------- | ---------------------------------------------------------- |
| Abrir `/nft/emerald-ape-042`          | catálogo/detail via MSW carregado                          |
| Socket.IO no browser público          | `Tempo real connected`; ticks `nft.updated`                |
| Login `alice@jungle.dev` / `password` | autenticação simulada concluída                            |
| Compra com rede `Polygon`             | recibo `0xA91F3B7CE82C`, total `1.191 ETH`                 |
| Menu desktop após clicar em Mercado   | `#catalogo`, `aria-current=page`, traço 4px                |
| Compartilhamento do detalhe           | LinkedIn, e-mail e Twitter inline; sem botão “Copiar link” |
| Console JS                            | sem erros                                                  |

Layout responsivo no ar (Playwright, `window.innerWidth` real):

| Viewport | Container do header | Grade     | Barra inferior |
| -------- | ------------------- | --------- | -------------- |
| 1440     | 1200 px             | 3 colunas | oculta         |
| 768      | 768 px              | 3 colunas | oculta         |
| 393      | 393 px              | 2 colunas | visível        |

### 18.7 Passo 5 — publicação visual final (14/10/2026)

Após implementação, suíte E2E, atualização dos baselines e auditoria Lighthouse,
foi publicado o código final:

```bash
npx vercel deploy --prod --yes
```

Deploy `dpl_EAegZJ2N2CCxM6wtr7JYAkqa9zYG` ficou `READY` e foi promovido para
<https://kurio-nft-marketplace-chi.vercel.app>. O alias de produção permanece
estável; as seis rotas verificadas acima responderam `200`.

### 18.8 Artefatos publicados (`dist/`, ~1,8 MB)

```
index.html
favicon.svg
robots.txt
mockServiceWorker.js
art/art-1.webp … art-4.webp         # ≈130 kB no total; nenhuma arte PNG/demo
avatars/…
assets/
  index-*.js          ≈358 KB  (app)
  index-*.css         ≈76 KB   (CSS também embutido no index.html)
  browser-*.js        ≈469 KB  (MSW — incluído no build de demonstração)
  button-*.js         ≈154 KB  (componentes Radix/shadcn)
  primitives-*.js     ≈86 KB   (zod)
  http-*.js           ≈24 KB   (Axios/interceptors)
  home-*.js           ≈50 KB
  auth-panel / nft-detail / checkout / cart / home / wallets / profile / order-confirmation
  roboto-mono-*-400/500/700.woff2|woff
```

Os 12 relatórios Lighthouse HTML/JSON são entregáveis separados em
`docs/lighthouse/` (≈17 MB) e **não** fazem parte do `dist/` publicado.

Evidência do code-splitting: há um chunk por rota (`home-*.js`,
`nft-detail-*.js`, `checkout-*.js`, `wallets-*.js`, …) além do chunk inicial.

### 18.9 Observação sobre Deployment Protection

A resposta do deploy listou `deploymentProtection: ["vercel_authentication"]`.
Ainda assim, a **URL de produção respondeu `200` sem autenticação** (via `curl`
e num contexto de navegador limpo), ou seja, está pública. Se você quiser
confirmar/ajustar, veja **Vercel → Project → Settings → Deployment Protection**.

---

## 19. Verificação manual (roteiro)

### 19.1 No ar (https://kurio-nft-marketplace-chi.vercel.app)

1. **Início** — a grade mostra 9 itens da página 1 (27 no total); espere ~5s e veja os preços mudarem
   sozinhos (tempo real). O status do socket fica disponível para tecnologia
   assistiva, sem indicador visual que não existe no Figma.
2. **Detalhe** — clique num cartão (`/nft/emerald-ape-042`); abas “Detalhes do
   NFT” e “Avaliações”.
3. **Carrinho** — “COMPRAR” leva a `/cart`; confira **Subtotal + Taxa = Total**.
4. **Login** — em `/wallets` (sem sessão) você é levado a
   `/login?redirect=%2Fwallets`; entre com `alice@jungle.dev` / `password`.
5. **Refresh** — com sessão, aperte F5 em `/wallets`: continua em Carteiras.
6. **Compra** — do carrinho, finalize; a confirmação (`/order/…`) traz o código
   `0x…` e o total; o cabeçalho perde o contador do carrinho.
7. **Isolamento** — saia, entre como `bob@jungle.dev`: o carrinho está vazio.
8. **404** — abra qualquer rota inexistente (ex.: `/nao-existe`).

### 19.2 Local (do zero)

```bash
npm ci
npm run build
npx playwright install chromium
npm run test                                                    # 2 passed
npm run e2e                                                     # 164 passed, 10 skipped
npm run format:check && npx tsc -b && npx eslint .
```

---

## 20. Limitações e desvios (resumo)

Detalhamento completo em
[`ARCHITECTURE.md`](./ARCHITECTURE.md#limitações-e-desvios-conscientes).

- **Persistência do mock**: mercado reinicia dos fixtures; contas/hashes, perfil,
  carteiras, pedidos/idempotência, carrinhos e favoritos sobrevivem ao refresh
  no `localStorage` por usuário/identidade. Reset incrementa geração do token e
  limpa o estado salvo.
- **Simulados com aviso**: apenas login social e recuperação de senha. Perfil
  (nome, handle, avatar, senha), cupons e carteiras são **reais** no mock.
- **Arte do catálogo**: 4 obras (WebP 768²) reaproveitadas entre 27 NFTs (9
  originais e 18 edições determinísticas para paginação).
- **Nomes dos NFTs**: mantidos os dos fixtures, não os placeholders do Figma.
- **Ícones**: alguns extraídos do Figma; o resto usa equivalentes `lucide-react`.
- **Diálogo × página**: login/cadastro e confirmação são **rotas endereçáveis**
  que se desenham como diálogo no desktop e página no celular. Por isso os testes
  de teclado do diálogo rodam só no desktop.
- **Performance mobile < 90**: causa arquitetural (backend simulado no
  navegador); justificativa formal em §17.1.
- **Recortes de escopo**: sem i18n, tema claro ou PWA; condições offline são
  simuladas para teste pelo MSW, não como modo de uso persistente.

### 20.1 Status do brief de correções (Fases 1–5)

| Fase    | Item                                                               | Status                                              |
| ------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| 1.1     | Favoritos (GET/POST/DELETE, toggle, otimista com rollback, E2E)    | ✅ implementado                                     |
| 1.2     | Cupom (aplicar/remover, inválido, expirado, E2E)                   | ✅ implementado                                     |
| 1.3     | Editar perfil (nome, handle único, senha)                          | ✅ mutations e persistência após F5 testadas        |
| 1.4     | Carteiras (adicionar, principal, renomear, remover)                | ✅ CRUD e persistência após F5 testados             |
| 1.5     | Avatar (escolha entre presets ou URL)                              | ✅ implementado                                     |
| 2.1     | Skeletons com shimmer (catálogo, detalhe, resumo) + E2E            | ✅ implementado                                     |
| 2.2     | Regressão visual versionada (início, detalhe, carrinho, pagamento) | ✅ implementado                                     |
| 3.1–3.5 | Cenários E2E de sessão, falha, idempotência, socket e cotação      | ✅ implementado                                     |
| 3.6     | Teclado/foco no diálogo                                            | ✅ implementado (desktop)                           |
| 3.7     | Troca de usuário limpando dados + socket                           | ✅ implementado                                     |
| 4       | Lighthouse com 3 medições + mediana                                | ✅ protocolo feito; **opção (b)** com justificativa |
| 5       | Documentação (VERIFICACAO, ARCHITECTURE, README)                   | ✅ este documento                                   |

**Cortado conscientemente:** login social e recuperação de senha exibem aviso
de que exigiriam um provedor externo; não simulam sucesso.

### 20.2 Resultado da auditoria funcional contra o enunciado oficial

Conferência final baseada no README oficial e nos 12 cenários da seção 16:
catálogo, URL, persistência por usuário, eventos `nft.updated`/`order.updated`,
checkout terminal, idempotência, reconnect, formulários e condições de rede
estão implementados e cobertos por E2E. No último resultado, 164 execuções
passaram e 10 foram puladas por viewport.

Limites da simulação estão descritos em §16.1.2: não há integração real de
carteira/blockchain/pagamento, e login social/recuperação exibem aviso em vez de
fingir uma operação externa.

---
