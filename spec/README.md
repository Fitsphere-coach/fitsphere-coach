# FitSphere Coach --- Business Functional Specifications

## Purpose

This folder contains the business-level functional specifications for
the first development scope of FitSphere Coach.

These documents describe what the platform should allow users to do and
the expected business behaviour. They intentionally avoid detailed
technical design, database structures, API definitions and
implementation instructions.

## Scope covered

  -----------------------------------------------------------------------
  Spec ID                 Specification           Main scope
  ----------------------- ----------------------- -----------------------
  SPEC-001                Client Management       Maintain client
                                                  profiles, fitness
                                                  information and coach
                                                  assignments

  SPEC-002                Workout Management      Create reusable workout
                                                  templates and
                                                  client-specific workout
                                                  plans

  SPEC-003                Nutrition Management    Create reusable
                                                  nutrition templates and
                                                  client-specific diet
                                                  plans

  SPEC-004                Calendar Dashboard      Schedule, assign and
                          (CoachRx)               track client workout
                                                  and nutrition
                                                  activities
  -----------------------------------------------------------------------

## Business flow

1.  Add and maintain a client profile.
2.  Create or select a suitable workout plan.
3.  Create or select a suitable nutrition plan.
4.  Assign workout and nutrition activities to the client's calendar.
5.  Let the client view the schedule and update activity completion.
6.  Let authorised staff monitor schedules and progress.

## Roles in scope

-   **Gym Owner:** Overall control of the gym's clients, plans,
    templates and calendars.
-   **Head Coach:** Manages coaches/trainers and oversees client plans
    and schedules, subject to Gym Owner permissions.
-   **Coach / Trainer:** Manages assigned clients and their
    workout/nutrition plans and schedules, within granted permissions.
-   **Client:** Views assigned plans and schedules and records
    completion of activities.

The exact permission boundaries must be confirmed by the Gym Owner
before implementation. The existing platform-level Super Admin
responsibilities are outside the detailed scope of these four
specifications.

## How to use these specifications

-   Review each specification with the business owner.
-   Resolve all items marked **To be confirmed** before the related
    feature is developed.
-   Use the acceptance criteria at the end of each specification to
    review the completed feature.
-   Treat these documents as business requirements, not as a technical
    architecture or UI design.

## Common assumptions and boundaries

-   A client belongs to a gym.
-   A client may be assigned to a Coach / Trainer.
-   Workout and nutrition plans can be created from reusable templates
    or prepared for an individual client.
-   A calendar assignment must be associated with a client and a date.
-   Only authorised users should be able to view or change client
    information.
-   The platform should retain a useful history of assigned and
    completed activities.

## Decisions to confirm

1.  Can a client be assigned to more than one Coach / Trainer at the
    same time?
2.  Can a client have more than one workout or nutrition plan active at
    the same time?
3.  Can Coaches create or edit shared templates, or only use templates
    created by the Gym Owner / Head Coach?
4.  Can clients reschedule activities themselves, or can they only mark
    activities as completed?
5.  Should missed activities remain pending, become missed
    automatically, or require staff review?
6.  Should recurring schedules be supported in the first release?
7.  What client information is mandatory at registration?
8.  Which roles can view all clients and which can view only assigned
    clients?
