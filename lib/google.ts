import { createRemoteJWKSet, jwtVerify } from "jose"

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"]
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"))

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const appUrl = process.env.APP_URL
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and APP_URL must be set")
  }
  return { clientId, clientSecret, redirectUri: `${appUrl}/api/auth/callback/google` }
}

export function authorizationUrl(state: string) {
  const { clientId, redirectUri } = googleConfig()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/** Exchanges an authorization code for Google's ID token. */
export async function exchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = googleConfig()
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${await response.text()}`)
  }

  const { id_token: idToken } = (await response.json()) as { id_token?: string }
  if (!idToken) throw new Error("Google response did not include an id_token")
  return idToken
}

/** Verifies the ID token signature, issuer and audience before we trust any claim. */
export async function verifyIdToken(idToken: string) {
  const { clientId } = googleConfig()
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
  })

  if (!payload.email || payload.email_verified !== true) {
    throw new Error("Google account has no verified email")
  }

  return {
    sub: payload.sub as string,
    email: payload.email as string,
    name: (payload.name as string) ?? (payload.email as string),
    picture: payload.picture as string | undefined,
  }
}
