/**
 * deployEnv.js — Environment resolution for production vs non-production builds.
 *
 * TVRS Maps is deployed on Vercel:
 *   - Production: main branch -> maps.tvrs.fr (VERCEL_ENV=production or VITE_DEPLOY_ENV=production)
 *   - Non-prod: dev-maps.tvrs.fr, preview deployments, local dev (VERCEL_ENV=preview/development, or unset)
 *
 * Vite in production mode sets import.meta.env.DEV = false even for dev-maps.tvrs.fr,
 * so we must never rely on import.meta.env.DEV alone for deployment identity.
 */

export function getDeployEnv() {
  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_DEPLOY_ENV
      : undefined;
  if (env) {
    return env;
  }
  const isDev = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.DEV : false;
  return isDev ? "development" : "unknown";
}

export function isProductionDeploy(env = getDeployEnv()) {
  return env === "production";
}

export function isDevMarkEnabled(env = getDeployEnv()) {
  return !isProductionDeploy(env);
}

export function getGitRef() {
  return (
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GIT_REF) || ""
  );
}
