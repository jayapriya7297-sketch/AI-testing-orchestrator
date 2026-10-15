export const loginResponseSchema = {
  type: 'object',
  properties: {
    token: { type: 'string', pattern: '^[\\w-]+\\.[\\w-]+\\.[\\w-]+$' },
    user: {
      type: 'object',
      properties: {
        id: { type: 'integer', minimum: 1 },
        email: { type: 'string', minLength: 3 },
        role: { enum: ['admin', 'user'] },
      },
      required: ['id', 'email', 'role'],
      additionalProperties: false,
    },
  },
  required: ['token', 'user'],
  additionalProperties: false,
} as const;
