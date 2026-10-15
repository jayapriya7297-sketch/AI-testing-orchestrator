import Ajv from 'ajv';
import { expect } from '@playwright/test';

const ajv = new Ajv({ allErrors: true });

/** Asserts that body matches the JSON schema, printing ajv errors on failure. */
export function expectSchema(body: unknown, schema: object): void {
  const validate = ajv.compile(schema);
  const valid = validate(body);
  expect(valid, `Schema errors: ${JSON.stringify(validate.errors)}\nBody: ${JSON.stringify(body)}`).toBe(true);
}
