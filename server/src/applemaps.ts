import { importPKCS8, SignJWT } from "jose";

export interface AppleMapsConfig {
  teamId: string;
  keyId: string;
  mapsId: string;
  privateKey: string;
}

export interface AppleSearchResult {
  name: string;
  label: string;
  lat: number;
  lon: number;
  kind: string;
  appleId?: string;
}

/** Small server-only Apple Maps client. The private key never leaves this process. */
export class AppleMapsClient {
  private token: { value: string; expiresAt: number } | null = null;
  private keyPromise: Promise<CryptoKey> | null = null;

  constructor(private readonly config: AppleMapsConfig) {}

  private async developerToken(scope = "server_api", origin?: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.expiresAt - 60 > now) return this.token.value;
    this.keyPromise ??= importPKCS8(this.config.privateKey, "ES256");
    const key = await this.keyPromise;
    const value = await new SignJWT({
      iss: this.config.teamId,
      iat: now,
      exp: now + 15 * 60,
      origin: this.config.mapsId,
      scope,
      ...(origin ? { origin } : {}),
    })
      .setProtectedHeader({ alg: "ES256", kid: this.config.keyId, typ: "JWT" })
      .sign(key);
    return value;
  }

  /** Short-lived browser token for MapKit JS. Never expose the signing key. */
  async mapKitToken(origin: string): Promise<{ token: string; expiresInSeconds: number }> {
    const developerToken = await this.developerToken("mapkit_js", origin);
    const response = await fetch("https://maps-api.apple.com/v1/token", {
      headers: { Authorization: `Bearer ${developerToken}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`Apple Maps token request failed: ${response.status}`);
    const body = (await response.json()) as { accessToken?: string; expiresInSeconds?: number };
    if (!body.accessToken) throw new Error("Apple Maps token response was empty");
    return { token: body.accessToken, expiresInSeconds: body.expiresInSeconds ?? 1800 };
  }

  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.expiresAt - 60 > now) return this.token.value;
    const response = await fetch("https://maps-api.apple.com/v1/token", {
      headers: { Authorization: `Bearer ${await this.developerToken()}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return "";
    const body = (await response.json()) as { accessToken?: string; expiresInSeconds?: number };
    if (!body.accessToken) return "";
    this.token = {
      value: body.accessToken,
      expiresAt: now + Math.max(60, body.expiresInSeconds ?? 15 * 60),
    };
    return body.accessToken;
  }

  async search(query: string, lang: string, bias?: { lat: number; lon: number }): Promise<AppleSearchResult[]> {
    const params = new URLSearchParams({ q: query, lang, resultTypeFilter: "Poi,address" });
    if (bias) params.set("searchLocation", `${bias.lat},${bias.lon}`);
    const token = await this.accessToken();
    if (!token) return [];
    const response = await fetch(`https://maps-api.apple.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { results?: unknown[] };
    return (body.results ?? []).flatMap((item) => {
      const result = item as {
        id?: string;
        name?: string;
        formattedAddressLines?: string[];
        address?: { formattedAddressLines?: string[] };
        coordinate?: { latitude?: number; longitude?: number };
        type?: string;
      };
      const lat = result.coordinate?.latitude;
      const lon = result.coordinate?.longitude;
      if (!result.name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      const lines = result.formattedAddressLines ?? result.address?.formattedAddressLines ?? [];
      return [{
        name: result.name,
        label: [result.name, ...lines].filter(Boolean).join(", "),
        lat: lat as number,
        lon: lon as number,
        kind: result.type ?? "place",
        appleId: result.id,
      }];
    });
  }
}
