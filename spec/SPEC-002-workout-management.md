# SPEC-002 --- Workout Management

**Product:** FitSphere Coach\
**Module:** Gym Owner Dashboard --- Workout Management (CoachRx)\
**Document type:** Business Functional Specification\
**Status:** Draft --- Business review required

## 1. Purpose

Workout Management allows authorised gym staff to create reusable
workout templates and prepare workout plans for individual clients based
on their fitness requirements.

## 2. Business objective

-   Maintain a library of reusable workout templates.
-   Support different fitness goals and training levels.
-   Reduce repeated work when preparing client workout plans.
-   Allow Coaches and Head Coaches to manage plans according to their
    permissions.
-   Make workout plans available for scheduling through the Calendar
    Dashboard.

## 3. Users and access

  -----------------------------------------------------------------------
  User                                Expected access
  ----------------------------------- -----------------------------------
  Gym Owner                           Manage workout templates and plans
                                      for the gym

  Head Coach                          Create and manage templates and
                                      client plans as permitted

  Coach / Trainer                     Create and manage plans for
                                      assigned clients, subject to
                                      permissions

  Client                              View assigned workout plans and
                                      related daily instructions
  -----------------------------------------------------------------------

**To be confirmed:** Whether Coaches / Trainers can create shared
templates, or only create client-specific plans using approved
templates.

## 4. Functional requirements

### 4.1 Workout library

The system should provide a central place to view and manage available
workout templates.

Users with permission should be able to:

-   View workout templates.
-   Search and filter templates.
-   Group templates by fitness goal, workout category or difficulty.
-   Open a template to view its details.
-   Create, edit, copy or deactivate templates, according to
    permissions.

Suggested categories include:

-   Weight loss.
-   Muscle gain.
-   Strength training.
-   General fitness.
-   Endurance.
-   Flexibility and mobility.

### 4.2 Create workout template

An authorised user should be able to create a reusable workout template.

Suggested information:

-   Template name.
-   Description.
-   Fitness goal.
-   Workout category.
-   Difficulty level.
-   Expected duration.
-   Weekly frequency.
-   Exercises included.
-   Sets, repetitions, duration and rest periods, where applicable.
-   Instructions or notes.

The exact exercise information required should be agreed with the
business and coaching team.

### 4.3 Edit, copy and manage templates

-   Authorised users should be able to update an existing template.
-   Users should be able to copy a template to create a variation
    without unintentionally changing the original.
-   Templates that are no longer in use should be deactivated or
    archived.
-   Existing client plans should remain understandable if a source
    template is later changed.

**To be confirmed:** Whether changes to a template should affect already
assigned client plans. Recommended approach: an assigned plan should
retain the version or content that was assigned to the client.

### 4.4 Prepare a client workout plan

Authorised staff should be able to:

-   Select a client.
-   Select an existing workout template or prepare a client-specific
    plan.
-   Adjust the plan to the client's fitness goal and requirements.
-   Review the plan before assigning it.
-   Save the plan for scheduling.

A client-specific plan should be distinguishable from the reusable
template.

### 4.5 Workout plan details

A client workout plan should make it clear:

-   Which exercises the client needs to perform.
-   The sets, repetitions or duration for each exercise, where
    applicable.
-   Rest periods and coaching instructions.
-   The intended training frequency or duration.
-   Any relevant notes for the client.

### 4.6 Plan status

The business should be able to identify whether a client workout plan
is:

-   Draft.
-   Active / Assigned.
-   Completed.
-   Inactive or discontinued.

**To be confirmed:** Whether these exact statuses are required and who
can change them.

## 5. Business rules

1.  Workout templates are reusable starting points; assigning a template
    to a client should create a client-specific plan.
2.  A workout plan must be associated with a client before it can be
    scheduled for that client.
3.  Only authorised users can create, edit or deactivate templates and
    plans.
4.  Coaches / Trainers should manage only the clients and plans allowed
    by their access permissions.
5.  Changes to a reusable template should not unexpectedly change an
    already assigned client plan.
6.  A plan should be available to the Calendar Dashboard for scheduling.

## 6. Expected outcome

Authorised staff should be able to maintain a workout library, prepare
suitable plans for individual clients and make those plans available for
calendar scheduling.

## 7. Acceptance criteria

-   An authorised user can view and search workout templates.
-   An authorised user can create and update a template.
-   An authorised user can copy or deactivate a template according to
    permissions.
-   A client-specific workout plan can be prepared from a template or
    created individually.
-   The plan displays its exercises and relevant instructions clearly.
-   The plan is linked to the correct client.
-   The plan can be selected in the Calendar Dashboard.
-   Existing assigned plans are not unexpectedly changed when a reusable
    template is edited.
