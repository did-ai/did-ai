export interface DidUrlQuery {
  version?: string;
  service?: string;
}

export interface DidUrlResult {
  did: string;
  path?: string;
  query: DidUrlQuery;
  fragment?: string;
}

export function parseDidUrl(didUrl: string): DidUrlResult {
  let url = didUrl;

  const fragmentIndex = url.indexOf("#");
  let fragment: string | undefined;
  if (fragmentIndex !== -1) {
    fragment = url.slice(fragmentIndex + 1);
    url = url.slice(0, fragmentIndex);
  }

  const queryIndex = url.indexOf("?");
  let query: DidUrlQuery = {};
  if (queryIndex !== -1) {
    const queryString = url.slice(queryIndex + 1);
    url = url.slice(0, queryIndex);

    const params = new URLSearchParams(queryString);
    const version = params.get("version");
    const service = params.get("service");

    if (version) {
      query.version = version;
    }
    if (service) {
      query.service = service;
    }
  }

  const pathMatch = url.match(/^(did:ai:[a-z]+:[a-z]+:[A-Za-z0-9]+)\/(.+)$/);
  let path: string | undefined;
  let did: string = url;

  if (pathMatch !== null && pathMatch[1] !== undefined) {
    did = pathMatch[1];
    path = pathMatch[2] ?? undefined;
  }

  return {
    did,
    path,
    query,
    fragment,
  };
}

export function isVersionedDid(did: string): boolean {
  return did.startsWith("did:ai:skill:") || did.startsWith("did:ai:agent:");
}
