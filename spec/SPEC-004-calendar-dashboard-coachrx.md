# SPEC-004 --- Calendar Dashboard (CoachRx)

**Product:** FitSphere Coach\
**Module:** Gym Owner Dashboard --- Calendar Dashboard (CoachRx)\
**Document type:** Business Functional Specification\
**Status:** Draft --- Business review required

## 1. Purpose

The Calendar Dashboard provides a shared scheduling view for client
workout and nutrition plans. It allows authorised staff to assign plans
to dates, manage client schedules and track assigned and completed
activities.

This specification combines the Calendar Dashboard requirements listed
under Gym Owner Dashboard (Section 3E) and Calendar Dashboard (Section
4) so that the same functionality is not defined twice.

## 2. Business objective

-   Give staff a clear view of each client's planned activities.
-   Schedule workout and nutrition plans against specific dates.
-   Support daily, weekly and monthly calendar views.
-   Allow authorised Head Coaches and Coaches to manage client
    schedules.
-   Help clients understand what they need to do each day.
-   Track whether assigned activities have been completed, missed or
    rescheduled.

## 3. Users and access

  -----------------------------------------------------------------------
  User                                Expected access
  ----------------------------------- -----------------------------------
  Gym Owner                           View and manage gym calendars

  Head Coach                          View and manage client calendars as
                                      permitted

  Coach / Trainer                     View and manage calendars for
                                      assigned clients, subject to
                                      permissions

  Client                              View their own assigned schedule
                                      and update activity completion, if
                                      enabled
  -----------------------------------------------------------------------

**To be confirmed:** Whether clients can mark activities as missed,
request rescheduling or only mark them as completed.

## 4. Functional requirements

### 4.1 Calendar overview

The system should provide calendar views for authorised users.

Users should be able to:

-   View schedules by day, week and month.
-   View a specific client's calendar.
-   Identify workout and nutrition activities.
-   Move between dates and periods.
-   Find schedules using available client and Coach / Trainer filters.

The calendar should make it easy to distinguish workout activities from
nutrition activities.

### 4.2 Workout scheduling

Authorised users should be able to:

-   Select a client.
-   Select an available client workout plan.
-   Choose the date and, where required, time.
-   Add relevant instructions or notes.
-   Save the scheduled workout.
-   View the workout on the client's calendar.

The system should make it clear which client and plan the scheduled
activity belongs to.

### 4.3 Nutrition scheduling

Authorised users should be able to:

-   Select a client.
-   Select an available client nutrition plan.
-   Choose the date or date range for the plan.
-   Add relevant instructions or notes.
-   Save the nutrition schedule.
-   View the assigned nutrition plan in the client's calendar.

**To be confirmed:** Whether nutrition plans are assigned as a full-day
plan, by individual meal, or both.

### 4.4 Client-wise calendar

Authorised users should be able to open an individual client's calendar
and view:

-   Scheduled workouts.
-   Scheduled nutrition plans or meals.
-   Upcoming activities.
-   Completed activities.
-   Missed or rescheduled activities, where supported.

The calendar should show the client's assigned Coach / Trainer where
relevant.

### 4.5 Reschedule or update activities

Authorised users should be able to update an activity's date, time or
instructions according to their permissions.

The system should make the updated schedule clear to the relevant staff
and client.

**To be confirmed:** Whether rescheduling requires a reason and whether
clients receive a notification when a schedule changes.

### 4.6 Activity tracking

The system should support an agreed activity status, such as:

-   Assigned.
-   Completed.
-   Missed.
-   Rescheduled.

The status should be visible to authorised staff and, where appropriate,
to the client.

**To be confirmed:** Whether an activity becomes Missed automatically
after its scheduled date or requires a user to update it.

### 4.7 Recurring schedules

The business should decide whether staff can repeat a workout or
nutrition schedule across selected days or weeks.

**To be confirmed:** Whether recurring scheduling is required in the
first release. If supported, users should be able to review the dates
before saving the repeated schedule.

### 4.8 Schedule conflicts

The system should help users identify potential scheduling conflicts,
such as overlapping workout sessions for the same client.

**To be confirmed:** Which conflicts should block saving and which
should only display a warning.

### 4.9 Client dashboard connection

-   Clients should be able to view their assigned workout and nutrition
    schedules.
-   Clients should be able to open an activity and view its details.
-   If enabled, clients should be able to mark an activity as completed.
-   Activity updates should be reflected in the relevant staff calendar.

## 5. Business rules

1.  A scheduled activity must belong to a client.
2.  A workout activity must refer to an available client workout plan.
3.  A nutrition activity must refer to an available client nutrition
    plan.
4.  Staff should only manage schedules permitted by their role and
    client assignment.
5.  Clients should only view their own assigned schedules.
6.  Schedule changes should be reflected consistently in staff and
    client views.
7.  The system should retain a useful record of activity status and
    schedule changes.
8.  A reusable template should not be treated as a scheduled client
    activity until it has been assigned to a client.
9.  The calendar should clearly distinguish workout and nutrition
    activities.

## 6. Expected outcome

Staff should be able to plan and manage each client's workout and
nutrition schedule from one calendar. Clients should be able to view
their daily and upcoming activities and track completion where enabled.

## 7. Acceptance criteria

-   An authorised user can view daily, weekly and monthly calendars.
-   An authorised user can open an individual client's calendar.
-   An authorised user can assign a workout plan to a date.
-   An authorised user can assign a nutrition plan to a date or agreed
    date range.
-   Scheduled activities appear in the correct client's calendar.
-   Permitted users can update or reschedule activities.
-   Activity status is visible to authorised staff.
-   Client schedule changes are reflected in the client view.
-   Clients can view only their own schedules.
-   The agreed rules for recurring schedules and conflicts are followed.
