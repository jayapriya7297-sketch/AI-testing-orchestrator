# REQ-010 · Priority Low · Status Planned · Linked defects none
# User story: As a user I want to see what I spent this month
# Planned: drafts are test.fixme until the monthly total exists.
# Parallel-safe: every scenario compares the total with the sum of this month's rows
# shown on the page, not with a value taken before the change.

Feature: Monthly total

  # AC1: The list shows a total for the current month

  @REQ-010 @smoke @ui
  Scenario: The monthly total equals the sum of this month's rows shown
    Given I have an expense dated today with a unique title
    When I open the expense list
    Then the monthly total equals the sum of the amounts of the rows dated this month

  @REQ-010 @regression @ui
  Scenario: An expense from another month is left out of the total
    Given I have an expense dated in the previous month with a unique title
    When I open the expense list
    Then that expense is in the list
    And the monthly total equals the sum of the amounts of the rows dated this month

  # AC2: The total updates after add, edit or delete

  @REQ-010 @regression @ui
  Scenario: The total includes an expense added this month
    When I add an expense dated today with a unique title
    Then I see "Expense added" and the new row
    And the monthly total equals the sum of the amounts of the rows dated this month

  @REQ-010 @regression @ui
  Scenario: The total follows an edited amount
    Given I have an expense dated today with a unique title
    When I change its amount
    Then I see "Expense updated" and the row shows the new amount
    And the monthly total equals the sum of the amounts of the rows dated this month

  @REQ-010 @regression @ui
  Scenario: The total drops a deleted expense
    Given I have an expense dated today with a unique title
    When I delete it
    Then I see "Expense deleted" and the row is gone
    And the monthly total equals the sum of the amounts of the rows dated this month
