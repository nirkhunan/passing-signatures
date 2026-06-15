/**
 * d3-force layout for the abstract "Force" view (PRD R1).
 * Strong passing pairs pull tighter; weak links barely tug, so the dense
 * near-complete passing graph resolves into readable structure rather than a
 * hairball. The Pitch layout (Stage 7) is a separate concern.
 */
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from 'd3-force'

import { nodeRadius } from './colorScales.js'

/**
 * Build (but do not start ticking externally) a force simulation.
 * @param {Array} nodes - mutable node objects (will gain x/y/vx/vy)
 * @param {Array} links - {source, target, per90} objects
 * @param {number} width
 * @param {number} height
 */
export function createSimulation(nodes, links, width, height) {
  // Dense near-complete passing graphs clump under default forces, so we push
  // hard for spread: strong repulsion, long links, generous collision padding.
  return forceSimulation(nodes)
    .force(
      'link',
      forceLink(links)
        .id((d) => d.player_id)
        // strong pairs sit closer; weak pairs allowed to stretch out
        .distance((l) => 90 + 110 / Math.sqrt(l.per90 + 1))
        // weak links barely pull, so heavy connections shape the layout
        .strength((l) => 0.012 + 0.14 * Math.min(1, l.per90 / 15)),
    )
    .force('charge', forceManyBody().strength(-900).distanceMin(24))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide((d) => nodeRadius(d.touches_per90) + 10).strength(1))
    // gentle pull to center keeps the whole graph from drifting off-canvas
    .force('x', forceX(width / 2).strength(0.02))
    .force('y', forceY(height / 2).strength(0.02))
}
