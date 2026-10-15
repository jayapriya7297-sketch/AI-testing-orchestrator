import type { Locator, Page } from '@playwright/test';

export class ExpensesPage {
  readonly userEmail: Locator;
  readonly logoutButton: Locator;
  readonly categoryFilter: Locator;
  readonly addExpenseButton: Locator;
  readonly exportButton: Locator;
  readonly importInput: Locator;
  readonly importButton: Locator;
  readonly importMessage: Locator;
  readonly importError: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly emptyState: Locator;
  readonly expenseCount: Locator;

  constructor(private readonly page: Page) {
    this.userEmail = page.getByTestId('user-email');
    this.logoutButton = page.getByTestId('logout-button');
    this.categoryFilter = page.getByTestId('category-filter');
    this.addExpenseButton = page.getByTestId('add-expense-button');
    this.exportButton = page.getByTestId('export-button');
    this.importInput = page.getByTestId('import-input');
    this.importButton = page.getByTestId('import-button');
    this.importMessage = page.getByTestId('import-message');
    this.importError = page.getByTestId('import-error');
    this.successMessage = page.getByTestId('success-message');
    this.errorMessage = page.getByTestId('error-message');
    this.table = page.getByTestId('expenses-table');
    this.rows = page.getByTestId(/^expense-row-\d+$/);
    this.emptyState = page.getByTestId('empty-state');
    this.expenseCount = page.getByTestId('expense-count');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  row(id: number): Locator {
    return this.page.getByTestId(`expense-row-${id}`);
  }

  editButton(id: number): Locator {
    return this.page.getByTestId(`edit-button-${id}`);
  }

  deleteButton(id: number): Locator {
    return this.page.getByTestId(`delete-button-${id}`);
  }

  confirmDeleteButton(id: number): Locator {
    return this.page.getByTestId(`confirm-delete-${id}`);
  }

  async filterByCategory(category: string): Promise<void> {
    await this.categoryFilter.selectOption(category === 'All' ? '' : category);
  }

  async deleteExpense(id: number): Promise<void> {
    await this.deleteButton(id).click();
    await this.confirmDeleteButton(id).click();
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
