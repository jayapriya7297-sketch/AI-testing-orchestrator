# REQ-008 · Priority High · Status Implemented · Linked defects BUG-001 (fixed), BUG-005
# User story: As a user I want only my own expenses visible
# Scenarios already covered by tests in tests/ are listed in review/traceability.xlsx, not here.

Feature: Data privacy

  # AC1: A regular user sees only their own expenses in the list, export and detail views;
  #      another user's expense returns 404
  # AC2: A regular user cannot edit or delete another user's expense (404)
  # AC3: The admin can view every user's expenses (list, export, detail)
  # AC4: The admin can edit and delete only their own expenses; another user's returns 403
  # AC2 and AC4 are covered by tests in tests/api and tests/db (see traceability).

  @REQ-008 @smoke @ui
  Scenario: A regular user sees their own new expense in the list
    Given the regular user has an expense with a unique title
    When the regular user logs in
    Then the list shows that expense, created by the regular user

  @REQ-008 @regression @ui @file @BUG-001
  Scenario: A regular user's Export contains only their own expenses
    Given the admin has an expense with a unique title
    And the regular user is logged in
    When the regular user clicks Export
    Then every exported row is created by the regular user
    And the admin's expense is not in the file

  @REQ-008 @regression @api @BUG-001
  Scenario: A regular user's list filtered by category leaves out another user's expense
    Given the admin and the regular user each have a "Utilities" expense
    When the regular user lists expenses with category "Utilities"
    Then the response is 200 and includes the user's own expense
    And every expense is created by the regular user
    And the admin's expense is not included

  @REQ-008 @regression @ui
  Scenario: The admin sees a regular user's new expense in the list
    Given the regular user has an expense with a unique title
    When the admin opens the expense list
    Then the list shows that expense, created by the regular user
