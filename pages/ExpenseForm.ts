import type { Locator, Page } from '@playwright/test';

export type ExpenseFormValues = {
  title?: string;
  amount?: string;
  category?: string;
  date?: string;
};

export type ExpenseField = 'title' | 'amount' | 'category' | 'date';

/** The add/edit expense form (components/ExpenseForm.jsx). Locators are scoped to the form. */
export class ExpenseForm {
  readonly root: Locator;
  readonly heading: Locator;
  readonly title: Locator;
  readonly amount: Locator;
  readonly category: Locator;
  readonly date: Locator;
  readonly submit: Locator;
  readonly cancel: Locator;
  readonly formError: Locator;
  readonly fieldErrors: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('expense-form');
    this.heading = this.root.getByRole('heading');
    this.title = this.root.getByTestId('form-title');
    this.amount = this.root.getByTestId('form-amount');
    this.category = this.root.getByTestId('form-category');
    this.date = this.root.getByTestId('form-date');
    this.submit = this.root.getByTestId('expense-submit');
    this.cancel = this.root.getByTestId('expense-cancel');
    this.formError = this.root.getByTestId('form-error');
    this.fieldErrors = this.root.getByTestId(/^error-(title|amount|category|date)$/);
  }

  fieldError(field: ExpenseField): Locator {
    return this.root.getByTestId(`error-${field}`);
  }

  /** Fills only the fields given; '' clears a field. */
  async fill(values: ExpenseFormValues): Promise<void> {
    if (values.title !== undefined) await this.title.fill(values.title);
    if (values.amount !== undefined) await this.amount.fill(values.amount);
    if (values.category !== undefined) await this.category.selectOption(values.category);
    if (values.date !== undefined) await this.date.fill(values.date);
  }

  async save(values: ExpenseFormValues = {}): Promise<void> {
    await this.fill(values);
    await this.submit.click();
  }
}
