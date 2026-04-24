import { PORT as port } from "./bridge/env";
import { handleRoute as fetch } from "./bridge/routes";

const server = Bun.serve({ port, fetch, });
console.log(`Bridge is running on http://localhost:${server.port}`);
