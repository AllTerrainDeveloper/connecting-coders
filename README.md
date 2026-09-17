# Connecting Coders

An interactive PixiJS map for discovering **directed public GitHub follow paths** between developers. Built with React, TypeScript and Vinext. The initial network is explicitly fictional; live searches use GitHub's public REST API.

## Run

Node 22.13+ is required.

```sh
npm ci
npm run dev
```

Use the local URL printed by the server. No API key or environment variables are required for public searches.

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

## What the result means

`alice → bob → carol` means Alice follows Bob and Bob follows Carol. It suggests a possible introduction route; GitHub does not establish friendship, contactability, willingness to introduce, or a real-world relationship. Arrows are never silently reversed. The number of intermediaries is `max(0, jumps − 1)`.

The result is the shortest directed route **within observed evidence**, with the selected hop ceiling. It is not guaranteed to be the globally shortest route. A negative result means only that this bounded search did not find a route in public data.

Each search permits 24 outbound requests (two profiles plus at most 22 expansions), 400 nodes, and 2–6 hops. One page of up to 100 neighbors is read per expansion. Pagination, node limits and expansion limits mark incomplete coverage. Searches can stop early on a found path. Public API access is limited to 60 requests per hour per originating IP; successive searches share that allowance with other applications using that IP.

## Code map

| Module                                       | Responsibility                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `lib/graph/types.ts`                         | Domain types and provider contract; no UI or HTTP dependencies                  |
| `lib/graph/path.ts`                          | Pure breadth-first path search, O(V + E)                                        |
| `lib/graph/search.ts`                        | Bounded two-ended discovery with direction preserved                            |
| `lib/graph/layout.ts`                        | Deterministic layout independent of graphics resources                          |
| `lib/github/client.ts`                       | HTTP, runtime validation, pagination awareness, bounded cache and rate cooldown |
| `components/explorer/useConnectionSearch.ts` | Cancellation and stale-result protection                                        |
| `components/explorer/GraphCanvas.tsx`        | Pixi lifecycle, on-demand rendering, pointer controls and resize cleanup        |
| `components/explorer/Explorer.tsx`           | Search, text path, developer list and public evidence inspector                 |

See [architecture and scaling decisions](docs/architecture.md) for tradeoffs and the path to a larger service.

## Validation

The automated suite covers directedness, shortest observed paths, cycles, hop ceilings, both discovery directions, partial pagination, resource budgets, cancellation, username validation, malformed data, cache reuse, organization rejection and shared rate-limit cooldown. No test requires GitHub credentials or network access. Browser QA also exercises real public API data.

## Sources

- [GitHub followers and following endpoints](https://docs.github.com/en/rest/users/followers)
- [GitHub REST API limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [PixiJS application lifecycle](https://pixijs.com/8.x/guides/components/application)
