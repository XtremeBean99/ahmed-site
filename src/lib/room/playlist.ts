export interface Track {
  id: string
  title: string
  artist?: string
  src: string
  cover?: string
}

export const PLAYLIST: Track[] = [
  {
    id: 'cant-look-in-my-eyes',
    title: "Can't Look In My Eyes",
    src: '/audio/cant-look-in-my-eyes.mp3',
    cover: '/audio/covers/cant-look-in-my-eyes.jpg',
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
  {
    id: 'always',
    title: 'Always',
    artist: 'Daniel Caesar',
    src: '/audio/always.mp3',
    cover: '/audio/covers/always.jpg',
  },
  {
    id: 'sukoshidake-mawarimichi',
    title: 'Sukoshidake Mawarimichi',
    artist: 'Hi-Fi Set',
    src: '/audio/sukoshidake-mawarimichi.mp3',
    cover: '/audio/covers/sukoshidake-mawarimichi.jpg',
  },
  {
    id: 'morphine-slowed',
    title: 'Morphine - Slowed',
    artist: 'baby.murcielaga, 1aevne',
    src: '/audio/morphine-slowed.mp3',
    cover: '/audio/covers/morphine-slowed.jpg',
  },
  {
    id: 'pyramids',
    title: 'Pyramids',
    artist: 'Frank Ocean',
    src: '/audio/pyramids.mp3',
    cover: '/audio/covers/pyramids.jpg',
  },
  {
    id: 'where-were-you-when-i-needed-you-the-most',
    title: 'Where Were You When I Needed You the Most',
    artist: 'baby.murcielaga',
    src: '/audio/where-were-you-when-i-needed-you-the-most.mp3',
    cover: '/audio/covers/where-were-you-when-i-needed-you-the-most.jpg',
  },
  {
    id: 'headlines',
    title: 'Headlines',
    artist: 'Drake',
    src: '/audio/headlines.mp3',
    cover: '/audio/covers/headlines.jpg',
  },
  {
    id: 'swim-good',
    title: 'Swim Good',
    artist: 'Frank Ocean',
    src: '/audio/swim-good.mp3',
    cover: '/audio/covers/swim-good.jpg',
  },
  {
    id: 'slow-jamz',
    title: 'Slow Jamz',
    artist: 'Twista, Kanye West, Jamie Foxx',
    src: '/audio/slow-jamz.mp3',
    cover: '/audio/covers/slow-jamz.jpg',
  },
]
