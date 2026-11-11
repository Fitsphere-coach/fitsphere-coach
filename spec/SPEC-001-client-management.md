# SPEC-001 --- Client Management

**Product:** FitSphere Coach\
**Module:** Gym Owner Dashboard --- Client Management\
**Document type:** Business Functional Specification\
**Status:** Draft --- Business review required

## 1. Purpose

Client Management allows the Gym Owner and authorised staff to maintain
client information in one place. The client profile will be the central
reference for assigning coaches, workout plans, nutrition plans and
calendar schedules.

## 2. Business objective

-   Maintain accurate and up-to-date client records.
-   Make it easy to find and manage gym clients.
-   Connect each client with the appropriate Coach / Trainer.
-   Make relevant client information available when preparing workout
    and nutrition plans.
-   Provide a clear view of a client's current plans and scheduled
    activities.

## 3. Users and access

  -----------------------------------------------------------------------
  User                                Expected access
  ----------------------------------- -----------------------------------
  Gym Owner                           Full access to clients belonging to
                                      their gym

  Head Coach                          View and manage clients as
                                      permitted by the Gym Owner

  Coach / Trainer                     View and manage assigned clients,
                                      subject to permissions

  Client                              View their own permitted profile
                                      information
  -----------------------------------------------------------------------

**To be confirmed:** Whether Head Coaches can manage every client in the
gym or only clients assigned to them; whether Coaches can add new
clients or only manage assigned clients.

## 4. Functional requirements

### 4.1 Client list

The system should allow authorised staff to:

-   View the clients belonging to their gym or assigned to them.
-   Search clients by name and available contact details.
-   Filter clients by status and assigned Coach / Trainer.
-   Open a client's profile.
-   Identify whether a client is active or inactive.

### 4.2 Add client

The system should allow an authorised user to add a new client and
record the agreed client information.

Suggested information:

-   Full name.
-   Contact number and email address.
-   Date of birth or age, where required.
-   Gender, where required for the business process.
-   Address, if required.
-   Height and current weight.
-   Fitness goal, such as weight loss, muscle gain or general fitness.
-   Relevant fitness notes or limitations shared by the client.
-   Assigned Coach / Trainer.
-   Client start date and membership details, if managed in this module.

**To be confirmed:** Which fields are mandatory and whether membership
information is maintained here or in a separate membership module.

### 4.3 View client profile

The profile should provide an organised view of:

-   Client personal and contact information.
-   Fitness goals and relevant fitness information.
-   Assigned Coach / Trainer.
-   Current workout plan.
-   Current nutrition plan.
-   Upcoming and recent calendar activities.
-   Activity completion history.

### 4.4 Edit client

Authorised users should be able to update client information when
details or fitness goals change.

The system should make it clear when profile information has been
updated.

### 4.5 Delete or deactivate client

The system should allow authorised users to remove or deactivate a
client according to the gym's agreed business process.

Before deletion, the system should clearly explain the impact on
existing plans, calendar entries and activity history.

**Recommended business approach:** Prefer deactivation where historical
workout, nutrition and calendar records need to be retained.

**To be confirmed:** Whether deletion is permanent, whether deactivation
is sufficient, and what happens to historical records.

### 4.6 Coach assignment

-   An authorised user should be able to assign a Coach / Trainer to a
    client.
-   The assigned Coach / Trainer should be able to access that client's
    information according to their permissions.
-   Authorised users should be able to change the assignment.
-   The system should show the current assignment clearly.

**To be confirmed:** Whether multiple Coaches / Trainers can be assigned
to one client and whether reassignment history is required.

## 5. Business rules

1.  Each client must be associated with a gym.
2.  A client profile should be available only to authorised users.
3.  A Coach / Trainer should not automatically receive access to every
    gym client.
4.  Workout, nutrition and calendar information should be linked to the
    correct client.
5.  Deactivating a client should not silently remove historical activity
    records.
6.  The system should prevent accidental duplicate client creation where
    matching information is available.

## 6. Expected outcome

After this module is available, authorised staff should be able to
maintain client profiles and use those profiles when creating plans and
calendar schedules.

## 7. Acceptance criteria

-   An authorised user can add a client.
-   The client appears in the appropriate client list.
-   An authorised user can search for and open a client profile.
-   Permitted users can update client information.
-   The system applies the agreed access restrictions.
-   A client can be assigned or reassigned to a Coach / Trainer by an
    authorised user.
-   Deactivation or deletion follows the agreed business process.
-   The client profile provides access to the relevant workout,
    nutrition and calendar information.
