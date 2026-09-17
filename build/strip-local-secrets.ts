import type { Plugin } from "vite";
/** Cloudflare can emit local preview bindings during builds. Production receives
 * secrets from Sites runtime bindings; never package local credential files. */
export function stripLocalSecrets(): Plugin {
  return {
    name: "strip-local-secret-assets",
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        for (const name of Object.keys(bundle)) {
          const file = name.split("/").at(-1) ?? "";
          if (file.startsWith(".dev.vars") || file.startsWith(".env")) delete bundle[name];
        }
      },
    },
  };
}
