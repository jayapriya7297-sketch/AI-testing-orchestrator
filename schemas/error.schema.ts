/** 401 / 404 and file-level 400s: { error } */
export const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string', minLength: 1 } },
  required: ['error'],
  additionalProperties: false,
} as const;

/** 400 from CRUD and login: { error, details: [{ field, message }] } */
export const validationErrorSchema = {
  type: 'object',
  properties: {
    error: { const: 'Validation failed' },
    details: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', minLength: 1 },
          message: { type: 'string', minLength: 1 },
        },
        required: ['field', 'message'],
        additionalProperties: false,
      },
    },
  },
  required: ['error', 'details'],
  additionalProperties: false,
} as const;

/** 400 from xlsx import: details also carry the spreadsheet row number */
export const importErrorSchema = {
  type: 'object',
  properties: {
    error: { const: 'Import failed' },
    details: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          row: { type: 'integer', minimum: 1 },
          field: { type: 'string', minLength: 1 },
          message: { type: 'string', minLength: 1 },
        },
        required: ['row', 'field', 'message'],
        additionalProperties: false,
      },
    },
  },
  required: ['error', 'details'],
  additionalProperties: false,
} as const;
