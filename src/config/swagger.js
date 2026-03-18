import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env.js";

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
  apis: ["../routes/*.js"], // files with swagger comments
};

export const swaggerSpec = swaggerJSDoc(options);
