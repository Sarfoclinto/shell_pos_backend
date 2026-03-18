import path from "path";
import { fileURLToPath } from "url";
import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "POS API",
      version: "1.0.0",
      description: "API documentation",
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/${env.API_VERSION}`,
      },
    ],
  },
  apis: [path.join(__dirname, "../routes/*.js")], // ✅ FIXED
};

export const swaggerSpec = swaggerJSDoc(options);
