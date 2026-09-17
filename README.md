# Connecting Coders

A cinematic **Three.js 3D signal space** for discovering public GitHub follow paths. Developers are glowing points at real 3D coordinates. Orbit or fly through the network while five-second discovery batches stream public usernames through a Matrix-inspired interface.

## Run and validate

Requires Node 22.13+.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

Use the local URL printed by the server. For authenticated local exploration, sign in with `gh auth login` and run `npm run dev:github` (optionally `-- --port 5175`). The server reads your existing GitHub CLI credential into memory; it is never written to environment files or included in builds. Restart the server after changing CLI accounts.

For the hosted private Site, set `GITHUB_TOKEN` as a **secret runtime variable** and redeploy. Use a fine-grained personal access token with public-repository access and no additional permissions, plus an expiration date. Never use `VITE_`/`NEXT_PUBLIC_` variables or paste tokens into browser storage. Without that secret the hosted provider uses anonymous GitHub access. Its status badge reports the actual quota. Hosted API requests require a signed-in Site visitor; the Site's private access policy controls who can consume the shared token allowance.

## Controls

- Drag to orbit; scroll to move toward or away from the current focus.
- Click a developer dot to fly toward it and inspect its public evidence.
- Focus the canvas and use **WASD** to travel, **Q/E** to descend/ascend.
- **Fly through route** visits each point on the path with a five-second cadence. Manual navigation interrupts the tour.
- **Return to overview** restores a wide view.
- **Pause exploration** interrupts the current request or animation hold; **Resume exploration** continues from its saved page cursor.

## What a result means

The default **Either direction** mode treats Alice following Bob *or* Bob following Alice as a traversable connection. **Mutual follows only** requires both observed follows for every hop. The evidence inspector always preserves who actually follows whom; traversal does not invent reciprocal evidence. A route suggests a possible introduction; it does not verify friendship, contactability or willingness to introduce. Intermediaries = `max(0, hops − 1)`.

The app searches public neighborhoods within the selected hop boundary, follows pagination, and continues after finding a path. The shortest route is recalculated over the evidence collected so far. No global shortest-path guarantee is made while exploration is incomplete. Private profiles and unavailable data can hide connections.

There is **no first-page cutoff or 400-node discovery cap**. GitHub quotas still apply: anonymous access normally permits 60 requests/hour per originating IP, shared with other applications. Authenticated personal access normally permits 5,000 requests/hour, shared with other uses of that account. At quota exhaustion, exploration pauses; it cannot honestly promise to crawl all of GitHub. Progress is retained in the current tab's memory, not across reloads or closed tabs.

All discovered evidence remains in memory. To bound GPU work, the viewport shows at most 600 developers and 5,000 edges, preserving the route. The developer list is paginated in groups of 100 and provides access to every discovered account. The UI identifies when the view is sampled. Background stars are decorative; they are not counted as developers. The initial demo uses fictional people and edges.

## Architecture

| Module                                       | Responsibility                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `lib/graph/types.ts`                         | Framework-free domain contracts                                                        |
| `lib/graph/path.ts`                          | Mode-aware traversal over directed evidence, O(V + E)                                                |
| `lib/graph/exploration.ts`                   | Resumable, paginated, two-ended discovery; failed requests preserve their exact cursor |
| `lib/graph/layout3d.ts`                      | Stable 3D coordinates independent of Three.js                                          |
| `lib/graph/visible.ts`                       | Renderer budget without data loss                                                      |
| `lib/github/client.ts`                       | Validated HTTP responses, bounded TTL cache, quota cooldown                            |
| `components/explorer/useConnectionSearch.ts` | Cancellation, stale-result protection, five-second batch pacing                        |
| `lib/rendering/SpaceScene.ts`                | Retained Three.js scene, GPU buffers, camera, picking, route flights and disposal      |
| `components/explorer/GraphCanvas.tsx`        | React lifecycle bridge; lazy loads the 3D renderer                                     |
| `components/explorer/DiscoveryConsole.tsx`   | Names and scan choreography driven by each fetched page                                |

`lib/github/proxy.ts` is the shared server credential boundary: fixed public endpoints, bounded queries, sanitized responses and forwarded quota headers. The hosted route reads the secret Worker binding; the optional Vite development plugin uses GitHub CLI sign-in. Neither exports a credential to client code.

See [architecture and scaling decisions](docs/architecture.md).

## Sources

- [GitHub follow endpoints](https://docs.github.com/en/rest/users/followers)
- [GitHub REST API limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [Three.js documentation](https://threejs.org/docs/)
