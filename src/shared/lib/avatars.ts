/** Avatares prontos para escolher no perfil. Ficam em `public/avatars/`. */
export interface AvatarPreset {
  id: string
  label: string
  url: string
}

export const AVATAR_PRESETS: AvatarPreset[] = Array.from({ length: 6 }, (_, index) => {
  const number = index + 1
  return {
    id: `avatar-${number}`,
    label: `Avatar ${number}`,
    url: `/avatars/avatar-${number}.svg`,
  }
})

/** Iniciais do nome — o fallback quando o perfil não tem avatar. */
export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'K'
  )
}
