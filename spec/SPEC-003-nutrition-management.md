# SPEC-003 --- Nutrition Management

**Product:** FitSphere Coach\
**Module:** Gym Owner Dashboard --- Nutrition Management\
**Document type:** Business Functional Specification\
**Status:** Draft --- Business review required

## 1. Purpose

Nutrition Management allows authorised gym staff to create reusable
nutrition templates and prepare diet plans for individual clients based
on their fitness goals and requirements.

## 2. Business objective

-   Maintain a library of nutrition and diet templates.
-   Support different client goals, such as weight loss, muscle gain and
    general fitness.
-   Make it easier to prepare and update client diet plans.
-   Allow authorised staff to assign nutrition plans to clients.
-   Make nutrition plans available for scheduling through the Calendar
    Dashboard.

## 3. Users and access

  -----------------------------------------------------------------------
  User                                Expected access
  ----------------------------------- -----------------------------------
  Gym Owner                           Manage nutrition templates and
                                      client plans for the gym

  Head Coach                          Manage templates and plans as
                                      permitted by the Gym Owner

  Coach / Trainer                     Manage nutrition plans for assigned
                                      clients, subject to permissions

  Client                              View their assigned nutrition plan
                                      and daily meal details
  -----------------------------------------------------------------------

**To be confirmed:** Whether all Coaches / Trainers can create nutrition
plans or whether this responsibility is limited to selected staff.

## 4. Functional requirements

### 4.1 Nutrition library

The system should provide a central place to view and manage nutrition
templates.

Suggested categories include:

-   Weight loss.
-   Muscle gain.
-   Weight maintenance.
-   General fitness.
-   Other gym-approved nutrition goals.

Users with permission should be able to search, filter, view, create,
edit, copy and deactivate templates.

### 4.2 Create nutrition template

An authorised user should be able to create a reusable nutrition
template.

Suggested information:

-   Template name.
-   Description.
-   Fitness goal.
-   Nutrition category.
-   Daily calorie target, if used by the gym.
-   Meal schedule.
-   Breakfast, lunch, dinner and snacks.
-   Food items and quantities.
-   Preparation instructions or notes.
-   Any relevant dietary preferences or restrictions shared by the
    client.

**To be confirmed:** Whether calorie and nutrient targets are required
in the first release and which nutrition values the business expects to
display.

### 4.3 Prepare a client nutrition plan

Authorised staff should be able to:

-   Select a client.
-   Select an existing nutrition template or create a client-specific
    plan.
-   Adjust meals and quantities based on the client's requirements.
-   Review the plan.
-   Save the plan for scheduling.

The client-specific plan should remain distinguishable from the reusable
template.

### 4.4 Daily meal details

The assigned plan should make it clear to the client:

-   Which meals are planned.
-   What food items are included.
-   Suggested quantities.
-   Meal timings, where provided.
-   Any instructions or notes.

### 4.5 Edit and manage plans

-   Authorised users should be able to update a client plan when
    required.
-   Templates should be reusable and independently manageable.
-   Unused templates or plans should be deactivated or archived
    according to the agreed business process.
-   Existing assigned plans should not unexpectedly change when a
    reusable template is edited.

### 4.6 Plan status

The business should be able to identify whether a nutrition plan is:

-   Draft.
-   Active / Assigned.
-   Completed.
-   Inactive or discontinued.

**To be confirmed:** Whether these exact statuses are required and who
can change them.

## 5. Business rules

1.  A nutrition template is a reusable starting point, not automatically
    a client's assigned plan.
2.  A client-specific nutrition plan must be associated with the correct
    client.
3.  Only authorised users can create, edit or deactivate templates and
    plans.
4.  Coaches / Trainers should manage only the clients and plans allowed
    by their permissions.
5.  Changes to a reusable template should not unexpectedly change an
    already assigned client plan.
6.  A nutrition plan should be available to the Calendar Dashboard for
    scheduling.
7.  The platform should present nutrition information as a fitness
    planning tool and should not represent a plan as medical advice.

## 6. Expected outcome

Authorised staff should be able to maintain nutrition templates, prepare
individual client diet plans and make those plans available for calendar
scheduling.

## 7. Acceptance criteria

-   An authorised user can view and search nutrition templates.
-   An authorised user can create and update a template.
-   An authorised user can copy or deactivate a template according to
    permissions.
-   A client-specific nutrition plan can be prepared from a template or
    created individually.
-   The plan clearly displays meals, food items, quantities and timings
    where provided.
-   The plan is linked to the correct client.
-   The plan can be selected in the Calendar Dashboard.
-   Editing a reusable template does not unexpectedly change existing
    assigned client plans.
