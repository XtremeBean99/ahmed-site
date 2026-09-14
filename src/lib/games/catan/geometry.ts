/**
 * Static topology of the standard 19-hex board (pointy-top hexes, axial coordinates, radius 2).
 * Positions are in hex-size units (circumradius 1, board centred on 0,0); the UI scales them.
 * Ids are stable array indices sorted top-to-bottom then left-to-right.
 */

export interface HexInfo {
  id: number
  q: number
  r: number
  x: number
  y: number
  /** 6 vertex ids clockwise from the upper-right corner. */
  vertices: number[]
  /** edges[i] joins vertices[i] and vertices[(i + 1) % 6]. */
  edges: number[]
  /** Adjacent hex ids. */
  neighbors: number[]
}

export interface VertexInfo {
  id: number
  x: number
  y: number
  hexes: number[]
  edges: number[]
  /** Vertex ids one edge away. */
  neighbors: number[]
}

export interface EdgeInfo {
  id: number
  vertices: [number, number]
  hexes: number[]
  /** Midpoint. */
  x: number
  y: number
}

const SQRT3 = Math.sqrt(3)
const RADIUS = 2
const AXIAL_DIRECTIONS: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]
/** Perimeter spacing of the 9 harbours over the 30 coastal edges (gaps 3,3,4 repeated). */
const PORT_EDGE_SLOTS = [0, 3, 6, 10, 13, 16, 20, 23, 26]

const round = (n: number) => Math.round(n * 1000) / 1000
const keyOf = (x: number, y: number) => `${round(x)},${round(y)}`
const byPosition = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  round(a.y) - round(b.y) || round(a.x) - round(b.x)

function build() {
  const hexCoords: { q: number; r: number; x: number; y: number }[] = []
  for (let r = -RADIUS; r <= RADIUS; r++) {
    for (let q = Math.max(-RADIUS, -r - RADIUS); q <= Math.min(RADIUS, -r + RADIUS); q++) {
      hexCoords.push({ q, r, x: SQRT3 * (q + r / 2), y: 1.5 * r })
    }
  }

  const cornersOf = (h: { x: number; y: number }) =>
    Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 180) * (60 * i - 30)
      return { x: h.x + Math.cos(angle), y: h.y + Math.sin(angle) }
    })

  const vertexByKey = new Map<string, { x: number; y: number }>()
  for (const h of hexCoords) {
    for (const c of cornersOf(h)) vertexByKey.set(keyOf(c.x, c.y), c)
  }
  const vertexPoints = [...vertexByKey.values()].sort(byPosition)
  const vertexId = new Map(vertexPoints.map((p, i) => [keyOf(p.x, p.y), i]))

  const hexVertices = hexCoords.map((h) => cornersOf(h).map((c) => vertexId.get(keyOf(c.x, c.y))!))

  const edgeByKey = new Map<string, [number, number]>()
  for (const vs of hexVertices) {
    for (let i = 0; i < 6; i++) {
      const a = vs[i]
      const b = vs[(i + 1) % 6]
      const pair: [number, number] = a < b ? [a, b] : [b, a]
      edgeByKey.set(pair.join('-'), pair)
    }
  }
  const edgePairs = [...edgeByKey.values()]
    .map((pair) => ({
      pair,
      x: (vertexPoints[pair[0]].x + vertexPoints[pair[1]].x) / 2,
      y: (vertexPoints[pair[0]].y + vertexPoints[pair[1]].y) / 2,
    }))
    .sort(byPosition)
  const edgeId = new Map(edgePairs.map((e, i) => [e.pair.join('-'), i]))
  const edgeBetween = (a: number, b: number) => edgeId.get((a < b ? [a, b] : [b, a]).join('-'))!

  const hexIdAt = new Map(hexCoords.map((h, i) => [`${h.q},${h.r}`, i]))

  const hexes: HexInfo[] = hexCoords.map((h, id) => ({
    id,
    q: h.q,
    r: h.r,
    x: h.x,
    y: h.y,
    vertices: hexVertices[id],
    edges: hexVertices[id].map((v, i) => edgeBetween(v, hexVertices[id][(i + 1) % 6])),
    neighbors: AXIAL_DIRECTIONS.map(([dq, dr]) => hexIdAt.get(`${h.q + dq},${h.r + dr}`)).filter(
      (n): n is number => n !== undefined,
    ),
  }))

  const vertices: VertexInfo[] = vertexPoints.map((p, id) => ({
    id,
    x: p.x,
    y: p.y,
    hexes: hexes.filter((h) => h.vertices.includes(id)).map((h) => h.id),
    edges: [],
    neighbors: [],
  }))

  const edges: EdgeInfo[] = edgePairs.map((e, id) => ({
    id,
    vertices: e.pair,
    hexes: hexes.filter((h) => h.edges.includes(id)).map((h) => h.id),
    x: e.x,
    y: e.y,
  }))

  for (const e of edges) {
    const [a, b] = e.vertices
    vertices[a].edges.push(e.id)
    vertices[b].edges.push(e.id)
    vertices[a].neighbors.push(b)
    vertices[b].neighbors.push(a)
  }

  const coastal = edges
    .filter((e) => e.hexes.length === 1)
    .sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x))
    .map((e) => e.id)

  return { hexes, vertices, edges, coastal }
}

const BOARD = build()

export const HEXES: readonly HexInfo[] = BOARD.hexes
export const VERTICES: readonly VertexInfo[] = BOARD.vertices
export const EDGES: readonly EdgeInfo[] = BOARD.edges
/** Coastal edge ids in angular order around the board. */
export const COASTAL_EDGES: readonly number[] = BOARD.coastal
/** The 9 coastal edges that carry a harbour. */
export const PORT_EDGES: readonly number[] = PORT_EDGE_SLOTS.map((slot) => BOARD.coastal[slot])

export const BOARD_BOUNDS = {
  minX: Math.min(...VERTICES.map((v) => v.x)),
  maxX: Math.max(...VERTICES.map((v) => v.x)),
  minY: Math.min(...VERTICES.map((v) => v.y)),
  maxY: Math.max(...VERTICES.map((v) => v.y)),
}

/** The edge joining two adjacent vertices, or null. */
export function edgeBetween(a: number, b: number): number | null {
  return VERTICES[a].edges.find((e) => EDGES[e].vertices.includes(b)) ?? null
}
