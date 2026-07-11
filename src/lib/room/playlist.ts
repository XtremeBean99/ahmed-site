export interface Track {
  id: string
  title: string
  artist?: string
  src: string
  cover?: string
}

export const PLAYLIST: Track[] = [
  {
    id: 'lo-fi-beat',
    title: 'Lo‑Fi Beat',
    src: '/audio/lo-fi-beat.mp3',
  },
  {
    id: 'saffron',
    title: 'Saffron',
    src: '/audio/saffron.mp3',
    cover: '/audio/covers/saffron.jpg',
  },
  {
    id: 'cant-look-in-my-eyes',
    title: "Can't Look In My Eyes",
    src: '/audio/cant-look-in-my-eyes.mp3',
    cover: '/audio/covers/cant-look-in-my-eyes.jpg',
  },
  {
    id: 'big-poppa-habaytak',
    title: 'Big Poppa x حبيتك بالصيف',
    artist: 'Biggie X Fairuz (Abuzeid Remix)',
    src: '/audio/big-poppa-habaytak-remix.mp3',
    cover: '/audio/covers/fayrouz.jpg',
  },
  {
    id: 'remember-summer-days',
    title: 'Remember Summer Days',
    src: '/audio/remember-summer-days.mp3',
    cover: '/audio/covers/summer-days.jpg',
  },
  {
    id: 'sky-restaurant',
    title: 'Sky Restaurant',
    src: '/audio/sky-restaurant.mp3',
    cover: '/audio/covers/sky-restaurant.jpg',
  },
  {
    id: 'teresa-no-tameiki',
    title: 'Teresa no Tameiki',
    artist: 'Yasushi Miyagawa',
    src: '/audio/teresa-no-tameiki.mp3',
    cover: '/audio/covers/teresa-no-tameiki.jpg',
  },
  {
    id: 'fall-in-love',
    title: '(You And Me Still Keep On) Fall In Love',
    artist: 'Mai Yamane',
    src: '/audio/fall-in-love.mp3',
    cover: '/audio/covers/fall-in-love.jpg',
  },
  {
    id: 'hako-is-alive',
    title: 'Hako Is Alive and She Is 59',
    src: '/audio/hako-is-alive.mp3',
    cover: '/audio/covers/hako-is-alive.jpg',
  },
]
