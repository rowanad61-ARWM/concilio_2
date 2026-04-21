ALTER TABLE "engagement"
ADD COLUMN IF NOT EXISTS "invitee_email" TEXT;

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "category",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'calendly_initial_meeting',
    'Initial Meeting confirmation',
    $$Your initial meeting with {{adviser_name}} — {{meeting_date}}$$,
    $$Hi {{client_first_name}},
Thanks for booking an initial meeting with us. I'm looking forward to learning about your situation and what you'd like to achieve.
When: {{meeting_datetime}}
Duration: {{meeting_duration}}
Where: {{meeting_location}}
To help us make the most of our time together, it would be useful (but not essential) to have a rough idea of:

Your current financial position — income, assets, debts, super
What's prompted you to seek advice now
Any specific questions you'd like answered

There's no preparation required and no cost for this first conversation. It's a chance for us both to work out whether we're a good fit.
Need to reschedule or cancel? Use these links:
Reschedule: {{calendly_reschedule_url}}
Cancel: {{calendly_cancel_url}}
Talk soon,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
    'Calendly',
    true,
    NOW(),
    NOW()
  ),
  (
    'calendly_fifteen_min_call',
    '15 Minute Call confirmation',
    $$Your 15-minute call with {{adviser_name}} — {{meeting_date}}$$,
    $$Hi {{client_first_name}},
Thanks for booking a 15-minute call. This is a quick, no-obligation chat for us to understand what you're after and for you to get a sense of how we work.
When: {{meeting_datetime}}
Phone: I'll call you on the number you provided. If you'd prefer a different number, just reply to this email.
If the call goes well and it makes sense to go deeper, we'll book a longer initial meeting at no charge.
Reschedule: {{calendly_reschedule_url}}
Cancel: {{calendly_cancel_url}}
Speak soon,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
    'Calendly',
    true,
    NOW(),
    NOW()
  ),
  (
    'calendly_general_meeting',
    'Meeting confirmation',
    $$Meeting confirmation — {{meeting_date}}$$,
    $$Hi {{client_first_name}},
Confirming our meeting:
When: {{meeting_datetime}}
Where: {{meeting_location}}
If there's anything specific you'd like to cover, reply to this email and I'll make sure we leave time for it.
Reschedule: {{calendly_reschedule_url}}
Cancel: {{calendly_cancel_url}}
See you then,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
    'Calendly',
    true,
    NOW(),
    NOW()
  ),
  (
    'calendly_annual_review',
    'Annual Review confirmation',
    $$Your Annual Review — {{meeting_date}}$$,
    $$Hi {{client_first_name}},
Your Annual Review is booked in:
When: {{meeting_datetime}}
Where: {{meeting_location}}
Duration: {{meeting_duration}}
In your review we'll cover:

Progress against the goals we set last year
Any changes in your situation (work, family, health, goals)
Portfolio performance and positioning
Super and insurance check-in
Estate planning refresh
Anything else on your mind

Before the meeting, please have a think about:

Has anything changed in your personal or financial circumstances?
Are your goals still the same, or has your thinking shifted?
Any upcoming decisions — property, retirement, gifting, inheritance?

You don't need to bring paperwork — we have everything on file. Just come with your current thinking.
Reschedule: {{calendly_reschedule_url}}
Cancel: {{calendly_cancel_url}}
Looking forward to it,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
    'Calendly',
    true,
    NOW(),
    NOW()
  ),
  (
    'calendly_ninety_day_recap',
    '90 Day Recap confirmation',
    $$Your 90-day check-in — {{meeting_date}}$$,
    $$Hi {{client_first_name}},
Your 90-day check-in is confirmed:
When: {{meeting_datetime}}
Where: {{meeting_location}}
This is a short follow-up to make sure everything we put in place is working as intended — the accounts are live, insurance is in force, contributions are flowing, and you feel comfortable with how things are set up.
If anything has come up since we last spoke — questions, concerns, admin that hasn't landed — make a note and we'll work through it together.
Reschedule: {{calendly_reschedule_url}}
Cancel: {{calendly_cancel_url}}
See you soon,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
    'Calendly',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;
