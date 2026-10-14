import type { Nft, Collection } from '@/shared/contracts/catalog'
import type { User } from '@/shared/contracts/auth'
import type { Wallet } from '@/shared/contracts/wallet'

/**
 * O "mundo" fictício do marketplace: catálogo, coleções, pessoas e carteiras.
 *
 * É a fonte única de verdade dos mocks REST e de tempo real. Tudo aqui é
 * determinístico (sem `Math.random()`), para que os testes E2E possam prever o
 * que a tela mostra.
 */

/** As quatro obras disponíveis. São reutilizadas entre 27 itens do catálogo. */
export const ART_KEYS = ['art-1', 'art-2', 'art-3', 'art-4'] as const
export type ArtKey = (typeof ART_KEYS)[number]

export const artUrl = (key: ArtKey): string => `/art/${key}.webp`

/**
 * Hash SHA-256 de `"password"`.
 *
 * A senha dos usuários fictícios é literalmente `password`. Guardamos o hash,
 * não o texto: é assim que um backend de verdade se comporta, e evita que a
 * senha apareça no bundle. (É um mock — isto NÃO é segurança de produção.)
 */
export const DEMO_PASSWORD = 'password'
export const DEMO_PASSWORD_SHA256 =
  '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'

const ZERO = '0x0000000000000000000000000000000000000000' as const
export const MARKET_ADDRESS = ZERO

export const collections: Collection[] = [
  {
    id: 'kurio-apes',
    name: 'Kurio Apes',
    description: 'Retratos generativos da primeira coleção do Kurio.',
    coverUrl: artUrl('art-1'),
    itemCount: 3,
    floorPriceEth: '0.87',
    volumeEth: '412.5',
  },
  {
    id: 'neon-fauna',
    name: 'Neon Fauna',
    description: 'Bichos imaginários pintados em luz.',
    coverUrl: artUrl('art-2'),
    itemCount: 3,
    floorPriceEth: '0.64',
    volumeEth: '188.02',
  },
  {
    id: 'aurora-relics',
    name: 'Aurora Relics',
    description: 'Fragmentos de um mundo que nunca existiu.',
    coverUrl: artUrl('art-3'),
    itemCount: 3,
    floorPriceEth: '1.05',
    volumeEth: '903.71',
  },
]

/**
 * Os nove NFTs-base. O preço inicial é ponto de partida: quem manda no valor
 * "vivo" é o `market-state`, que também alimenta o tempo real.
 */
export const nftSeeds: Nft[] = [
  {
    id: 'emerald-ape-042',
    name: 'Emerald Ape #042',
    description: 'Um dos primeiros primatas da coleção Kurio Apes, banhado em esmeralda.',
    imageUrl: artUrl('art-1'),
    collectionId: 'kurio-apes',
    collectionName: 'Kurio Apes',
    priceEth: '1.19',
    listed: true,
    edition: '1 de 1',
    ownerAddress: '0x7Ac3F1b2D9e845a0C6B4f2E1d8A75C3091bE6f42',
    ownerName: 'Alice Nakamura',
    creatorAddress: '0x2B41c8Ea907d6F3a5c1E84b0D9f7A236C5e810BD',
    creatorName: 'Estúdio Kurio',
    traits: [
      { name: 'Fundo', value: 'Floresta' },
      { name: 'Olhos', value: 'Laser' },
      { name: 'Pelagem', value: 'Esmeralda' },
      { name: 'Acessório', value: 'Coroa' },
    ],
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'crimson-ape-118',
    name: 'Crimson Ape #118',
    description: 'Pintado em vermelho-carmim, o mais temperamental da coleção.',
    imageUrl: artUrl('art-1'),
    collectionId: 'kurio-apes',
    collectionName: 'Kurio Apes',
    priceEth: '2.45',
    listed: true,
    edition: '1 de 1',
    ownerAddress: '0x9fE2a1C48b7D3056eA19c4F0b832D7e5A6C104fb',
    ownerName: 'Bob Okafor',
    creatorAddress: '0x2B41c8Ea907d6F3a5c1E84b0D9f7A236C5e810BD',
    creatorName: 'Estúdio Kurio',
    traits: [
      { name: 'Fundo', value: 'Vulcão' },
      { name: 'Olhos', value: 'Fechados' },
      { name: 'Pelagem', value: 'Carmim' },
      { name: 'Acessório', value: 'Fone' },
    ],
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'onyx-ape-007',
    name: 'Onyx Ape #007',
    description: 'Esculpido em ônix. O mais silencioso e o mais raro.',
    imageUrl: artUrl('art-1'),
    collectionId: 'kurio-apes',
    collectionName: 'Kurio Apes',
    priceEth: '0.87',
    listed: true,
    edition: '1 de 1',
    ownerAddress: '0x7Ac3F1b2D9e845a0C6B4f2E1d8A75C3091bE6f42',
    ownerName: 'Alice Nakamura',
    creatorAddress: '0x2B41c8Ea907d6F3a5c1E84b0D9f7A236C5e810BD',
    creatorName: 'Estúdio Kurio',
    traits: [
      { name: 'Fundo', value: 'Noite' },
      { name: 'Olhos', value: 'Âmbar' },
      { name: 'Pelagem', value: 'Ônix' },
      { name: 'Acessório', value: 'Nenhum' },
    ],
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'neon-fox-231',
    name: 'Neon Fox #231',
    description: 'Uma raposa de luz atravessando a cidade.',
    imageUrl: artUrl('art-2'),
    collectionId: 'neon-fauna',
    collectionName: 'Neon Fauna',
    priceEth: '0.64',
    listed: true,
    edition: '1 de 1',
    ownerAddress: '0x9fE2a1C48b7D3056eA19c4F0b832D7e5A6C104fb',
    ownerName: 'Bob Okafor',
    creatorAddress: '0x5C8d19F2a0B7e34C6D815f9A2e0B7c43F19A6d80',
    creatorName: 'Haruna Ito',
    traits: [
      { name: 'Fundo', value: 'Cidade' },
      { name: 'Brilho', value: 'Ciano' },
      { name: 'Caudas', value: '3' },
    ],
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'neon-lynx-088',
    name: 'Neon Lynx #088',
    description: 'Um lince feito de néon violeta, à espreita.',
    imageUrl: artUrl('art-2'),
    collectionId: 'neon-fauna',
    collectionName: 'Neon Fauna',
    priceEth: '1.72',
    listed: true,
    edition: '1 de 1',
    ownerAddress: '0x7Ac3F1b2D9e845a0C6B4f2E1d8A75C3091bE6f42',
    ownerName: 'Alice Nakamura',
    creatorAddress: '0x5C8d19F2a0B7e34C6D815f9A2e0B7c43F19A6d80',
    creatorName: 'Haruna Ito',
    traits: [
      { name: 'Fundo', value: 'Cidade' },
      { name: 'Brilho', value: 'Violeta' },
      { name: 'Olhos', value: 'Duplos' },
    ],
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sable-owl-054',
    name: 'Sable Owl #054',
    description: 'Uma coruja que só aparece quando o mundo dorme.',
    imageUrl: artUrl('art-3'),
    collectionId: 'neon-fauna',
    collectionName: 'Neon Fauna',
    priceEth: '3.08',
    listed: true,
    edition: '1 de 1',
    ownerAddress: '0xD4a7B2E1c985F063a4B7d129E0c85F3462aB91d7',
    ownerName: 'Coleção Kurio',
    creatorAddress: '0x5C8d19F2a0B7e34C6D815f9A2e0B7c43F19A6d80',
    creatorName: 'Haruna Ito',
    traits: [
      { name: 'Fundo', value: 'Crepúsculo' },
      { name: 'Brilho', value: 'Âmbar' },
      { name: 'Asas', value: 'Abertas' },
    ],
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'aurora-relic-001',
    name: 'Aurora Relic #001',
    description: 'O primeiro fragmento encontrado sob a aurora.',
    imageUrl: artUrl('art-3'),
    collectionId: 'aurora-relics',
    collectionName: 'Aurora Relics',
    priceEth: '5.50',
    listed: true,
    edition: '1 de 1',
    ownerAddress: '0x7Ac3F1b2D9e845a0C6B4f2E1d8A75C3091bE6f42',
    ownerName: 'Alice Nakamura',
    creatorAddress: '0x1E60b9F3a2C7d548B0a16F4e93c2D7b85A0f19Ec',
    creatorName: 'Vera Lindqvist',
    traits: [
      { name: 'Origem', value: 'Aurora Boreal' },
      { name: 'Material', value: 'Cristal' },
      { name: 'Raridade', value: 'Lendária' },
    ],
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'aurora-relic-014',
    name: 'Aurora Relic #014',
    description: 'Um fragmento menor, mas com a mesma luz por dentro.',
    imageUrl: artUrl('art-4'),
    collectionId: 'aurora-relics',
    collectionName: 'Aurora Relics',
    priceEth: '1.05',
    listed: true,
    edition: '1 de 1',
    ownerAddress: '0x9fE2a1C48b7D3056eA19c4F0b832D7e5A6C104fb',
    ownerName: 'Bob Okafor',
    creatorAddress: '0x1E60b9F3a2C7d548B0a16F4e93c2D7b85A0f19Ec',
    creatorName: 'Vera Lindqvist',
    traits: [
      { name: 'Origem', value: 'Aurora Austral' },
      { name: 'Material', value: 'Vidro' },
      { name: 'Raridade', value: 'Rara' },
    ],
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ember-relic-202',
    name: 'Ember Relic #202',
    description: 'Ainda quente ao toque, como se tivesse acabado de cair.',
    imageUrl: artUrl('art-4'),
    collectionId: 'aurora-relics',
    collectionName: 'Aurora Relics',
    priceEth: '2.96',
    listed: true,
    edition: '1 de 1',
    ownerAddress: '0xD4a7B2E1c985F063a4B7d129E0c85F3462aB91d7',
    ownerName: 'Coleção Kurio',
    creatorAddress: '0x1E60b9F3a2C7d548B0a16F4e93c2D7b85A0f19Ec',
    creatorName: 'Vera Lindqvist',
    traits: [
      { name: 'Origem', value: 'Forja' },
      { name: 'Material', value: 'Obsidiana' },
      { name: 'Raridade', value: 'Épica' },
    ],
    version: 1,
    updatedAt: new Date().toISOString(),
  },
]

/** Mais duas edições determinísticas de cada obra para exercitar paginação real. */
nftSeeds.push(
  ...nftSeeds.flatMap((source, sourceIndex) =>
    [2, 3].map((edition) => ({
      ...source,
      id: `${source.id}-edition-${edition}`,
      name: `${source.name} · Edição ${edition}`,
      description: `${source.description} Edição de arquivo ${edition}.`,
      priceEth: (Number(source.priceEth) + sourceIndex * 0.13 + edition * 0.07).toFixed(2),
      version: 1,
      updatedAt: new Date().toISOString(),
      traits: source.traits.map((trait) => ({ ...trait })),
    })),
  ),
)

for (const collection of collections) collection.itemCount = 9

/**
 * Os dois colecionadores fictícios.
 *
 * As senhas são o hash de `password` (veja `DEMO_PASSWORD_SHA256`).
 */
export const users: User[] = [
  {
    id: 'user-alice',
    handle: 'alice.nakamura',
    displayName: 'Alice Nakamura',
    email: 'alice@jungle.dev',
    avatarUrl: '/avatars/alice.svg',
    walletAddress: '0x7Ac3F1b2D9e845a0C6B4f2E1d8A75C3091bE6f42',
    bio: 'Colecionadora de primatas generativos. Curitiba, BR.',
    stats: { owned: 4, collections: 3, volumeEth: '18.42' },
  },
  {
    id: 'user-bob',
    handle: 'bob.okafor',
    displayName: 'Bob Okafor',
    email: 'bob@jungle.dev',
    avatarUrl: '/avatars/bob.svg',
    walletAddress: '0x9fE2a1C48b7D3056eA19c4F0b832D7e5A6C104fb',
    bio: 'Caçador de raridades em Neon Fauna. Lagos, NG.',
    stats: { owned: 3, collections: 2, volumeEth: '9.77' },
  },
]

export const walletsByUserId: Record<string, Wallet[]> = {
  'user-alice': [
    {
      id: 'wallet-alice-primary',
      label: 'Carteira principal',
      address: '0x7Ac3F1b2D9e845a0C6B4f2E1d8A75C3091bE6f42',
      chain: 'Ethereum',
      balanceEth: '12.408',
      isPrimary: true,
    },
    {
      id: 'wallet-alice-ledger',
      label: 'Ledger Nano',
      address: '0xC3a90B7d21E6f845A0c1E9b4D7f230A6852c19F4',
      chain: 'Ethereum',
      balanceEth: '4.02',
      isPrimary: false,
    },
  ],
  'user-bob': [
    {
      id: 'wallet-bob-primary',
      label: 'Carteira principal',
      address: '0x9fE2a1C48b7D3056eA19c4F0b832D7e5A6C104fb',
      chain: 'Ethereum',
      balanceEth: '6.771',
      isPrimary: true,
    },
  ],
}

export const findUserByEmail = (email: string): User | undefined =>
  users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase())

export const findUserById = (id: string): User | undefined => users.find((user) => user.id === id)
