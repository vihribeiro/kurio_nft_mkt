# Kurio — Marketplace de NFTs

Marketplace demonstrativo de NFTs, responsivo e baseado no protótipo do desafio.
O front-end usa dados locais reproduzíveis, sem exigir serviços privados, chaves
ou banco de dados.

- **Aplicação publicada:** https://kurio-nft-marketplace-chi.vercel.app
- **Stack:** React, TypeScript, Vite, Tailwind CSS, TanStack Router/Query e MSW.
- **Funcionalidades:** catálogo com filtros e paginação, detalhe de NFT,
  favoritos, carrinho, checkout, pedidos, conta, perfil e carteiras.
- **Tempo real:** preços e disponibilidade simulados por Socket.IO.

## Executar localmente

Requer Node.js 20.19 ou superior.

```bash
npm ci
npm run dev
```

O app fica disponível em <http://localhost:5173>. Não é necessário configurar
variáveis de ambiente.

## Verificações

```bash
npm run build       # tipos e build de produção
npm run lint        # ESLint
npm test            # testes unitários
npx playwright install chromium  # uma vez, para os testes E2E
npm run e2e         # testes de fluxos desktop e mobile
```

## Cenários reproduzíveis

Os cenários são selecionados pelo mock, sem alterar o código. Para controlar o
mock da aplicação publicada ou local, abra o app, use o console do navegador e
execute:

```js
const api = 'https://api.kurio.local'

// Consultar o cenário atual e os cenários disponíveis.
await fetch(`${api}/__mock__/state`).then((response) => response.json())

// Ativar uma falha ou condição de rede; depois, recarregar a página.
await fetch(`${api}/__mock__/scenario`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'checkout-error' }),
})

// Restaurar fixtures, estado local e caminho feliz.
await fetch(`${api}/__mock__/reset`, { method: 'POST' }).then((response) => response.json())
```

Os comandos precisam ser executados no console da própria página para que o
Mock Service Worker intercepte a API fictícia. Cenários disponíveis:

| Cenário                             | Como reproduzir                                         | Resultado esperado                                       |
| ----------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| `happy-path`                        | Recarregue a página.                                    | Fluxo normal, com preços atualizados em tempo real.      |
| `empty-catalog`                     | Abra o catálogo.                                        | Estado vazio.                                            |
| `checkout-error`                    | Entre, adicione um NFT ao carrinho e confirme a compra. | O pedido falha com HTTP 502.                             |
| `payment-declined`                  | Repita o checkout com este cenário.                     | Pedido recusado; itens permanecem no carrinho.           |
| `wallet-disconnected`               | Repita o checkout com este cenário.                     | Erro de carteira desconectada; a compra não é concluída. |
| `slow-network` / `variable-network` | Recarregue catálogo ou detalhe.                         | Skeletons e latência fixa ou variável.                   |
| `network-offline`                   | Recarregue o catálogo e use tentar novamente.           | Erro de rede seguido da opção de retry.                  |
| `frozen-prices`                     | Abra catálogo, carrinho ou checkout.                    | Preços estáveis para totais determinísticos.             |
| `favorites-error`                   | Clique no botão de favorito de um NFT.                  | A falha desfaz a atualização otimista.                   |

Checkout requer uma conta e um NFT no carrinho. Para retornar ao estado inicial,
use `POST /__mock__/reset`.

## Auditoria Lighthouse

Os relatórios HTML/JSON e as medianas das três execuções estão em
[`docs/lighthouse/`](./docs/lighthouse). Para reproduzir, gere o build e inicie
o preview em outro terminal:

| Página  | Perfil  | Performance | Acessibilidade | Boas práticas | SEO |
| ------- | ------- | ----------: | -------------: | ------------: | --: |
| Início  | Desktop |          98 |            100 |           100 | 100 |
| Início  | Mobile  |          78 |            100 |           100 | 100 |
| Detalhe | Desktop |          98 |            100 |           100 | 100 |
| Detalhe | Mobile  |          76 |            100 |           100 | 100 |

Valores de performance são medianas de três execuções por tela e perfil; os
relatórios individuais e métricas completas estão no diretório acima. A
justificativa para a performance mobile abaixo de 90 está em
[`VERIFICACAO.md`](./VERIFICACAO.md#171-justificativa-formal--performance-mobile-abaixo-de-90-opcao-b).

```bash
npm run build
npm run preview
```

Execute Lighthouse para início/detalhe, em mobile e desktop. Repita cada
combinação três vezes, usando sufixos `-1`, `-2` e `-3` no caminho de saída:

```bash
npx lighthouse http://localhost:4173/ \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json,html --output-path=docs/lighthouse/inicio-mobile-1

npx lighthouse http://localhost:4173/ --preset=desktop \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json,html --output-path=docs/lighthouse/inicio-desktop-1

npx lighthouse http://localhost:4173/nft/emerald-ape-042 \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json,html --output-path=docs/lighthouse/detalhe-mobile-1

npx lighthouse http://localhost:4173/nft/emerald-ape-042 --preset=desktop \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json,html --output-path=docs/lighthouse/detalhe-desktop-1
```

## Documentação técnica

- [Arquitetura, contratos REST/Socket.IO e decisões](./ARCHITECTURE.md)
- [Verificação dos requisitos, cenários E2E e auditoria](./VERIFICACAO.md)
- [Resultados Lighthouse e relatórios](./docs/lighthouse/medians.json)

## Conta demonstrativa

- E-mail: `alice@jungle.dev`
- Senha: `password`

Também é possível criar uma conta local pelo próprio app. Os dados são
demonstrativos e ficam no navegador.
