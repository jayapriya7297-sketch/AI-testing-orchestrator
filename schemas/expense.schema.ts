export const CATEGORIES = ['Food', 'Travel', 'Office', 'Utilities', 'Entertainment', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

export type Expense = {
  id: number;
  title: string;
  amount: number;
  category: Category;
  date: string;
  created_by: string;
};

export const expenseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    amount: { type: 'number', exclusiveMinimum: 0, maximum: 1000000 },
    category: { enum: [...CATEGORIES] },
    date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    created_by: { type: 'string', minLength: 1 },
  },
  required: ['id', 'title', 'amount', 'category', 'date', 'created_by'],
  additionalProperties: false,
} as const;

export const expenseListSchema = {
  type: 'array',
  items: expenseSchema,
} as const;

export const importSuccessSchema = {
  type: 'object',
  properties: { imported: { type: 'integer', minimum: 1 } },
  required: ['imported'],
  additionalProperties: false,
} as const;
