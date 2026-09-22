import type { Avatar } from '../engine/types';

export const SKINS = ['#f5d0b5', '#e0ac85', '#b97a56', '#7a4a2e', '#4b2e1e'];
export const HAIRS = ['#2b2118', '#6b4423', '#c9a15b', '#b24a1f', '#9a9a9a', 'none'];
export const SHIRTS = ['#1f2d4d', '#c0392b', '#1f6f43', '#555b66', '#7b4bb3'];

/** Rudimentaire avatar in SVG: hoofd, haar, trui. */
export function avatarSvg(a: Pick<Avatar, 'skin' | 'hair' | 'shirt'>, size = 72): string {
  const skin = SKINS[a.skin] ?? SKINS[0];
  const hair = HAIRS[a.hair] ?? HAIRS[0];
  const shirt = SHIRTS[a.shirt] ?? SHIRTS[0];
  const hairPath = hair === 'none' ? '' : `<path d="M22 34 Q22 14 40 14 Q58 14 58 34 Q54 24 40 24 Q26 24 22 34Z" fill="${hair}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 80 80" class="avatar" aria-hidden="true">
    <rect width="80" height="80" rx="16" fill="var(--avatar-bg)"/>
    <path d="M14 80 Q14 58 40 58 Q66 58 66 80Z" fill="${shirt}"/>
    <rect x="34" y="48" width="12" height="12" fill="${skin}"/>
    <ellipse cx="40" cy="36" rx="17" ry="19" fill="${skin}"/>
    ${hairPath}
    <circle cx="34" cy="37" r="2" fill="#222"/><circle cx="46" cy="37" r="2" fill="#222"/>
    <path d="M34 45 Q40 49 46 45" stroke="#222" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </svg>`;
}
