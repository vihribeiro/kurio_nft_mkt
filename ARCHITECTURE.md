# Arquitetura — Kurio

Documento de decisões. Contratos, política de sessão, estado do carrinho,
estratégia de cache, reconciliação entre REST e Socket.IO e os desvios
conscientes do Figma.

Índice:

1. [Visão geral](#visão-geral)
2. [Camadas do front](#camadas-do-front)
3. [Contratos REST](#contratos-rest)
4. [Tempo real (Socket.IO)](#tempo-real-socketio)
5. [Sessão e isolamento por usuário](#sessão-e-isolamento-por-usuário)
6. [Estado do carrinho](#estado-do-carrinho)
7. [Estratégia de cache](#estratégia-de-cache)
8. [Reconciliação REST ↔ Socket.IO](#reconciliação-rest--socketio)
9. [Preços e arredondamento](#preços-e-arredondamento)
10. [Rotas e apresentação](#rotas-e-apresentação)
11. [Acessibilidade e responsividade](#acessibilidade-e-responsividade)
12. [Testes](#testes)
13. [Limitações e desvios conscientes](#limitações-e-desvios-conscientes)

---

## Visão geral

O app é um front-end autossuficiente. Não há backend real: **todo** o tráfego
HTTP e a conexão Socket.IO encontram o **MSW**, que responde dentro da página.

```
┌──────────────────────────── navegador ────────────────────────────┐
│                                                                   │
│  React + TanStack Router/Query                                    │
│        │  Axios (REST)          │  socket.io-client               │
│        ▼                        ▼                                 │
│  ┌──────────────────────────────────────────────┐                 │
│  │ MSW worker: handlers REST + binding Socket.IO │                 │
│  └──────────────────────────────────────────────┘                 │
│        │                                                          │
│        └── dados em memória + snapshots locais do mock              │
└───────────────────────────────────────────────────────────────────┘
```

O runtime do mock vive no navegador. Preço/disponibilidade do mercado são
recriados dos fixtures; contas, hashes de senha, perfil, carteiras, pedidos,
chaves de idempotência, carrinhos e favoritos têm snapshots por usuário ou
identidade no `localStorage`. Reset explícito remove os snapshots; veja
[Limitações](#limitações-e-desvios-conscientes).

## Camadas do front

| Camada      | Onde                               | Responsabilidade                                                                                                     |
| ----------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Rotas       | `src/routes`, `src/app/router.tsx` | Cada tela é uma rota endereçável; `React.lazy` por rota.                                                             |
| Features    | `src/features/*`                   | Funções de API (uma por domínio) + contexto de sessão/tempo real. Nunca chamam `axios` cru — usam `shared/api/http`. |
| Hooks       | `src/hooks`                        | `use-cart` (mutações + cache), `use-media-query`.                                                                    |
| Componentes | `src/components`                   | Peças compartilhadas (`nft-card`, `qty-stepper`, `site-footer`) e `ui/` (shadcn).                                    |
| Shared      | `src/shared`                       | Contratos (zod), cliente HTTP, query keys, cálculo de preço, contratos de tempo real.                                |
| Mocks       | `src/mocks`                        | Servidor simulado: handlers, dados, cenários e o servidor Socket.IO.                                                 |

Regra de dependência: `routes → features/hooks → shared`. `mocks` depende de
`shared` (para responder **no mesmo formato** que os contratos), nunca o
contrário.

## Contratos REST

Base: `VITE_API_URL` (padrão `https://api.kurio.local`). Valores em ETH são
**strings decimais** (`"1.19"`), quantidades são **inteiros**. Todas as
respostas são validadas por zod antes de entrar no cache.

### Catálogo

| Método | Rota           | Corpo / Query                                                            | Resposta                          |
| ------ | -------------- | ------------------------------------------------------------------------ | --------------------------------- |
| `GET`  | `/collections` | —                                                                        | `Collection[]`                    |
| `GET`  | `/nfts`        | `?collectionId=&q=&minPriceEth=&maxPriceEth=&sort=&tab=&page=&pageSize=` | `{ items: Nft[], total: number }` |
| `GET`  | `/nfts/:nftId` | —                                                                        | `Nft` \| `404 nft_not_found`      |

### Sessão, perfil e carteiras

| Método   | Rota                 | Corpo                                     | Resposta                                              |
| -------- | -------------------- | ----------------------------------------- | ----------------------------------------------------- |
| `POST`   | `/auth/login`        | `{ email, password }`                     | `201` `{ token, user }` \| `401 invalid_credentials`  |
| `POST`   | `/auth/register`     | `{ displayName, email, password, terms }` | `201 { token, user }` \| `409 email_in_use`           |
| `GET`    | `/session`           | — (Bearer)                                | `{ token, user }` \| `401 unauthenticated`            |
| `DELETE` | `/session`           | — (Bearer)                                | `204`                                                 |
| `GET`    | `/users/me`          | — (Bearer)                                | `User` \| `401`                                       |
| `PATCH`  | `/users/me`          | `{ displayName?, handle?, avatarUrl? }`   | `User` \| `409 handle_taken` \| `422` (corpo vazio)   |
| `POST`   | `/users/me/password` | `{ currentPassword, newPassword }`        | `204` \| `403 wrong_password` \| `422`                |
| `GET`    | `/users/:handle`     | —                                         | `User` \| `404 user_not_found`                        |
| `GET`    | `/wallets`           | — (Bearer)                                | `Wallet[]` \| `401`                                   |
| `POST`   | `/wallets`           | `{ label, chain, address }`               | `201 Wallet[]` (nova na frente)                       |
| `PATCH`  | `/wallets/:id`       | `{ label?, isPrimary? }`                  | `Wallet[]` \| `404` \| `422`                          |
| `DELETE` | `/wallets/:id`       | —                                         | `Wallet[]` (promove a próxima se removida a primária) |

As mutações de carteira devolvem a **lista inteira** — o cliente grava direto no
cache, sem invalidação extra.

### Carrinho

| Método   | Rota                 | Corpo                 | Resposta                                                  |
| -------- | -------------------- | --------------------- | --------------------------------------------------------- |
| `GET`    | `/cart`              | —                     | `Cart` com preço/disponibilidade reconciliados            |
| `POST`   | `/cart/items`        | `{ nftId }`           | `201 Cart` \| `404 nft_not_found` \| `409 nft_not_listed` |
| `PATCH`  | `/cart/items/:nftId` | `{ quantity: 1..20 }` | `Cart` \| `422 invalid_quantity`                          |
| `DELETE` | `/cart/items/:nftId` | —                     | `Cart`                                                    |
| `POST`   | `/cart/quote`        | —                     | `Cart` (recota e renova a reserva)                        |
| `POST`   | `/cart/coupon`       | `{ code }`            | `Cart` \| `422 invalid_coupon` \| `410 coupon_expired`    |
| `DELETE` | `/cart/coupon`       | —                     | `Cart`                                                    |
| `DELETE` | `/cart`              | —                     | `204`                                                     |

### Favoritos

| Método   | Rota                | Corpo       | Resposta       |
| -------- | ------------------- | ----------- | -------------- |
| `GET`    | `/favorites`        | — (Bearer)  | `string[]`     |
| `POST`   | `/favorites`        | `{ nftId }` | `201 string[]` |
| `DELETE` | `/favorites/:nftId` | —           | `string[]`     |

### Pedidos

| Método | Rota               | Corpo                                                                         | Resposta                                                                                          |
| ------ | ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `POST` | `/orders`          | `{ idempotencyKey, paymentMethod, walletAddress, network, collector, note? }` | `201 Order` \| `401` \| `409 empty_cart/stale_quote/nft_not_listed/idempotency_conflict` \| `502` |
| `GET`  | `/orders`          | — (Bearer)                                                                    | `Order[]`                                                                                         |
| `GET`  | `/orders/:orderId` | — (Bearer)                                                                    | `Order` \| `404 order_not_found`                                                                  |

### Controle do mock

`GET /__mock__/state`, `POST /__mock__/scenario`, `POST /__mock__/reset` e os
controles usados pelos testes E2E: `/__mock__/expire-session`,
`/__mock__/arm-checkout-timeout`, `/__mock__/set-price`, `/__mock__/set-listing`,
`/__mock__/emit-price` e `/__mock__/disconnect-sockets`.

### Formatos principais

```ts
// Cart — totais sempre calculados pelo SERVIDOR
{ items: CartItem[], itemCount: number,
  subtotalEth: string, discountEth: string, serviceFeeEth: string, totalEth: string,
  couponCode: string | null,
  reservationId: string | null, expiresAt: string | null, updatedAt: string }

// CartItem — guarda o preço do momento da entrada e a versão que o originou
{ nftId, name, collectionName, imageUrl, priceEth: string, quantity: number, version: number }

// Order
{ id, code: "0x" + 12 hex, status: 'pending'|'settling'|'settled'|'failed',
  items, subtotalEth, serviceFeeEth, totalEth,
  paymentMethod: 'wallet'|'card', walletAddress, network,
  collector: { displayName, email, ensName? }, note?, createdAt }

// User — avatarUrl vazio cai nas iniciais
{ id, displayName, handle, email, avatarUrl: string, joinedAt }

// Wallet
{ id, label, chain, address, isPrimary: boolean, balanceEth: string }
```

Todos os erros REST seguem `{ code, message }`, traduzidos para a UI por
`shared/api/errors.ts`.

## Tempo real (Socket.IO)

Cliente: `socket.io-client` (importado **dinamicamente** depois de o MSW
começar — o engine.io captura o construtor `WebSocket` na avaliação do módulo).
Servidor: binding `@mswjs/socket.io-binding` sobre o worker do MSW. Namespace
padrão `/`, sem binário, sem acknowledgements.

### Eventos cliente → servidor

| Evento                 | Payload                     | Papel                                                                                                                        |
| ---------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `session:authenticate` | `{ token: string \| null }` | Diz de **quem** é a conexão. `null` desautentica (logout). Sem isso, não há como garantir isolamento de eventos por usuário. |
| `market:subscribe`     | `{ nftIds: string[] }`      | Assina mudanças de preço de uma lista de NFTs.                                                                               |
| `market:unsubscribe`   | `{ nftIds: string[] }`      | Cancela a assinatura.                                                                                                        |

### Eventos servidor → cliente

| Evento                     | Payload                                                                                       | Efeito no cliente                                          |
| -------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `nft.updated`              | `{ eventId, occurredAt, version, nftId, priceEth, previousPriceEth, listed, previousListed }` | Atualiza catálogo/detalhe; recota carrinho ativo pela API. |
| `cart:reservation-expired` | `{ …, reservationId, nftIds }`                                                                | Invalida o carrinho (itens voltaram ao mercado).           |
| `order.updated`            | `{ …, orderId, status }`                                                                      | Invalida pedido e lista, descartando versões antigas.      |

### Envelope e versão

Todo evento do servidor carrega:

```ts
{ eventId: string, occurredAt: string /* ISO */, version: number /* monotônica por entidade */ }
```

A `version` é monotônica por NFT/pedido. Cliente **descarta** evento de versão
menor ou igual à versão vista/cacheada, sem reaplicar efeitos. Eventos de preço e
disponibilidade usam o mesmo contador do NFT. Após reconexão, o provider
reautentica a sessão e invalida catálogo, carrinho e recursos privados ativos;
`useMarketSubscription` reenvia a lista de NFTs ainda montada.

Além dos eventos, há o `ping`/`pong` do protocolo (`2`/`3`), enviado pelo
servidor a cada 15 s para manter a conexão viva em ambientes ociosos.

### Cadência

O servidor mexe no preço de **todos** os NFTs assinados a cada **5 s**
(`PRICE_TICK_MS`). Não há revezamento: a vitrine é justamente onde o tempo real
precisa ser visível, e um tick por vez tornaria o E2E lento e dependente da
ordem de assinatura. O cenário `frozen-prices` mantém o canal aberto mas zera o
tick — é o que dá asserções exatas aos testes de soma.

## Sessão e isolamento por usuário

### Fonte de verdade

- **Token** no `localStorage` (`shared/auth/token-storage.ts`).
- **Usuário** no cache do TanStack Query, chave `['session']`.

Não há cópia em contexto: o `SessionProvider` lê o cache e o token.

### Estados

`status ∈ { loading, authenticated, anonymous }`:

```ts
token === null || sessionQuery.isError ? 'anonymous' : user ? 'authenticated' : 'loading'
```

- **Login não refaz requisição** — a resposta do `POST /auth/login` já é a
  sessão e é semeada no cache. Não existe um `GET /session` logo depois.
- **Refresh** começa em `loading` e resolve para `authenticated`/`anonymous`.

### Token reidratável (e por quê)

O mock roda na página, então o mapa `token → usuário` some a cada recarga. Para
que **links diretos protegidos sobrevivam ao F5 e ao rewrite de SPA na Vercel**,
o token emitido tem o formato `kurio.<generation>.<userId>.<nonce>` e o servidor
remonta a sessão a partir dele (`getUserIdByToken`). O reset incrementa a geração
para invalidar também tokens reidratáveis de outras abas.

- Contas dos **fixtures** e contas criadas em **Criar conta** sobrevivem à
  recarga; perfil e hash de senha são hidratados do storage do mock.
- `DELETE /session` marca o token como revogado (não volta a valer enquanto a
  página viver) e o cliente apaga o token do `localStorage`.

### 401

Tratado **num único lugar**: o interceptor de resposta do Axios
(`shared/api/http.ts`). Um `401` descarta o token — exceto em `/auth/*`, onde
`401` significa “senha errada”, não “sessão expirada”.

### Logout

A ordem é deliberada para não deixar dado de uma conta visível para a próxima:

1. `DELETE /session`;
2. `queryClient.clear()` — **todo** o cache cai;
3. desmonta/reescreve o token do socket (`session:authenticate: null`) e
   descarta a conexão;
4. remove o token do `localStorage`.

### Isolamento nas chaves

Dados do usuário carregam o `scope` (id do usuário, ou `guest`) como prefixo da
query key. Dados públicos (catálogo, coleções) têm chave estável. É o prefixo
que impede que o cache de uma conta seja lido por outra — e o `clear()` no
logout fecha qualquer janela de corrida. O E2E cobre isso (“o carrinho é
isolado por conta”).

## Estado do carrinho

**O carrinho é do servidor.** O cliente nunca o mantém como estado próprio: ele
lê `GET /cart`, e toda escrita devolve o carrinho já recalculado.

- **Identidade**: `cartIdentity(request)` = usuário logado (via token) **ou**
  `guest`. Um visitante tem carrinho; ao entrar, `adoptGuestCart(userId)` adota
  os itens do visitante.
- **Reserva**: ao adicionar/cotar, o servidor emite `reservationId` + `expiresAt`
  (**TTL 15 min**). Expirada, os itens voltam ao mercado e o servidor emite
  `cart:reservation-expired`, que invalida o cache do carrinho.
- **Quantidades**: `PATCH /cart/items/:nftId` com `1..MAX_ITEM_QUANTITY` (20).
  O servidor relê o preço corrente ao recalcular.
- **Cotação oficial**: `POST /cart/quote` relê os preços e **renova** a reserva.
  É a referência do pedido — o total exibido é o do servidor, não uma conta do
  cliente.
- **Checkout**: `POST /orders` recebe uma `idempotencyKey` gerada uma vez por
  intenção (retry/duplo clique/refresh devolvem o **mesmo** pedido, não um
  novo). O servidor valida a carteira, calcula o total, cria o pedido e
  **esvazia o carrinho**.

### Hooks

`use-cart.ts` expõe `cart`, `itemCount`, `addItem`, `removeItem`,
`setQuantity`, `quote` e as flags de pendência. As mutações escrevem a resposta
do servidor no cache (sem “otimismo” para totais: quem soma é o servidor).

## Estratégia de cache

Chaves em `shared/api/query-keys.ts`:

```ts
session: ['session']
catalog: {
  collections: ['catalog', 'collections']
  list: (filters) => ['catalog', 'list', filters] // pública
  detail: (nftId) => ['catalog', 'nft', nftId] // pública
}
cart: (scope) => ['cart', scope]
orders: (scope) => ['orders', scope]
order: (scope, orderId) => ['orders', scope, orderId]
wallets: (scope) => ['wallets', scope]
profile: (scope) => ['profile', scope]
```

Princípios:

- **Público × privado.** Catálogo não muda por usuário e não precisa ser
  refeito no login. Tudo que é do usuário leva `scope`.
- **Catálogo por consulta.** A chave inclui busca, coleção, faixa, aba,
  ordenação, página e tamanho; a API retorna o total filtrado e só os itens da
  página. Resposta antiga de outra busca permanece em outra chave.
- **O cache é a única fonte para tempo real.** Eventos de socket **não** entram
  em `useState`: eles escrevem no cache (`setQueriesData`) sob guarda de
  `version`. Assim, uma tela que acabou de montar já lê o valor mais recente.
- **Invalidação em vez de edição manual.** Depois de `POST /orders`, o carrinho
  e a lista de pedidos são invalidados — é o que sincroniza o contador do
  cabeçalho e a tela de carrinho, já que o servidor esvaziou o carrinho.

Padrões de carregamento: as telas usam **skeletons com shimmer** (`shimmer` no
`index.css`) enquanto `isPending`, e um estado de erro com `role="alert"` +
`apiErrorMessage` quando falham.

## Reconciliação REST ↔ Socket.IO

Os dois canais descrevem os mesmos dados. A regra que os mantém coerentes:

1. **Escrita vem sempre do REST.** Toda mutação (carrinho, pedido) é confirmada
   pela resposta HTTP. O socket nunca “decide” um estado.
2. **Leitura é enriquecida pelo socket.** `nft.updated` atualiza preço e
   disponibilidade nos caches de lista/detalhe; consultas sensíveis a preço ou
   listagem são revalidadas. Carrinho/checkout assinam seus itens e reconciliam
   snapshot e totais pela API.
3. **Guarda de versão.** O payload traz `version`; o cliente ignora versão
   menor ou igual. Após reconectar, REST reconcilia as mudanças perdidas.
4. **Assinatura por tela.** `useMarketSubscription(ids)` assina IDs visíveis e
   reenvia subscriptions em cada `connect`; cleanup cancela ao desmontar.
5. **Reservas e pedidos.** `cart:reservation-expired` invalida o carrinho;
   `order.updated` invalida recibo/lista. Pedido pendente faz polling REST até
   estado terminal (`settled` ou `failed`).

## Preços e arredondamento

`shared/lib/pricing.ts` é usado pelo mock (que calcula a cotação oficial) **e**
pela UI (que exibe) — os dois precisam concordar.

- Soma dos itens sem taxa: `subtotalEth`.
- Taxa de serviço: **0,06% do subtotal**, arredondada a 3 casas, com **piso de
  0,001 ETH**. Reproduz o print de referência:
  `26,83 (subtotal) + 0,016 (taxa) = 26,846 (total)`.
- Aritmética com `decimal.js`; **nunca** com ponto flutuante binário.
- Exibição (`formatEth`): separador decimal **ponto**, **sem** agrupamento de
  milhar, zeros à direita removidos (`"1.19"`, `"26.846"`). A etiqueta de faixa
  de preço do Figma mantém a vírgula, por fidelidade ao design.

## Rotas e apresentação

| Rota                   | Tela                 | Observações                                                                                                          |
| ---------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/`                    | Início               | Vitrine com filtros combinados, ordenação e paginação server-side (`PAGE_SIZE = 9`).                                 |
| `/nft/:nftId`          | Detalhe              | Abas “Detalhes do NFT” / “Avaliações”; ação COMPRAR.                                                                 |
| `/cart`                | Carrinho             | Tabela no desktop, cartões no celular; quantidade, cupom e resumo.                                                   |
| `/checkout`            | Pagamento            | Dados revisáveis, rede/carteira, resumo e pedido; bloqueia preço/disponibilidade obsoletos. Protegida.               |
| `/order/:orderId`      | Confirmação          | **Rota endereçável.** Diálogo no desktop, página no celular. Confirma só em `settled`; pendente/recusado explícitos. |
| `/login`, `/register`  | Entrar / Criar conta | Diálogo com scrim + foco preso no desktop; página no celular. `?redirect=` preservado.                               |
| `/profile`, `/wallets` | Perfil / Carteiras   | Protegidas; **editáveis** (nome, handle, avatar, senha; carteiras CRUD).                                             |
| `/favorites`           | Favoritos            | Protegida; lista por usuário, toggle otimista.                                                                       |
| `*`                    | 404                  | “saiu do acervo”.                                                                                                    |

Decisões de casco:

- **Guarda de rota em componente** (`<RequireAuth>`), e **não** em `beforeLoad`:
  num refresh, o `beforeLoad` roda antes de o `SessionProvider` montar e a
  sessão ainda está vazia — o guarda em componente espera a sessão decidir.
- **Código de rota com `React.lazy` + `<Suspense>`** no `Outlet`: cada tela é um
  chunk.
- **Rodapé por página** (Início, Detalhe, Carrinho, Pagamento), não no layout
  raiz — Perfil/Carteiras/Login não o têm no Figma.
- **Navegação no celular** é barra inferior; no desktop, no cabeçalho. A
  navegação está sempre no DOM e é operável por teclado.

## Acessibilidade e responsividade

- “Pular para o conteúdo” é o primeiro elemento focável.
- Formulários com `<label htmlFor>` (ou `FormLabel` do shadcn, que injeta
  `id`/`htmlFor`). Erros com `role="alert"`.
- Diálogos Radix: foco preso, ESC fecha, fundo com `aria-hidden`.
- Botões de ícone têm `aria-label` (`QtyStepper`, “Copiar link”, favoritar).
- Imagens com `alt`; a arte do NFT usa o próprio nome.
- Layout verificado em **390 / 768 / 1440** (projetos `mobile`/`desktop` no
  Playwright). O desktop usa o container de 1200 px do Figma.

## Testes

- **E2E (Playwright)** roda contra o **bundle de produção** (`build` + `preview`)
  — é a única forma de provar deep link, refresh e o rewrite de SPA. Projetos
  `desktop` (1440×900) e `mobile` (Pixel 5).
  - `catalog.spec.ts` — REST → cache → tela, tempo real, detalhe, 404, refresh.
  - `purchase.spec.ts` — soma/taxa/total, quantidade, remoção, gate de login,
    pedido confirmado pelo servidor.
  - `auth.spec.ts` — login, rótulos, `?redirect=`, guarda, refresh, cadastro,
    logout, isolamento entre contas.
  - `profile.spec.ts` / `wallets.spec.ts` — edição de perfil, senha, avatar;
    carteiras (adicionar, principal, renomear, remover).
  - `coupon.spec.ts` / `favorites.spec.ts` — cupons; favoritos otimistas, com
    persistência no F5 e rollback.
  - `checkout-errors.spec.ts` / `checkout-stale.spec.ts` / `session-expiry.spec.ts`
    — falha 502 + recuperação, idempotência, cotação obsoleta, sessão expirada.
  - `realtime.spec.ts` / `isolation.spec.ts` — evento repetido/fora de ordem;
    troca de usuário isolando dados e reautenticando o socket.
  - `skeletons.spec.ts` / `visual.spec.ts` / `layout.spec.ts` / `keyboard.spec.ts`
    — shimmer, regressão visual versionada, overflow, teclado/foco.
- Os testes de soma usam o cenário **`frozen-prices`** (sem fluidez de preço)
  para asserções exatas; o teste de tempo real usa o padrão vivo.

## Limitações e desvios conscientes

O que é simulado, recortado ou diferente do Figma — de propósito, dentro do
orçamento do desafio:

### Dados e mock

- **Persistência do mock.** Contas e hashes de senha, perfil, carteiras,
  carrinho, favoritos, pedidos e chaves de idempotência são guardados por usuário
  no `localStorage`. Senha em claro nunca é persistida. Preço/disponibilidade do
  mercado reinicia dos fixtures; `POST /__mock__/reset` limpa o estado salvo e
  retorna ao cenário feliz.
- **Controles simulados com aviso, sem ação morta**: apenas login social
  (Google/Facebook) e recuperação de senha mostram um toast explicativo.
- **Avatar** é escolha entre presets (`public/avatars/avatar-*.svg`) ou URL —
  não é upload de arquivo, e vazio cai nas iniciais.
- **ETH fictício.** Os saldos e endereços são de fixture.
- **Pagamento simulado.** Dados do colecionador, rede e observação são
  revisáveis e entram no snapshot do pedido. Conexão/recusa/desconexão de
  carteira são cenários locais, sem extensão ou transação on-chain.

### Decisões das correções (Fases 1–3 do brief)

- **Update otimista (favoritos).** `useFavorites` escreve no cache antes da
  resposta e reverte em erro. A **intenção** (`{ nftId, save }`) é decidida no
  clique, não no momento da falha — evita reverter para o estado "errado" se o
  usuário clicar duas vezes.
- **Cupom.** O desconto entra **antes** da taxa de serviço (a taxa incide sobre
  o líquido). Percentuais arredondados a 3 casas; desconto guardado como ETH
  positivo e exibido como `(-)`.
- **Expiração de sessão.** O interceptor de 401 dispara um evento DOM
  (`kurio:unauthorized`); o `SessionProvider` derruba a identidade, limpa o
  cache e descarta o socket. O `<RequireAuth>` então manda ao login guardando o
  destino — a retomada de contexto é consequência de um fluxo só.
- **Cotação obsoleta.** O checkout assina os preços; se a versão de um item
  ficar atrás da versão viva, a confirmação é bloqueada com um aviso e um botão
  "Recotar preços". O servidor repete a checagem (`409 stale_quote`) — o cliente
  é conveniência, o servidor é a verdade.
- **Idempotência.** `POST /orders` deduplica por `idempotencyKey`: um timeout do
  cliente seguido de nova tentativa devolve **o mesmo** pedido, não um segundo.
  Reuso com payload diferente retorna `409 idempotency_conflict`; o recibo de
  sucesso só aparece após `settled`, e estados `pending`/`failed` são explícitos.
- **Socket na troca de usuário.** Logout/expiração descartam o socket
  (`disposeMarketSocket`); a nova sessão reconecta e autentica. Nenhum dado do
  usuário anterior sobrevive à troca. Reconexão transitória reautentica,
  reinscreve IDs ativos e invalida snapshots REST.
- **Carregamento.** Arte em WebP (768²), CSS crítico **inline** e
  `modulepreload` do chunk do MSW — as três otimizações medidas em
  `VERIFICACAO.md` §17. Feitas sem colocar o app numa condição em que ele não
  funciona sem o mock.

### Fidelidade ao Figma

- **Arte do catálogo.** As 4 ilustrações foram convertidas para **WebP** (768²) e
  reaproveitadas entre 27 itens (três edições por obra-base). Os nomes
  seguem os fixtures (`Emerald Ape #042` etc.) em vez dos nomes-placeholder do
  arquivo.
- **Ícones.** Alguns foram extraídos dos caminhos SVG do Figma; o restante usa
  equivalentes do `lucide-react` posicionados como no design.
- **Footer (frames 100/101).** Os três diferenciais com selos W/C/D e a
  newsletter compartilham uma única faixa; campo e botão ficam acoplados como no
  componente de referência. O formulário é demonstrativo e informa que nada é
  enviado.
- **Compartilhar NFT (frame 165).** LinkedIn, e-mail e Twitter aparecem como
  ícones inline sem moldura de botão; as ações usam destinos padrão de
  compartilhamento, sem inventar perfis da marca.
- **Tipografia.** Roboto Mono é a fonte única do app; eventuais diferenças de
  pesos/corpo em relação ao arquivo são mínimas e deliberadas.
- **Casos “diálogo × página”.** No Figma, login/cadastro e a confirmação são
  quadros. No app, são **rotas endereçáveis** que se desenham como diálogo em
  telas largas e como página no celular — preserva deep link e refresh.
- **Texto de marketing** do rodapé e da newsletter é local; o envio de e-mail
  não existe (o formulário valida e confirma, sem rede).

### Recortes de escopo (2 dias)

- Sem i18n (copy em pt-BR), sem tema claro/escuro e sem PWA; a indisponibilidade
  de rede existe como cenário de teste do MSW, não como suporte offline.
- **Lighthouse** é executado sobre o build de produção, com 3 medições por
  tela/perfil e mediana (ver `README.md` e `VERIFICACAO.md` §17). A performance
  mobile fica abaixo de 90 por causa do backend simulado no navegador
  (justificativa em `VERIFICACAO.md` §17.1); desktop fica em 98. A11y, Best
  Practices e SEO ficaram em 100 nos perfis medidos. O painel de cenários não é
  otimizado para produção.
- Recomendação: **revogar o token do Figma** usado durante a extração de
  referência (Figma → Settings → Security) — ele não é necessário para rodar o
  projeto.

---

## Estado de busca na URL (vitrine)

O enunciado exige que **busca, filtros, ordenação e paginação** componham o
estado da URL e sobrevivam a refresh e ao histórico. Por isso nada disso é
`useState`: a rota `/` tem `validateSearch` (`features/catalog/search.ts`) e as
telas escrevem via `navigate({ search })`.

- Parâmetros: `q`, `colecao`, `min`, `max`, `aba` (`todos|novos|alta`), `ordem`
  (`recent|price-asc|price-desc|name`) e `pagina` (1-based).
- Todos os parâmetros são enviados à API (`GET /nfts`): busca, coleção, faixa,
  aba, ordenação, página e tamanho. O servidor filtra/ordena antes de paginar.
- Mudança de filtro/ordenação **reseta a paginação** (`pagina` sai da URL).
- Filtros discretos criam entrada no histórico; digitação da busca substitui a
  URL intermediária para não gerar uma entrada por caractere.
- A chave do cache inclui todos os filtros e página; `nft.updated` atualiza
  caches aplicáveis e revalida consultas cujo resultado mudou.

O controle da faixa é um **slider de duas alças** (`type="range"`), mantendo os
limites do Figma (`0,02–12,30 ETH`). As alças têm nomes e valor textual para
leitor de tela; setas/Home/End funcionam por teclado. O teste valida que alterar
a alça atualiza o filtro, a URL e sobrevive a refresh.

## Persistência do carrinho visitante

`src/mocks/data/cart-store.ts` persiste snapshots de carrinho/cupom em
`localStorage` (`kurio:mock-carts`) indexados por identidade (`guest` ou id de
usuário). No boot o MSW valida os snapshots com `cartSchema`, descarta reservas
expiradas e restaura timers pelo `expiresAt`. Assim o visitante pode adicionar
vários NFTs, dar refresh e depois autenticar: `adoptGuestCart()` mescla seus
itens na conta sem apagar os anteriores. `POST /__mock__/reset` apaga também
esse armazenamento.

## Casca responsiva (desktop × celular)

O Figma desenha desktop e celular como composições **diferentes**, então a casca
também é:

- **Desktop (≥768px):** cabeçalho com marca à esquerda, navegação editorial
  (`Início / Mercado / Criadores / Aprenda`) centralizada no viewport e conta à
  direita. A lupa abre uma busca global sob o ícone, com resultados conforme a
  digitação; o restante da página recebe blur e o ícone fica destacado. O item
  ativo fica laranja com sublinhado; o status Socket.IO não é exibido
  visualmente. Fundo = canvas.
- **Celular (<768px):** sem cabeçalho global — **cada tela monta seu topo**
  (`MobileTopBar` para título; busca + filtros na vitrine; botões flutuantes no
  detalhe). A navegação vive na barra inferior com ícones
  (`Início / Favoritos / Carrinho (FAB) / Carteiras / Perfil`).
- A rota **`/favorites`** é nova e protegida; o coração dos cartões usa update
  otimista. No celular, o "Sair" fica no perfil (o cabeçalho não existe lá).
- No celular a vitrine usa **masonry de 2 colunas** com a coluna direita
  deslocada 32px (escadinha do Figma); no desktop, 3 colunas alinhadas.
- O hero mobile usa círculos de gradiente fixos (elipses 49/50 do Figma) atrás
  do conteúdo e um carrossel manual de 3 slides, cada um com duas obras; só os
  dots controlam a troca, os círculos permanecem no mesmo lugar.

## Cartões e favoritos

- `NftCard`: arte em quadro arredondado, selo ("RARO") e coração **sobrepostos**
  à imagem, nome e **preço em laranja** abaixo — sem moldura em volta do texto.
- `FavoriteButton`: ícone de **coração** (antes estrela), com `aria-pressed`.

## Rodapé

O rodapé reproduz os ícones sociais (Facebook, Instagram, Twitter, LinkedIn e
YouTube) e as marcas de carteiras compatíveis (MetaMask, WalletConnect e
Coinbase). Como os perfis sociais oficiais da Kurio não foram fornecidos, os
ícones são informativos, não links que aparentem levar a contas oficiais. A
frase técnica de implementação não aparece na interface.
