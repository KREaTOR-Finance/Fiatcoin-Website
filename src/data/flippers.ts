export type Flipper = {
  slug: string
  name: string
  handle?: string
  avatar?: string
  summary: string
  tweetUrls: string[]
  images?: string[]
}

export const flippers: Flipper[] = [
  {
    slug: "trump",
    name: "Donald Trump",
    handle: "@realDonaldTrump",
    summary: "From skeptic to builder-friendly rhetoric.",
    tweetUrls: [
      "https://twitter.com/realDonaldTrump/status/1149472282584072192"
    ],
    images: []
  },
  {
    slug: "cuban",
    name: "Mark Cuban",
    handle: "@mcuban",
    summary: "Once harsh, now an active crypto infra investor.",
    tweetUrls: [],
    images: []
  },
  { slug: "dimon", name: "Jamie Dimon", handle: "JPM exec", summary: "Public criticisms vs. institutional adoption.", tweetUrls: [], images: [] },
  { slug: "fink", name: "Larry Fink", handle: "BlackRock", summary: "“Tokenization is the future of markets.”", tweetUrls: [], images: [] }
]


