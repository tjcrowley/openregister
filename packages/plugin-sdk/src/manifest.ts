import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schema (used internally for validation)
// ---------------------------------------------------------------------------

const semverPattern = /^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/;
const kebabPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const PluginPermissionSchema = z.enum([
  'catalog:read',
  'catalog:write',
  'sales:read',
  'inventory:read',
  'inventory:write',
  'payments:read',
  'settings:read',
  'settings:write',
]);

const PluginManifestSchema = z.object({
  id: z.string().regex(kebabPattern, 'Plugin id must be kebab-case'),
  name: z.string().min(1),
  version: z.string().regex(semverPattern, 'version must be a valid semver string'),
  description: z.string().min(1),
  author: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    url: z.string().url().optional(),
  }),
  entryPoint: z.string().min(1),
  permissions: z.array(PluginPermissionSchema),
  minAppVersion: z.string().regex(semverPattern, 'minAppVersion must be a valid semver string'),
  hooks: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Exported TypeScript type (derived from schema)
// ---------------------------------------------------------------------------

export type PluginPermission = z.infer<typeof PluginPermissionSchema>;

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateManifest(manifest: unknown): ManifestValidationResult {
  const result = PluginManifestSchema.safeParse(manifest);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });

  return { valid: false, errors };
}
