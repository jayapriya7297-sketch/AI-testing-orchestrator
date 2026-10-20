# REQ-002 · Priority High · Status Implemented · Linked defects BUG-002, BUG-004
# User story: As a user I want to add an expense
# Scenarios already covered by tests in tests/ are listed in review/traceability.xlsx, not here.

Feature: Add expense

  Background:
    Given I am logged in as the admin user

  # AC1: Title, amount, category and date are required

  @REQ-002 @regression @ui
  Scenario Outline: Leaving only <field> empty shows just that field's required message
    Given I open the "Add expense" form
    And I fill in a valid expense with <field> left empty
    When I submit the form
    Then I see "<message>" under <field>
    And no other field shows an error
    And the form stays open with "Validation failed"
    And no expense is stored

    Examples:
      | field    | message              |
      | title    | Title is required    |
      | amount   | Amount is required   |
      | category | Category is required |
      | date     | Date is required     |

  @REQ-002 @regression @api
  Scenario Outline: POST without <field> returns 400 naming only that field
    When I POST a valid expense without <field>
    Then the response is 400 "Validation failed"
    And the only detail is <field> "<message>"

    Examples:
      | field    | message              |
      | title    | Title is required    |
      | amount   | Amount is required   |
      | category | Category is required |
      | date     | Date is required     |

  # AC2: Amount must be > 0, at most 1,000,000, max 2 decimals

  @REQ-002 @regression @api
  Scenario: POST with amount -0.01 returns 400
    When I POST a valid expense with amount -0.01
    Then the response is 400 with amount "Amount must be greater than 0"

  @REQ-002 @regression @api @db
  Scenario Outline: POST with boundary amount <amount> is accepted and stored exactly
    When I POST a valid expense with amount <amount>
    Then the response is 201 with amount <amount>
    And the database row has amount "<stored>"

    Examples:
      | amount    | stored     |
      | 0.01      | 0.01       |
      | 1000000   | 1000000.00 |
      | 999999.99 | 999999.99  |

  @REQ-002 @regression @ui @db
  Scenario Outline: Adding boundary amount <amount> in the form shows <shown>
    Given I open the "Add expense" form
    When I add a valid expense with amount <amount>
    Then I see "Expense added"
    And the new row shows amount "<shown>"
    And the database row has amount <amount>

    Examples:
      | amount  | shown         |
      | 0.01    | $0.01         |
      | 1000000 | $1,000,000.00 |

  # AC3: Success message and the new row appear in the list

  @REQ-002 @regression @ui @db
  Scenario: The new row appears once without a page reload and the count matches the list
    Given I open the "Add expense" form
    When I add a valid expense
    Then I see "Expense added"
    And exactly one row in the list has the new title
    And the page was not reloaded
    And the expense count equals the number of rows
    And exactly one expense with the new title is stored
