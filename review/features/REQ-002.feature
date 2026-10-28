# REQ-002 · Priority High · Status Implemented · Linked defects BUG-002, BUG-004 (closed, by design)
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

  # C4: Amount uses a dot decimal (12.50); no thousands separator

  @REQ-002 @regression @api @db
  Scenario Outline: POST with amount "<amount>" is rejected
    When I POST a valid expense with amount "<amount>"
    Then the response is 400 with amount "Amount must be a number"
    And no expense is stored

    Examples:
      | amount |
      | 1,000  |
      | 12,50  |

  # C5: Category is one of: Food, Travel, Office, Utilities, Entertainment, Other

  @REQ-002 @regression @api @db
  Scenario Outline: POST with category <category> is accepted and stored
    When I POST a valid expense with category <category>
    Then the response is 201 and the database row has category <category>

    Examples:
      | category      |
      | Food          |
      | Travel        |
      | Office        |
      | Utilities     |
      | Entertainment |
      | Other         |

  @REQ-002 @regression @ui
  Scenario: The category dropdown offers exactly the six categories
    When I open the "Add expense" form
    Then the category options are "Select a category" followed by the six categories

  # C6: Date is any real date in YYYY-MM-DD format; future dates are allowed

  @REQ-002 @regression @api @db
  Scenario Outline: POST with <name> <date> is accepted and stored
    When I POST a valid expense with date <date>
    Then the response is 201 and the database row has date <date>

    Examples:
      | name          | date       |
      | a future date | 2099-12-31 |
      | an old date   | 1900-01-01 |

  @REQ-002 @regression @ui @db
  Scenario: Adding an expense with a future date shows it in the list
    When I add a valid expense dated 2099-12-31
    Then I see "Expense added" and the row shows 2099-12-31
    And the expense is stored

  # C7: Duplicate expenses are allowed

  @REQ-002 @regression @api @db
  Scenario: POSTing the same expense twice stores two rows
    When I POST the same valid expense twice
    Then both responses are 201 with different ids
    And two rows with that title are stored

  @REQ-002 @regression @ui @db
  Scenario: Adding the same expense twice shows two rows
    When I add the same valid expense twice through the form
    Then two rows with that title are listed and stored

  # C9: The success message stays until the user opens Add or Edit or another message
  # (e.g. an error) replaces it; filtering, Export and Import keep it.
  # C10: The new row follows the date sort (newest first); on the same date the newest
  # expense (higher id) comes first.

  @REQ-002 @regression @ui
  Scenario: "Expense added" is still shown 10 minutes later with no action
    When I add a valid expense
    And 10 minutes pass with no action
    Then I still see "Expense added"

  @REQ-002 @regression @ui
  Scenario Outline: <action> hides the success message
    Given I added a valid expense and see "Expense added"
    When <action>
    Then the success message is hidden

    Examples:
      | action                              |
      | I open the Add form                 |
      | I open Edit on the new expense      |

  @REQ-002 @regression @ui
  Scenario: An error message replaces the success message
    Given I added a valid expense and see "Expense added"
    When deleting another expense fails with a server error
    Then I see "Internal server error" and the success message is hidden

  @REQ-002 @regression @ui
  Scenario Outline: <action> keeps the success message
    Given I added a valid expense and see "Expense added"
    When <action>
    Then I still see "Expense added"

    Examples:
      | action                                  |
      | I filter by another category            |
      | I export to Excel                       |
      | I import a valid file                   |

  @REQ-002 @regression @ui
  Scenario: A back-dated new expense appears in date order
    When I add a valid expense dated 2020-01-15
    Then the new row is listed
    And the list is sorted by date, newest first

  @REQ-002 @regression @ui
  Scenario: On the same date the newer expense is listed first
    Given two expenses with the same date
    When I open the expense list
    Then the one created later is listed above the other
