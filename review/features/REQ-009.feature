# REQ-009 · Priority Low · Status Planned · Linked defects none
# User story: As a user I want to find an expense by name
# Planned: drafts are test.fixme until the search box exists.

Feature: Search by title

  # AC1: Typing in a search box filters the list by title (case-insensitive)

  @REQ-009 @smoke @ui
  Scenario: Typing an expense's unique title shows only matching rows
    Given I have an expense with a unique title
    When I type that title in the search box
    Then the list shows that expense
    And every row shown has a title containing the search text

  @REQ-009 @regression @ui
  Scenario: Search ignores case
    Given I have an expense with a unique title
    When I type that title in upper case in the search box
    Then the list shows that expense
    And every row shown has a title containing the search text, ignoring case

  # AC2: No match shows "No expenses found"

  @REQ-009 @regression @ui
  Scenario: A search with no match shows "No expenses found"
    When I type a title that no expense has in the search box
    Then I see "No expenses found"
    And no rows are shown
