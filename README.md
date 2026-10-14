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

## Conta demonstrativa

- E-mail: `alice@jungle.dev`
- Senha: `password`

Também é possível criar uma conta local pelo próprio app. Os dados são
demonstrativos e ficam no navegador.
