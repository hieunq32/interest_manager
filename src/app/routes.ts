export type Route =
  | { name: "dashboard" }
  | { name: "borrower"; borrowerId: string }
  | { name: "loan"; loanId: string }
  | { name: "settings" };

const dashboardRoute: Route = { name: "dashboard" };

function decodeId(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0 ? decoded : undefined;
  } catch {
    return undefined;
  }
}

export function parseHashRoute(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\//, "");
  const segments = path.split("/");

  if (path === "" || path === "/") {
    return dashboardRoute;
  }
  if (segments.length === 1 && segments[0] === "settings") {
    return { name: "settings" };
  }
  if (segments.length === 2 && segments[0] === "borrowers") {
    const borrowerId = decodeId(segments[1]);
    return borrowerId === undefined ? dashboardRoute : { name: "borrower", borrowerId };
  }
  if (segments.length === 2 && segments[0] === "loans") {
    const loanId = decodeId(segments[1]);
    return loanId === undefined ? dashboardRoute : { name: "loan", loanId };
  }
  return dashboardRoute;
}

export function serializeHashRoute(route: Route): string {
  switch (route.name) {
    case "dashboard":
      return "#/";
    case "borrower":
      return `#/borrowers/${encodeURIComponent(route.borrowerId)}`;
    case "loan":
      return `#/loans/${encodeURIComponent(route.loanId)}`;
    case "settings":
      return "#/settings";
  }
}
