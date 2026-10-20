# REQ-008 · Priority High · Status Implemented · Linked defects BUG-001
# User story: As a user I want only my own expenses visible
# Scenarios already covered by tests in tests/ are listed in review/traceability.xlsx, not here.

Feature: Data privacy

  # AC1: The list, export and detail views show only my expenses

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
