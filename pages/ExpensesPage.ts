import type { Download, Locator, Page, Response } from '@playwright/test';
import { ExpenseForm } from './ExpenseForm';

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
  readonly loading: Locator;
  readonly expenseCount: Locator;
  readonly form: ExpenseForm;

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
    this.loading = page.getByTestId('loading');
    this.expenseCount = page.getByTestId('expense-count');
    this.form = new ExpenseForm(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  row(id: number): Locator {
    return this.page.getByTestId(`expense-row-${id}`);
  }

  rowByTitle(title: string): Locator {
    return this.rows.filter({
      has: this.page.getByTestId('expense-title').getByText(title, { exact: true }),
    });
  }

  /** Every cell of one column in the table, e.g. cells('category') for expense-category. */
  cells(column: 'title' | 'amount' | 'category' | 'date' | 'created-by'): Locator {
    return this.table.getByTestId(`expense-${column}`);
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

  cancelDeleteButton(id: number): Locator {
    return this.page.getByTestId(`cancel-delete-${id}`);
  }

  async openAddForm(): Promise<void> {
    await this.addExpenseButton.click();
  }

  async openEdit(id: number): Promise<void> {
    await this.editButton(id).click();
  }

  /** Selects a category and waits for the filtered list request to finish. */
  async filterByCategory(category: string): Promise<void> {
    const value = category === 'All' ? '' : category;
    const listed = this.page.waitForResponse((res) => {
      const url = new URL(res.url());
      return (
        url.pathname === '/api/expenses' && (url.searchParams.get('category') ?? '') === value
      );
    });
    await this.categoryFilter.selectOption(value);
    await listed;
  }

  async deleteExpense(id: number): Promise<void> {
    await this.deleteButton(id).click();
    await this.confirmDeleteButton(id).click();
  }

  async cancelDelete(id: number): Promise<void> {
    await this.deleteButton(id).click();
    await this.cancelDeleteButton(id).click();
  }

  /** Clicks Export and returns the download it triggers. */
  async exportFile(): Promise<Download> {
    const download = this.page.waitForEvent('download');
    await this.exportButton.click();
    return download;
  }

  /**
   * Chooses file (a path or an in-memory buffer), clicks Import and returns the
   * POST /api/expenses/import response.
   */
  async importFile(file: string | { name: string; mimeType: string; buffer: Buffer }): Promise<Response> {
    await this.importInput.setInputFiles(file);
    const imported = this.page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/expenses/import' && res.request().method() === 'POST',
    );
    await this.importButton.click();
    return imported;
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
