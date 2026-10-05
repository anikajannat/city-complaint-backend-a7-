import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "City Complaint & Service Platform API",
      version: "1.0.0",
      description:
        "API documentation for the City Complaint & Service Platform.",
    },

    servers: [
      {
        url:
          process.env.BACKEND_PUBLIC_URL ||
          "http://localhost:5000",
        description: "API Server",
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },

    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Check API health",
          responses: {
            "200": {
              description: "Backend is healthy",
            },
          },
        },
      },

      "/api/v1/auth/register": {
        post: {
          tags: ["Authentication"],
          summary: "Register a new citizen",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "name",
                    "email",
                    "password",
                  ],
                  properties: {
                    name: {
                      type: "string",
                      example: "Anika Jannat",
                    },
                    email: {
                      type: "string",
                      example: "user@example.com",
                    },
                    password: {
                      type: "string",
                      example: "123456",
                    },
                    phone: {
                      type: "string",
                      example: "01700000000",
                    },
                    address: {
                      type: "string",
                      example: "Dhaka",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Registration successful",
            },
            "409": {
              description: "Email already exists",
            },
          },
        },
      },

      "/api/v1/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "Login",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: {
                      type: "string",
                      example: "admin@cityservice.com",
                    },
                    password: {
                      type: "string",
                      example: "Admin123!",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Login successful",
            },
            "401": {
              description: "Invalid credentials",
            },
          },
        },
      },

      "/api/v1/auth/me": {
        get: {
          tags: ["Authentication"],
          summary: "Get current logged-in user",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Current user information",
            },
            "401": {
              description: "Unauthorized",
            },
          },
        },
      },

      "/api/v1/categories": {
        get: {
          tags: ["Categories"],
          summary: "Get all active complaint categories",
          responses: {
            "200": {
              description: "Category list",
            },
          },
        },

        post: {
          tags: ["Categories"],
          summary: "Create category - Admin only",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: {
                      type: "string",
                      example: "Road Damage",
                    },
                    description: {
                      type: "string",
                      example:
                        "Road and pavement related complaints",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Category created",
            },
          },
        },
      },

      "/api/v1/complaints": {
        get: {
          tags: ["Complaints"],
          summary: "Get complaints based on user role",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer" },
            },
            {
              name: "status",
              in: "query",
              schema: { type: "string" },
            },
            {
              name: "search",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Complaint list",
            },
          },
        },

        post: {
          tags: ["Complaints"],
          summary: "Submit new complaint - Citizen",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "title",
                    "description",
                    "location",
                    "categoryId",
                  ],
                  properties: {
                    title: {
                      type: "string",
                      example: "Broken street light",
                    },
                    description: {
                      type: "string",
                      example:
                        "Street light has not worked for several days.",
                    },
                    location: {
                      type: "string",
                      example: "Dhanmondi, Dhaka",
                    },
                    categoryId: {
                      type: "string",
                    },
                    attachmentUrl: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Complaint submitted",
            },
          },
        },
      },

      "/api/v1/complaints/{id}": {
        get: {
          tags: ["Complaints"],
          summary: "Get complaint details",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Complaint details",
            },
            "404": {
              description: "Complaint not found",
            },
          },
        },
      },

      "/api/v1/complaints/{id}/assign": {
        patch: {
          tags: ["Complaints"],
          summary:
            "Assign complaint to staff - Admin only",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["staffId"],
                  properties: {
                    staffId: {
                      type: "string",
                    },
                    serviceFee: {
                      type: "number",
                      example: 100,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Complaint assigned",
            },
          },
        },
      },

      "/api/v1/complaints/{id}/status": {
        patch: {
          tags: ["Complaints"],
          summary: "Update complaint status",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: [
                        "PENDING",
                        "ASSIGNED",
                        "IN_PROGRESS",
                        "RESOLVED",
                        "REJECTED",
                        "CANCELLED",
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Status updated",
            },
          },
        },
      },

      "/api/v1/users": {
        get: {
          tags: ["Users"],
          summary: "Get users - Admin only",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "User list",
            },
          },
        },
      },

      "/api/v1/admin/stats": {
        get: {
          tags: ["Admin"],
          summary: "Get dashboard statistics",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Dashboard statistics",
            },
          },
        },
      },

      "/api/v1/payments": {
        get: {
          tags: ["Payments"],
          summary: "Get payment history",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Payment list",
            },
          },
        },
      },

      "/api/v1/payments/sslcommerz/initiate/{complaintId}":
        {
          post: {
            tags: ["Payments"],
            summary:
              "Initiate SSLCommerz payment for complaint",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "complaintId",
                in: "path",
                required: true,
                schema: {
                  type: "string",
                },
              },
            ],
            responses: {
              "200": {
                description:
                  "SSLCommerz gateway URL generated",
              },
            },
          },
        },
    },
  },

  apis: [],
};

export const swaggerSpec =
  swaggerJsdoc(options);