export type SubjectType = "dev" | "skill" | "agent";

export interface DidUrlComponents {
  networkId: string;
  subjectType: SubjectType;
  uniqueId: string;
}

export interface DidUrlQuery {
  version?: string;
  service?: string;
}

export interface DidUrlResult {
  did: string;
  components: DidUrlComponents;
  path?: string;
  query: DidUrlQuery;
  fragment?: string;
}

const DID_PATTERN =
  /^did:ai:([a-z0-9][a-z0-9-]{0,30}[a-z0-9]):(dev|skill|agent):([A-Za-z0-9]+)$/;

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

  const pathMatch = url.match(
    /^(did:ai:[a-z0-9-]+:[dev|skill|agent]:[A-Za-z0-9]+)\/(.+)$/,
  );
  let path: string | undefined;
  let did: string = url;

  if (pathMatch !== null && pathMatch[1] !== undefined) {
    did = pathMatch[1];
    path = pathMatch[2] ?? undefined;
  }

  const match = did.match(DID_PATTERN);
  if (!match) {
    throw new Error(`Invalid DID format: ${did}`);
  }

  const [, networkId = "", subjectType = "dev", uniqueId = ""] = match;

  return {
    did,
    components: {
      networkId,
      subjectType: subjectType as SubjectType,
      uniqueId,
    },
    path,
    query,
    fragment,
  };
}

export function isVersionedDid(did: string): boolean {
  return (
    did.startsWith("did:ai:") &&
    (did.includes(":skill:") || did.includes(":agent:"))
  );
}
