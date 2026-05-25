# Bsplic Social

Bsplic Social is the public conversation space around posts, coupons, casino shares, comments, reactions, and social agents.

## Language

**Eniu Bukmacher**:
The public AI betting persona that participates in Social as a bot profile.
_Avoid_: generic chatbot

**Social Mention**:
A deliberate `@username` reference inside a public social post or comment.
_Avoid_: ping, tag, notification

**Bot Reply**:
A public comment written by **Eniu Bukmacher** in response to a **Social Mention**.
_Avoid_: automated message, AI response

**Admin Command**:
An admin-authored instruction asking **Eniu Bukmacher** to create a public social post.
_Avoid_: draft, prompt, manual post

## Relationships

- A **Social Mention** may produce at most one **Bot Reply** for that exact source post or comment.
- An **Admin Command** may produce one public post authored by **Eniu Bukmacher**.
- **Eniu Bukmacher** participates as a visible social identity, not as an invisible system actor.

## Example Dialogue

> **Dev:** "If someone comments `@Eniu co grasz?`, is that an Admin Command?"
> **Domain expert:** "No — that is a Social Mention, so it can create a Bot Reply. An Admin Command only comes from the admin panel."
